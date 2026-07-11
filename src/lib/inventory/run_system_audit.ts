import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { detectStructure } from "./structureDetector";
import { classifyRows } from "./rowClassifier";
import { extractInventoryRows } from "./inventoryExtractor";
import { extractAgingData } from "./agingExtractor";
import { resolveSuppliers } from "./supplierResolver";
import { validateRows } from "./validationEngine";
import { profileInventoryData } from "./dataProfiler";
import { 
  ParsedInventoryRow, 
  IgnoredInventoryRow, 
  NeedsReviewInventoryRow, 
  DetectedColumn, 
  IgnoredColumn, 
  AgingBucketRecord, 
  DatasetType,
  INVENTORY_COUNT_FIELDS,
  INVENTORY_CORE_FIELDS,
  COLUMN_ALIASES
} from "./types";
import { SheetDiagnosisResult } from "../../types/inventory";

const workspaceDir = process.cwd();

// Sibling conversion helpers identical to src/lib/inventory/index.ts
const toLegacyParsedRow = (row: any) => ({
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

const toLegacyIgnoredCategory = (classification: string) => {
  switch (classification) {
    case "ignored_header_row": return "ignored_header_row";
    case "ignored_empty_row": return "ignored_empty_row";
    case "ignored_total_row":
    case "ignored_subtotal_row": return "ignored_total_row";
    case "ignored_signature_row":
    case "ignored_metadata_row":
    case "ignored_summary_sheet_row": return "ignored_summary_row";
    default: return "ignored_summary_row";
  }
};

const getExpectedColumns = (datasetType: DatasetType): string[] => {
  const core = [...INVENTORY_CORE_FIELDS];
  switch (datasetType) {
    case "inventory_count_sheet": return [...core, ...INVENTORY_COUNT_FIELDS];
    case "inventory_aging_sheet": return [...core];
    case "mixed_inventory_sheet": return [...core, ...INVENTORY_COUNT_FIELDS];
    default: return core;
  }
};

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

const detectMappingFailures = (
  datasetType: DatasetType,
  foundFields: Set<string>,
  needsReviewCount: number,
  importedCount: number,
) => {
  const warnings: any[] = [];
  const totalData = importedCount + needsReviewCount;
  const reviewRatio = totalData > 0 ? needsReviewCount / totalData : 0;

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

// Copy discoverFinancialFields helper from index.ts
const discoverFinancialFields = (sheet: any) => {
  const headerRowIndex = sheet.headerRowIndex;
  const headerCells = sheet.headerCells || [];
  const rawRows = sheet.rawRows || [];

  const allHeaderNames = headerCells.map((c: any) => (c !== null && c !== undefined) ? String(c) : "");
  const candidateColumns: any[] = [];
  const financialKeywords = ["value", "amount", "cost", "sar", "price", "rate"];
  
  headerCells.forEach((cell: any, colIndex: number) => {
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

  const mappedTotalVal = sheet.columnMap.find((c: any) => c.mappedField === "totalValueSar");
  const mappedUnitPrice = sheet.columnMap.find((c: any) => c.mappedField === "unitPrice");

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

// Node-native file parser running the pipeline
function auditFile(fileName: string) {
  const filePath = path.join(workspaceDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`[AUDIT ERROR] File not found: ${filePath}`);
    return null;
  }

  const workbook = XLSX.readFile(filePath);
  const structures = detectStructure(workbook);

  // Pre-pass: siblings
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

  let totalSheets = structures.length;
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

    const sheetStandardCols: string[] = [];
    const sheetAgingCols: string[] = [];

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

    const classified = classifyRows(sheet, fileName);
    const extracted = extractInventoryRows(classified, sheet, "audit-report", siblingOrgs);
    const aging = extractAgingData(classified, sheet, fileName);
    allAgingData.push(...aging);

    resolveSuppliers(extracted);

    const { cleanRows, reviewRows } = validateRows(extracted, sheet.datasetType);

    for (const row of cleanRows) {
      allParsedRows.push(toLegacyParsedRow(row));
    }

    for (const row of reviewRows) {
      const primaryIssue = row.validationIssues.find(i => i.severity === "error") || row.validationIssues[0];
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

    const ignoredClassified = classified.filter(r => r.classification !== "inventory_item");
    for (const row of ignoredClassified) {
      allIgnoredRows.push({
        sourceFileName: row.sourceFileName,
        sheetName: row.sheetName,
        originalRowNumber: row.originalRowNumber,
        rawRowData: row.rawRowData,
        category: toLegacyIgnoredCategory(row.classification) as any,
        reason: row.reason,
      });
    }

    const expectedCols = getExpectedColumns(sheet.datasetType);
    const missingExpected = expectedCols.filter(f => !foundFields.has(f));
    const sheetImported = cleanRows.length;
    const sheetIgnored = ignoredClassified.length;
    const sheetReview = reviewRows.length;
    const mappingWarnings = detectMappingFailures(sheet.datasetType, foundFields, sheetReview, sheetImported);
    const confidence = computeConfidence(foundFields.size, expectedCols.length, sheetReview, sheetImported);

    allSheetDiagnoses.push({
      sourceFileName: fileName,
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

  const parsedResult = {
    totalSheets,
    totalRows,
    parsedRows: allParsedRows,
    ignoredRows: allIgnoredRows,
    needsReviewRows: allNeedsReviewRows,
    rejectedRows: allNeedsReviewRows,
    detectedColumns: allDetectedColumns,
    ignoredColumns: allIgnoredColumns,
    missingRequiredColumns: Array.from(missingRequiredColumnsSet),
    sheetDiagnoses: allSheetDiagnoses,
    agingData: allAgingData,
  };

  const profile = profileInventoryData(
    parsedResult.parsedRows,
    parsedResult.ignoredRows,
    parsedResult.needsReviewRows,
    parsedResult.sheetDiagnoses,
    parsedResult.agingData
  );

  return { parsedResult, profile };
}

const filesToAudit = [
  "Bartec 09.11.2025.xlsx",
  "Copy of MCH 07.12.2025.xlsx",
  "Copy of MEC 07.12.2025.xlsx",
  "Copy of MET - 27.11.2025 (003).xlsx",
  "IPR  IRA - 17.11.2025.xlsx",
  "Pepperl+Fuchs - 04.11.2025- Fathah.xlsx",
  "Weidmuller INVENTORY 4TH COUNT(02-11-2025-04-11-2025).xlsx",
  "Copy of 2026 - PHYSICAL STOCK - 01- Q.xlsx"
];

const auditResults: Record<string, any> = {};

filesToAudit.forEach(f => {
  console.log(`Auditing: ${f}...`);
  const res = auditFile(f);
  if (res) {
    auditResults[f] = {
      totalRawRows: res.parsedResult.totalRows,
      totalSheets: res.parsedResult.totalSheets,
      sheetDiagnoses: res.parsedResult.sheetDiagnoses.map(d => ({
        sheetName: d.sheetName,
        datasetType: d.datasetType,
        totalRows: d.totalRowsScanned,
        imported: d.importedRows,
        ignored: d.ignoredTechnicalRows,
        needsReview: d.needsReviewRows,
        confidence: d.confidenceLevel,
        financialDiscovery: d.financialDiscovery ? {
          selectedValueColumn: d.financialDiscovery.selectedValueColumn,
          selectedValueColumnName: d.financialDiscovery.selectedValueColumnName,
          confidence: d.financialDiscovery.confidence,
          reason: d.financialDiscovery.reason,
          candidateColumns: d.financialDiscovery.candidateColumns.map((c: any) => ({
            columnName: c.columnName,
            numericCellCount: c.numericCellCount,
            blankCellCount: c.blankCellCount,
            isRejected: c.isRejected,
            rejectionReason: c.rejectionReason
          }))
        } : null
      })),
      profile: {
        totalInventoryValueSar: res.profile.valueProfile.totalInventoryValueSar,
        financialValueStatus: res.profile.valueProfile.financialValueStatus,
        blankValueCount: res.profile.valueProfile.blankValueCount,
        invalidValueCount: res.profile.valueProfile.invalidValueCount,
        zeroValueCount: res.profile.valueProfile.zeroValueCount,
        quantityProfile: {
          totalSystemOnHand: res.profile.quantityProfile.totalSystemOnHand,
          totalPhysicalCount: res.profile.quantityProfile.totalPhysicalCount,
          negativeQuantityCount: res.profile.quantityProfile.negativeQuantityCount,
          variationMismatchCount: res.profile.quantityProfile.variationMismatchCount,
        },
        warningsCount: res.profile.warnings.length,
        warnings: res.profile.warnings.map(w => ({
          code: w.code,
          severity: w.severity,
          message: w.message
        }))
      }
    };
  }
});

fs.writeFileSync(path.join(workspaceDir, "system_audit_results.json"), JSON.stringify(auditResults, null, 2), "utf8");
console.log("Audit complete! Results written to system_audit_results.json");
