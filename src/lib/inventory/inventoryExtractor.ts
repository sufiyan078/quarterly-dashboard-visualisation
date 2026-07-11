/**
 * Stage 3: Inventory Extraction Engine
 * 
 * Extracts all rows classified as `inventory_item` and maps their raw cell
 * values to standard inventory fields.
 * 
 * CRITICAL RULE: Never reject a row that could be a real inventory item.
 * If item code is present but description is missing → still extract it.
 * If description is present but item code is missing → still extract it.
 * Missing fields are flagged by the Validation Engine — NOT discarded here.
 * 
 * Does NOT validate quantities, check duplicates, or compute variation.
 */

import { ExtractedInventoryRow, ClassifiedRow, SheetStructure } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

const KNOWN_ORGS = ["INS", "ISR", "MCH", "MEC", "MET", "IPR", "IRA"];

/** Parse a cell value to a number, returning 0 if unparseable */
const cleanNum = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  const strVal = String(val).trim();
  if (strVal === "") return 0;
  const cleaned = strVal.replace(/[\s,A-Za-z$]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

/** Try to parse a cell value, returning null if truly unparseable */
const tryParseNum = (val: unknown): number | null => {
  if (val === null || val === undefined) return null;
  const strVal = String(val).trim();
  if (strVal === "") return null;
  const cleaned = strVal.replace(/[\s,A-Za-z$]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

/**
 * Resolves the organization code for a row.
 * Handles fallbacks based on sheet columns, sheet name, filename, and sibling sheets.
 */
const resolveOrganization = (
  rowObj: Record<string, unknown>,
  classified: ClassifiedRow,
  sheet: SheetStructure,
  siblingOrgs: string[]
): string => {
  // 1. Direct map
  const org = rowObj["org"] !== undefined ? String(rowObj["org"]).trim() : "";
  if (org) return org;

  // 2. Check row-level values in columns that match known organization codes
  const knownOrgsInRow: string[] = [];
  for (const [key, val] of Object.entries(classified.rawRowData)) {
    const normKey = key.toUpperCase().trim();
    if (KNOWN_ORGS.includes(normKey)) {
      if (val !== undefined && val !== null && String(val).trim() !== "" && cleanNum(val) > 0) {
        knownOrgsInRow.push(normKey);
      }
    }
  }

  if (knownOrgsInRow.length > 0) {
    return knownOrgsInRow[0];
  }

  // 3. Fallback based on sheet name
  const upperSheet = sheet.sheetName.toUpperCase().trim();
  for (const known of KNOWN_ORGS) {
    if (upperSheet.includes(known)) {
      return known;
    }
  }

  // 4. Fallback based on filename
  const upperFile = classified.sourceFileName.toUpperCase().trim();
  for (const known of KNOWN_ORGS) {
    if (upperFile.includes(known)) {
      return known;
    }
  }

  // 5. Sibling sheet characteristics
  if (siblingOrgs && siblingOrgs.length > 0) {
    return siblingOrgs[0];
  }

  return "";
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Extracts inventory rows from classified rows.
 * Only processes rows where classification === "inventory_item".
 * 
 * @param classifiedRows - Output from the Row Classifier
 * @param sheet - Sheet structure with the column map
 * @param reportId - The report period ID
 * @param siblingOrgs - Array of organizations found in sibling sheets
 */
export const extractInventoryRows = (
  classifiedRows: ClassifiedRow[],
  sheet: SheetStructure,
  reportId: string,
  siblingOrgs: string[] = []
): ExtractedInventoryRow[] => {
  const { rawRows, columnMap } = sheet;

  // Build index-to-field lookup from the column map
  const indexToField: Record<number, string> = {};
  for (const col of columnMap) {
    if (col.mappingType === "standard" && col.mappedField) {
      indexToField[col.columnIndex] = col.mappedField;
    }
  }

  const inventoryRows = classifiedRows.filter(r => r.classification === "inventory_item");
  const extracted: ExtractedInventoryRow[] = [];

  for (const classified of inventoryRows) {
    // originalRowNumber is 1-based, rawRows is 0-based
    const rowIndex = classified.originalRowNumber - 1;
    const rowData = rawRows[rowIndex];
    if (!rowData) continue;

    // Map cells to fields
    const rowObj: Record<string, unknown> = {};
    for (let j = 0; j < rowData.length; j++) {
      const field = indexToField[j];
      if (field) {
        rowObj[field] = rowData[j];
      }
    }

    const item = rowObj["item"] !== undefined ? String(rowObj["item"]).trim() : "";
    const description = rowObj["description"] !== undefined ? String(rowObj["description"]).trim() : "";
    
    // Resolve organization using fallbacks
    const org = resolveOrganization(rowObj, classified, sheet, siblingOrgs);

    const rawSupplier = rowObj["supplier"] !== undefined ? String(rowObj["supplier"]) : "";
    const remarks = rowObj["remarks"] !== undefined ? String(rowObj["remarks"]).trim() : "";
    const reported = rowObj["reported"] !== undefined ? String(rowObj["reported"]).trim() : "";

    const systemOnHand = cleanNum(rowObj["systemOnHand"]);
    const physicalCount = cleanNum(rowObj["physicalCount"]);

    // Use the spreadsheet's variation column if present, otherwise compute
    const variationRaw = tryParseNum(rowObj["variation"]);
    const variation = variationRaw !== null ? variationRaw : (physicalCount - systemOnHand);

    // Resolve total value (supporting direct, derived, and missing)
    let totalValueSar: number | null = null;
    let valueSource: "direct" | "derived" | "missing" = "missing";
    let valueFormula = "";

    const hasTotalValueCol = columnMap.some(c => c.mappedField === "totalValueSar");
    const hasUnitPriceCol = columnMap.some(c => c.mappedField === "unitPrice");

    const rawVal = rowObj["totalValueSar"];
    const hasRawVal = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "";

    if (hasTotalValueCol && hasRawVal) {
      const parsedVal = tryParseNum(rawVal);
      if (parsedVal !== null) {
        totalValueSar = parsedVal;
        valueSource = "direct";
      } else {
        totalValueSar = null;
        valueSource = "missing";
      }
    } else if (hasUnitPriceCol) {
      const rawUnitPrice = rowObj["unitPrice"];
      const parsedUnitPrice = tryParseNum(rawUnitPrice);
      if (parsedUnitPrice !== null) {
        totalValueSar = parsedUnitPrice * systemOnHand;
        valueSource = "derived";
        valueFormula = "unitPrice * systemOnHand";
      } else {
        totalValueSar = null;
        valueSource = "missing";
      }
    } else {
      totalValueSar = null;
      valueSource = "missing";
    }

    extracted.push({
      reportId,
      sourceFileName: classified.sourceFileName,
      sheetName: classified.sheetName,
      originalRowNumber: classified.originalRowNumber,
      rawRowData: classified.rawRowData,
      item,
      description,
      org,
      rawSupplier,
      totalValueSar,
      valueSource,
      valueFormula,
      systemOnHand,
      physicalCount,
      variation,
      remarks,
      reported,
      // These are populated by downstream stages
      validationIssues: [],
      resolvedSupplier: "",
      supplierDetectionMethod: "",
    });
  }

  return extracted;
};
