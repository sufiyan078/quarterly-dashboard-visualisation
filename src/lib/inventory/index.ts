/**
 * Inventory Intelligence Engine — Public API
 * 
 * Orchestrates the 6-stage pipeline:
 *   1. Excel Reader       → raw WorkBook
 *   2. Structure Detector → sheet structures + column maps + dataset type
 *   3. Inventory Extractor → extracted rows
 *   4. Aging Extractor     → aging bucket data (separate)
 *   5. Row Classifier      → classified rows
 *   6. Validation Engine   → flagged issues (dataset-type-aware)
 * 
 * Phase 4B: Adds dataset type detection, context-aware validation,
 * and per-sheet diagnosis reporting.
 */

import {
  ParsedWorkbookResult,
  ParsedInventoryRow,
  IgnoredInventoryRow,
  NeedsReviewInventoryRow,
  DetectedColumn,
  IgnoredColumn,
  AgingBucketRecord,
  ExtractedInventoryRow,
  SheetDiagnosis,
  DatasetType,
  INVENTORY_COUNT_FIELDS,
  INVENTORY_CORE_FIELDS,
  MappingFailureWarning,
  SheetStructure,
  COLUMN_ALIASES,
} from "./types";
import { SheetDiagnosisResult } from "../../types/inventory";
import { readExcelFile } from "./excelReader";
import { detectStructure } from "./structureDetector";
import { classifyRows } from "./rowClassifier";
import { extractInventoryRows } from "./inventoryExtractor";
import { extractAgingData } from "./agingExtractor";
import { resolveSuppliers } from "./supplierResolver";
import { validateRows } from "./validationEngine";
import { profileInventoryData } from "./dataProfiler";

// Re-export types and sub-modules for external use
export type { ParsedWorkbookResult, AgingBucketRecord, ExtractedInventoryRow, DatasetType };
export { readExcelFile, readExcelFiles } from "./excelReader";
export { detectStructure, isAgingColumn } from "./structureDetector";
export { classifyRows } from "./rowClassifier";
export { extractInventoryRows } from "./inventoryExtractor";
export { extractAgingData } from "./agingExtractor";
export { resolveSuppliers, detectSupplier } from "./supplierResolver";
export { validateRows } from "./validationEngine";
export { profileInventoryData };


// ─── Legacy-compat conversion ───────────────────────────────────────────────

/**
 * Converts an ExtractedInventoryRow to the legacy ParsedInventoryRow shape
 * expected by the validation page UI.
 */
const toLegacyParsedRow = (row: ExtractedInventoryRow): ParsedInventoryRow => ({
  reportId: row.reportId,
  sourceFileName: row.sourceFileName,
  sheetName: row.sheetName,
  originalRowNumber: row.originalRowNumber,
  item: row.item,
  description: row.description,
  org: row.org,
  supplier: row.resolvedSupplier,
  totalValueSar: row.totalValueSar,
  systemOnHand: row.systemOnHand,
  physicalCount: row.physicalCount,
  variation: row.variation,
  remarks: row.remarks,
  reported: row.reported,
  supplierName: row.resolvedSupplier,
  detectedSupplierName: row.resolvedSupplier,
  supplierDetectionMethod: row.supplierDetectionMethod,
});

/**
 * Maps an ignored classification to the legacy IgnoredInventoryRow category.
 */
const toLegacyIgnoredCategory = (
  classification: string
): IgnoredInventoryRow["category"] => {
  switch (classification) {
    case "ignored_header_row":
      return "ignored_header_row";
    case "ignored_empty_row":
      return "ignored_empty_row";
    case "ignored_total_row":
    case "ignored_subtotal_row":
      return "ignored_total_row";
    case "ignored_signature_row":
    case "ignored_metadata_row":
    case "ignored_summary_sheet_row":
      return "ignored_summary_row";
    default:
      return "ignored_summary_row";
  }
};

