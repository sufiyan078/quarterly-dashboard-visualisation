/**
 * Stage 4: Aging Extraction Engine
 * 
 * Detects and extracts aging bucket data from inventory sheets.
 * Aging data is kept SEPARATE from the main inventory dataset.
 * 
 * Supported buckets:
 *   1-30d, 31-60d, 61-90d, 91-180d, 181-365d,
 *   1yr, 2yr, 3yr, 4yr, 5-7yr, 7yr+
 */

import { AgingBucketRecord, AgingBucketKey, SheetStructure, ClassifiedRow } from "./types";

// ─── Bucket Normalization ───────────────────────────────────────────────────

/**
 * Attempts to map a raw aging column name to a standard bucket key.
 */
const normalizeBucketKey = (colName: string): AgingBucketKey | null => {
  const n = colName.toLowerCase().replace(/\s+/g, "");

  // Day-range patterns
  if (/1[-–]30/.test(n)) return "1_30d";
  if (/31[-–]60/.test(n)) return "31_60d";
  if (/61[-–]90/.test(n)) return "61_90d";
  if (/91[-–]180/.test(n)) return "91_180d";
  if (/181[-–]365/.test(n)) return "181_365d";

  // Year patterns
  if (/5[-–]7yr/.test(n) || /5[-–]7year/.test(n)) return "5_7yr";
  if (/7yr\+/.test(n) || /7\+yr/.test(n) || />7yr/.test(n) || /7yearplus/.test(n)) return "7yr_plus";
  if (/^1yr/.test(n) || /1year/.test(n)) return "1yr";
  if (/^2yr/.test(n) || /2year/.test(n)) return "2yr";
  if (/^3yr/.test(n) || /3year/.test(n)) return "3yr";
  if (/^4yr/.test(n) || /4year/.test(n)) return "4yr";

  return null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const cleanNum = (val: unknown): number | null => {
  if (val === null || val === undefined) return null;
  const strVal = String(val).trim();
  if (strVal === "") return null;
  const cleaned = strVal.replace(/[\s,A-Za-z$]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Extracts aging bucket data from a single sheet.
 * Only processes rows classified as "inventory_item".
 * Returns one AgingBucketRecord per inventory row that has ≥1 aging value.
 */
export const extractAgingData = (
  classifiedRows: ClassifiedRow[],
  sheet: SheetStructure,
  sourceFileName: string
): AgingBucketRecord[] => {
  const { rawRows, columnMap } = sheet;

  // Build aging column index → bucket key map
  const agingMap: { index: number; bucketKey: AgingBucketKey }[] = [];
  for (const col of columnMap) {
    if (col.mappingType === "aging") {
      const key = normalizeBucketKey(col.sourceColumnName);
      if (key) {
        agingMap.push({ index: col.columnIndex, bucketKey: key });
      }
    }
  }

  // No aging columns in this sheet
  if (agingMap.length === 0) return [];

  // Find the item code column index
  const itemCol = columnMap.find(c => c.mappedField === "item");
  const itemIdx = itemCol ? itemCol.columnIndex : -1;

  const inventoryRows = classifiedRows.filter(r => r.classification === "inventory_item");
  const records: AgingBucketRecord[] = [];

  for (const classified of inventoryRows) {
    const rowIndex = classified.originalRowNumber - 1;
    const rowData = rawRows[rowIndex];
    if (!rowData) continue;

    const itemCode = itemIdx >= 0 ? String(rowData[itemIdx] ?? "").trim() : "";
    if (!itemCode) continue; // Cannot key aging data without an item code

    const buckets: Partial<Record<AgingBucketKey, number>> = {};
    let hasBucket = false;

    for (const { index, bucketKey } of agingMap) {
      const val = cleanNum(rowData[index]);
      if (val !== null && val !== 0) {
        buckets[bucketKey] = val;
        hasBucket = true;
      }
    }

    if (hasBucket) {
      records.push({
        itemCode,
        sourceFileName,
        sheetName: classified.sheetName,
        originalRowNumber: classified.originalRowNumber,
        buckets,
      });
    }
  }

  return records;
};
