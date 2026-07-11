/**
 * Stage 2: Structure Detection Engine
 * 
 * Detects sheets, header rows, column mappings, aging columns,
 * and classifies sheets as inventory vs summary.
 * 
 * Phase 4B addition: 5-type dataset classification
 *   - inventory_count_sheet   (has count columns: system/physical/variation)
 *   - inventory_aging_sheet   (has aging buckets, no count columns)
 *   - mixed_inventory_sheet   (has both count + aging)
 *   - summary_sheet           (summary/dashboard sheets)
 *   - unknown_sheet           (insufficient structure detected)
 * 
 * Does NOT extract row data, validate values, or reject rows.
 */

import * as XLSX from "xlsx";
import {
  SheetStructure,
  ColumnMapping,
  DatasetType,
  COLUMN_ALIASES,
  INVENTORY_COUNT_FIELDS,
  INVENTORY_CORE_FIELDS,
} from "./types";

// ─── Aging Detection ────────────────────────────────────────────────────────

/**
 * Returns true if a column name matches an aging bucket pattern.
 */
export const isAgingColumn = (colName: string): boolean => {
  if (!colName) return false;
  const normalized = colName.toLowerCase().replace(/\s+/g, "");
  if (/\d+-\d+days/.test(normalized)) return true;
  if (/\d+days/.test(normalized)) return true;
  if (/\d+yr/.test(normalized)) return true;
  if (/year/.test(normalized)) return true;
  if (/aging/.test(normalized)) return true;
  if (/\d+\+yr/.test(normalized)) return true;
  if (/>\s*\d+/.test(normalized)) return true;
  const agingKeywords = ["days", "yr", "year", "aging", ">", "<"];
  if (agingKeywords.some(kw => normalized.includes(kw))) return true;
  return false;
};

// ─── Header Row Detection ───────────────────────────────────────────────────

/**
 * Finds the header row index by scanning up to 25 rows and counting
 * matches against standard column aliases.
 * Returns 0 if no row has ≥2 matches.
 */
export const findHeaderRow = (rawRows: unknown[][]): number => {
  let bestRowIndex = 0;
  let maxMatches = 0;
  const searchRows = Math.min(25, rawRows.length);

  for (let i = 0; i < searchRows; i++) {
    const row = rawRows[i];
    if (!row) continue;
    let matches = 0;
    for (const cell of row) {
      if (cell === null || cell === undefined) continue;
      const cellStr = cell.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      if (!cellStr) continue;
      const matchesAny = Object.values(COLUMN_ALIASES).some(aliases => aliases.includes(cellStr));
      if (matchesAny) matches++;
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestRowIndex = i;
    }
  }

  return maxMatches >= 2 ? bestRowIndex : 0;
};

// ─── Column Mapping ─────────────────────────────────────────────────────────

/**
 * Maps each header cell to a standard field, aging, or ignored classification.
 */
const buildColumnMap = (headerCells: unknown[]): ColumnMapping[] => {
  const map: ColumnMapping[] = [];

  for (let j = 0; j < headerCells.length; j++) {
    const cell = headerCells[j];
    if (cell === null || cell === undefined || cell.toString().trim() === "") {
      continue;
    }

    const rawColName = cell.toString();
    const normalized = rawColName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");

    // Check standard aliases
    let matchedField: string | null = null;
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(normalized)) {
        matchedField = field;
        break;
      }
    }

    if (matchedField) {
      map.push({
        columnIndex: j,
        sourceColumnName: rawColName,
        mappedField: matchedField,
        mappingType: "standard",
      });
    } else if (isAgingColumn(rawColName)) {
      map.push({
        columnIndex: j,
        sourceColumnName: rawColName,
        mappedField: null,
        mappingType: "aging",
      });
    } else {
      map.push({
        columnIndex: j,
        sourceColumnName: rawColName,
        mappedField: null,
        mappingType: "ignored",
      });
    }
  }

  return map;
};

// ─── Sheet Classification ───────────────────────────────────────────────────

/**
 * Determines the legacy sheetType (inventory, summary, unknown).
 */
const classifySheetLegacy = (sheetName: string, columnMap: ColumnMapping[]): SheetStructure["sheetType"] => {
  const standardMatchCount = columnMap.filter(c => c.mappingType === "standard").length;
  const isSummaryByName = sheetName.toLowerCase().includes("summary");

  // ≥3 standard columns always qualifies as inventory (overrides name heuristic)
  if (standardMatchCount >= 3) return "inventory_sheet";
  // ≥2 matches and not named "summary"
  if (standardMatchCount >= 2 && !isSummaryByName) return "inventory_sheet";
  // Named "summary" with <3 matches
  if (isSummaryByName) return "summary_sheet";

  return "unknown_sheet";
};

/**
 * Phase 4B: 5-type dataset classification.
 * Determines the precise dataset type based on which columns are present.
 */
const classifyDatasetType = (
  sheetName: string,
  columnMap: ColumnMapping[],
  legacyType: SheetStructure["sheetType"]
): DatasetType => {
  // Summary and unknown sheets pass through
  if (legacyType === "summary_sheet") return "summary_sheet";
  if (legacyType === "unknown_sheet") return "unknown_sheet";

  // For inventory sheets, check which field categories are present
  const mappedFields = new Set(
    columnMap
      .filter(c => c.mappingType === "standard" && c.mappedField)
      .map(c => c.mappedField!)
  );

  const hasCountFields = INVENTORY_COUNT_FIELDS.some(f => mappedFields.has(f));
  const hasAgingColumns = columnMap.some(c => c.mappingType === "aging");

  if (hasCountFields && hasAgingColumns) return "mixed_inventory_sheet";
  if (hasCountFields) return "inventory_count_sheet";
  if (hasAgingColumns) return "inventory_aging_sheet";

  // Has standard columns (item/desc/supplier etc) but no count or aging
  // Check if it looks like a summary by content
  const hasCoreFields = INVENTORY_CORE_FIELDS.some(f => mappedFields.has(f));
  if (hasCoreFields) return "inventory_aging_sheet"; // Default: item+desc+value with no count = likely aging

  return "unknown_sheet";
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Analyzes a single SheetJS WorkBook and returns structure metadata
 * for every sheet — header row index, column map, and classification.
 */
export const detectStructure = (workbook: XLSX.WorkBook): SheetStructure[] => {
  const structures: SheetStructure[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
    }) as unknown[][];

    if (rawRows.length === 0) continue;

    const headerRowIndex = findHeaderRow(rawRows);
    const headerCells = rawRows[headerRowIndex] || [];
    const columnMap = buildColumnMap(headerCells);
    const sheetType = classifySheetLegacy(sheetName, columnMap);
    const datasetType = classifyDatasetType(sheetName, columnMap, sheetType);
    const agingColumnIndices = columnMap
      .filter(c => c.mappingType === "aging")
      .map(c => c.columnIndex);

    structures.push({
      sheetName,
      sheetType,
      datasetType,
      headerRowIndex,
      totalRawRows: rawRows.length,
      columnMap,
      agingColumnIndices,
      rawRows,
      headerCells,
    });
  }

  return structures;
};