// ─── Diagnosis Builder ──────────────────────────────────────────────────────

/**
 * Determines expected columns based on dataset type and flags missing ones.
 */
const getExpectedColumns = (datasetType: DatasetType): string[] => {
  const core = [...INVENTORY_CORE_FIELDS]; // item, description, supplier, org, totalValueSar
  switch (datasetType) {
    case "inventory_count_sheet":
      return [...core, ...INVENTORY_COUNT_FIELDS]; // + systemOnHand, physicalCount, variation
    case "inventory_aging_sheet":
      return [...core]; // aging columns are separate, no count fields expected
    case "mixed_inventory_sheet":
      return [...core, ...INVENTORY_COUNT_FIELDS];
    default:
      return core;
  }
};

/**
 * Compute confidence level based on column match quality.
 */
const computeConfidence = (
  detectedCount: number,
  expectedCount: number,
  needsReviewCount: number,
  importedCount: number,
): "high" | "medium" | "low" => {
  const matchRatio = expectedCount > 0 ? detectedCount / expectedCount : 0;
  const totalData = importedCount + needsReviewCount;
  const reviewRatio = totalData > 0 ? needsReviewCount / totalData : 0;

  if (matchRatio >= 0.7 && reviewRatio < 0.1) return "high";
  if (matchRatio >= 0.4 || reviewRatio < 0.3) return "medium";
  return "low";
};

/**
 * Detect mapping failure warnings: sheets with many review rows because
 * a critical column is unmapped.
 */
const detectMappingFailures = (
  datasetType: DatasetType,
  foundFields: Set<string>,
  needsReviewCount: number,
  importedCount: number,
): MappingFailureWarning[] => {
  const warnings: MappingFailureWarning[] = [];
  const totalData = importedCount + needsReviewCount;
  const reviewRatio = totalData > 0 ? needsReviewCount / totalData : 0;

  // Only flag if review ratio is significant
  if (reviewRatio < 0.3) return warnings;

  const expected = getExpectedColumns(datasetType);
  for (const field of expected) {
    if (!foundFields.has(field)) {
      warnings.push({
        field,
        message: `Possible column mapping issue: "${field}" was not detected in this sheet. ${needsReviewCount} rows may be affected.`,
      });
    }
  }

  return warnings;
};

/**
 * Discover financial fields in a sheet structure.
 */
