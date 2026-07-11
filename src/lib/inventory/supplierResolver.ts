/**
 * Supplier Resolver
 * 
 * Handles supplier detection with a priority fallback chain:
 *   1. Direct value from supplier column
 *   2. Source file name keyword matching
 *   3. Description keyword matching
 *   4. Fallback: "Others"
 * 
 * Separated from extraction so it can be re-run independently.
 */

import { ExtractedInventoryRow, SUPPLIER_KEYWORDS } from "./types";

// ─── Core Detection ─────────────────────────────────────────────────────────

/**
 * Detects the supplier for a single row using the priority chain.
 */
export const detectSupplier = (
  rawSupplier: string | null | undefined,
  description: string,
  fileName: string
): { supplierName: string; method: string } => {
  // 1. Direct supplier column value
  if (rawSupplier && rawSupplier.trim() !== "") {
    const cleaned = rawSupplier.trim();
    const lower = cleaned.toLowerCase();
    if (lower !== "others" && lower !== "other" && lower !== "unknown" && lower !== "n/a") {
      return { supplierName: cleaned, method: "direct_supplier_name" };
    }
  }

  // 2. Source file name matching
  const fileLower = fileName.toLowerCase();
  for (const [supplierName, keywords] of Object.entries(SUPPLIER_KEYWORDS)) {
    if (keywords.some(kw => fileLower.includes(kw))) {
      return { supplierName, method: "source_file_name" };
    }
  }

  // 3. Description keyword matching
  const descLower = description.toLowerCase();
  for (const [supplierName, keywords] of Object.entries(SUPPLIER_KEYWORDS)) {
    if (keywords.some(kw => descLower.includes(kw))) {
      return { supplierName, method: "description_match" };
    }
  }

  // 4. Fallback
  return { supplierName: "Others", method: "unmatched_others" };
};

// ─── Batch Resolution ───────────────────────────────────────────────────────

/**
 * Resolves supplier names for all extracted rows in-place.
 * Mutates the `resolvedSupplier` and `supplierDetectionMethod` fields.
 */
export const resolveSuppliers = (rows: ExtractedInventoryRow[]): void => {
  for (const row of rows) {
    const { supplierName, method } = detectSupplier(
      row.rawSupplier || null,
      row.description,
      row.sourceFileName
    );
    row.resolvedSupplier = supplierName;
    row.supplierDetectionMethod = method;
  }
};