const discoverFinancialFields = (sheet: SheetStructure): NonNullable<SheetDiagnosisResult["financialDiscovery"]> => {
  const headerRowIndex = sheet.headerRowIndex;
  const headerCells = sheet.headerCells || [];
  const rawRows = sheet.rawRows || [];

  const allHeaderNames = headerCells.map(c => (c !== null && c !== undefined) ? String(c) : "");
  const candidateColumns: {
    columnName: string;
    columnIndex: number;
    numericCellCount: number;
    blankCellCount: number;
    sampleValues: string[];
    isRejected: boolean;
    rejectionReason?: string;
  }[] = [];

  const financialKeywords = ["value", "amount", "cost", "sar", "price", "rate"];
  
  headerCells.forEach((cell, colIndex) => {
    if (cell === null || cell === undefined || String(cell).trim() === "") return;
    const colName = String(cell);
    const normalized = colName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    
    const isMappedTotalValue = COLUMN_ALIASES.totalValueSar.includes(normalized);
    const isMappedUnitPrice = COLUMN_ALIASES.unitPrice.includes(normalized);
    const hasFinancialKeyword = financialKeywords.some(kw => normalized.includes(kw));

    if (isMappedTotalValue || isMappedUnitPrice || hasFinancialKeyword) {
      let numericCellCount = 0;
      let blankCellCount = 0;
      const sampleValues: string[] = [];

      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        const val = row ? row[colIndex] : undefined;
        if (val === undefined || val === null || String(val).trim() === "") {
          blankCellCount++;
        } else {
          const strVal = String(val).trim();
          const cleaned = strVal.replace(/[\s,A-Za-z$]/g, "");
          const num = Number(cleaned);
          const isNum = strVal !== "" && !isNaN(num);
          if (isNum) {
            numericCellCount++;
          }
          if (sampleValues.length < 5) {
            sampleValues.push(String(val));
          }
        }
      }

      let isRejected = false;
      let rejectionReason = "";

      if (sheet.sheetType === "summary_sheet") {
        isRejected = true;
        rejectionReason = "Sheet classified as summary sheet, columns not used for row extraction.";
      } else if (rawRows.length > headerRowIndex + 1 && numericCellCount === 0) {
        isRejected = true;
        rejectionReason = "Column contains no valid numeric values.";
      }

      candidateColumns.push({
        columnName: colName,
        columnIndex: colIndex,
        numericCellCount,
        blankCellCount,
        sampleValues,
        isRejected,
        rejectionReason: rejectionReason || undefined
      });
    }
  });

  let selectedValueColumn: string | null = null;
  let selectedValueColumnName: string | null = null;
  let confidence: "high" | "medium" | "low" | "none" = "none";
  let reason = "";

  const mappedTotalVal = sheet.columnMap.find(c => c.mappedField === "totalValueSar");
  const mappedUnitPrice = sheet.columnMap.find(c => c.mappedField === "unitPrice");

  if (mappedTotalVal) {
    const cand = candidateColumns.find(c => c.columnIndex === mappedTotalVal.columnIndex);
    const numericCount = cand ? cand.numericCellCount : 0;
    selectedValueColumn = "totalValueSar";
    selectedValueColumnName = mappedTotalVal.sourceColumnName;
    
    if (numericCount > 0) {
      confidence = "high";
      reason = `Selected direct total value column "${mappedTotalVal.sourceColumnName}" containing ${numericCount} numeric values.`;
    } else {
      confidence = "medium";
      reason = `Mapped direct total value column "${mappedTotalVal.sourceColumnName}" but it contains 0 numeric values.`;
    }
  } else if (mappedUnitPrice) {
    const cand = candidateColumns.find(c => c.columnIndex === mappedUnitPrice.columnIndex);
    const numericCount = cand ? cand.numericCellCount : 0;
    selectedValueColumn = "unitPrice";
    selectedValueColumnName = mappedUnitPrice.sourceColumnName;
    
    if (numericCount > 0) {
      confidence = "high";
      reason = `Selected unit price column "${mappedUnitPrice.sourceColumnName}" containing ${numericCount} numeric values to derive total value.`;
    } else {
      confidence = "medium";
      reason = `Mapped unit price column "${mappedUnitPrice.sourceColumnName}" but it contains 0 numeric values.`;
    }
  } else {
    if (candidateColumns.length > 0) {
      confidence = "low";
      const names = candidateColumns.map(c => `"${c.columnName}"`).join(", ");
      reason = `Financial candidate columns detected (${names}) but none were mapped because they didn't match primary aliases or had no numeric values.`;
    } else {
      confidence = "none";
      reason = "Financial value column not found in uploaded files.";
    }
  }

  return {
    headerRowIndex,
    allHeaderNames,
    candidateColumns,
    selectedValueColumn,
    selectedValueColumnName,
    confidence,
    reason
  };
};

// ─── Public Pipeline Function ───────────────────────────────────────────────

/**
 * Parses a single Excel file through the full 6-stage pipeline.
 * Returns a result object backward-compatible with the existing UI.
 * 
 * Phase 4B: Also produces sheetDiagnoses and agingData.
 */
export const parseExcelFile = async (
  file: File,
  reportId: string
): Promise<Omit<ParsedWorkbookResult, "totalFiles"> & { agingData: AgingBucketRecord[] }> => {
  // Stage 1: Read the workbook
  const { workbook } = await readExcelFile(file);

  // Stage 2: Detect structure for all sheets (now includes datasetType)
  const structures = detectStructure(workbook);

  // Pre-pass: Find all directly mapped organization codes in the workbook sheets
  const allDetectedOrgs = new Set<string>();
  for (const sheet of structures) {
    const orgCol = sheet.columnMap.find(c => c.mappedField === "org");
    if (orgCol) {
      const orgColIndex = orgCol.columnIndex;
      for (const row of sheet.rawRows) {
        if (row && row[orgColIndex] !== undefined && row[orgColIndex] !== null) {
          const orgStr = String(row[orgColIndex]).trim().toUpperCase();
          if (orgStr && orgStr !== "ORG" && orgStr !== "ORGANIZATION" && orgStr !== "VAL_UNIT_CODE" && orgStr !== "UNIT") {
            allDetectedOrgs.add(orgStr);
          }
        }
      }
    }
  }
  const siblingOrgs = Array.from(allDetectedOrgs);

  const totalSheets = structures.length;
  let totalRows = 0;

  const allParsedRows: ParsedInventoryRow[] = [];
  const allIgnoredRows: IgnoredInventoryRow[] = [];
  const allNeedsReviewRows: NeedsReviewInventoryRow[] = [];
  const allDetectedColumns: DetectedColumn[] = [];
  const allIgnoredColumns: IgnoredColumn[] = [];
  const allAgingData: AgingBucketRecord[] = [];
  const allSheetDiagnoses: SheetDiagnosisResult[] = [];
  const missingRequiredColumnsSet = new Set<string>();

  for (const sheet of structures) {
    totalRows += sheet.totalRawRows;

    // Track columns for diagnosis
    const sheetStandardCols: string[] = [];
    const sheetAgingCols: string[] = [];

    // Build detected/ignored column lists for the UI
    for (const col of sheet.columnMap) {
      if (col.mappingType === "standard" && col.mappedField) {
        allDetectedColumns.push({
          sheetName: sheet.sheetName,
          sourceColumn: col.sourceColumnName,
          mappedField: col.mappedField,
        });
        sheetStandardCols.push(`${col.sourceColumnName} → ${col.mappedField}`);
      } else if (col.mappingType === "aging") {
        allIgnoredColumns.push({
          sheetName: sheet.sheetName,
          sourceColumn: col.sourceColumnName,
          reason: "Aging Column",
        });
        sheetAgingCols.push(col.sourceColumnName);
      } else if (col.mappingType === "ignored") {
        allIgnoredColumns.push({
          sheetName: sheet.sheetName,
          sourceColumn: col.sourceColumnName,
          reason: "Unrecognized Column",
        });
      }
    }

    // Check for missing required columns on inventory sheets
    const foundFields = new Set(
      sheet.columnMap
        .filter(c => c.mappingType === "standard" && c.mappedField)
        .map(c => c.mappedField!)
    );

    if (sheet.sheetType === "inventory_sheet") {
      for (const required of ["item", "description"]) {
        if (!foundFields.has(required)) {
          missingRequiredColumnsSet.add(required);
        }
      }
    }

    // Stage 5: Classify all rows in this sheet
    const classified = classifyRows(sheet, file.name);

    // Stage 3: Extract inventory rows
    const extracted = extractInventoryRows(classified, sheet, reportId, siblingOrgs);

    // Stage 4: Extract aging data
    const aging = extractAgingData(classified, sheet, file.name);
    allAgingData.push(...aging);

    // Resolve suppliers on extracted rows
    resolveSuppliers(extracted);

    // Stage 6: Validate extracted rows — NOW DATASET-TYPE AWARE
    const { cleanRows, reviewRows } = validateRows(extracted, sheet.datasetType);

    // Convert clean rows to legacy ParsedInventoryRow
    for (const row of cleanRows) {
      allParsedRows.push(toLegacyParsedRow(row));
    }

    // Convert review rows to enhanced NeedsReviewInventoryRow
    for (const row of reviewRows) {
      const primaryIssue = row.validationIssues.find(i => i.severity === "error")
        || row.validationIssues[0];

      // Phase 4B: Compute fields found/missing for this specific row
      const rowFieldsFound: string[] = [];
      const rowMissingFields: string[] = [];
      if (row.item) rowFieldsFound.push("item"); else rowMissingFields.push("item");
      if (row.description) rowFieldsFound.push("description"); else rowMissingFields.push("description");
      if (row.org) rowFieldsFound.push("org"); else rowMissingFields.push("org");
      if (row.rawSupplier) rowFieldsFound.push("supplier"); else rowMissingFields.push("supplier");
      if (row.totalValueSar !== null && row.totalValueSar !== 0) rowFieldsFound.push("totalValueSar"); else rowMissingFields.push("totalValueSar");
      if (row.systemOnHand !== 0) rowFieldsFound.push("systemOnHand"); else rowMissingFields.push("systemOnHand");
      if (row.physicalCount !== 0) rowFieldsFound.push("physicalCount"); else rowMissingFields.push("physicalCount");

      allNeedsReviewRows.push({
        sourceFileName: row.sourceFileName,
        sheetName: row.sheetName,
        originalRowNumber: row.originalRowNumber,
        rawRowData: row.rawRowData,
        category: "needs_review_possible_item",
        reason: primaryIssue?.message || "Validation issue",
        datasetType: sheet.datasetType,
        mappedFieldsFound: rowFieldsFound,
        missingFields: rowMissingFields,
        validationCodes: row.validationIssues.map(i => i.code),
      });
    }

    // Convert ignored classified rows to legacy IgnoredInventoryRow
    const ignoredClassified = classified.filter(
      r => r.classification !== "inventory_item"
    );
    for (const row of ignoredClassified) {
      allIgnoredRows.push({
        sourceFileName: row.sourceFileName,
        sheetName: row.sheetName,
        originalRowNumber: row.originalRowNumber,
        rawRowData: row.rawRowData,
        category: toLegacyIgnoredCategory(row.classification),
        reason: row.reason,
      });
    }

    // Build sheet-level diagnosis
    const expectedCols = getExpectedColumns(sheet.datasetType);
    const missingExpected = expectedCols.filter(f => !foundFields.has(f));
    const sheetImported = cleanRows.length;
    const sheetIgnored = ignoredClassified.length;
    const sheetReview = reviewRows.length;
    const mappingWarnings = detectMappingFailures(
      sheet.datasetType, foundFields, sheetReview, sheetImported
    );
    const confidence = computeConfidence(
      foundFields.size, expectedCols.length, sheetReview, sheetImported
    );

    allSheetDiagnoses.push({
      sourceFileName: file.name,
      sheetName: sheet.sheetName,
      datasetType: sheet.datasetType,
      totalRowsScanned: sheet.totalRawRows,
      importedRows: sheetImported,
      ignoredTechnicalRows: sheetIgnored,
      needsReviewRows: sheetReview,
      detectedStandardColumns: sheetStandardCols,
      detectedAgingColumns: sheetAgingCols,
      missingExpectedColumns: missingExpected,
      mappingFailureWarnings: mappingWarnings,
      confidenceLevel: confidence,
      financialDiscovery: discoverFinancialFields(sheet),
    });
  }

  return {
    totalSheets,
    totalRows,
    parsedRows: allParsedRows,
    ignoredRows: allIgnoredRows,
    needsReviewRows: allNeedsReviewRows,
    rejectedRows: allNeedsReviewRows, // Backward compat
    detectedColumns: allDetectedColumns,
    ignoredColumns: allIgnoredColumns,
    missingRequiredColumns: Array.from(missingRequiredColumnsSet),
    sheetDiagnoses: allSheetDiagnoses,
    agingData: allAgingData,
  };
};

export * from "./calculations";

