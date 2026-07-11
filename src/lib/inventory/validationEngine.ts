/**
 * Stage 6: Validation Engine
 * 
 * Runs after extraction. Flags data quality issues on extracted rows.
 * 
 * CRITICAL RULE: Validation flags issues for review.
 * It does NOT delete or reject rows. A row with 3 validation issues
 * is still an extracted inventory row — it just has 3 flags attached.
 * 
 * Phase 4B: Now dataset-type-aware.
 * - inventory_count_sheet   → full validation (requires system/physical counts)
 * - inventory_aging_sheet   → skip MISSING_BOTH_QUANTITIES (counts not expected)
 * - mixed_inventory_sheet   → full validation
 * - summary_sheet           → skip count validation
 * - unknown_sheet           → lenient validation
 */

import { ExtractedInventoryRow, ValidationIssue, DatasetType } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Check if a raw cell value was present but non-numeric */
const isInvalidNumericPresent = (rawVal: unknown): boolean => {
  if (rawVal === null || rawVal === undefined) return false;
  const strVal = String(rawVal).trim();
  if (strVal === "") return false;
  const cleaned = strVal.replace(/[\s,A-Za-z$]/g, "");
  return isNaN(Number(cleaned));
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Validates all extracted rows and attaches ValidationIssue[] to each.
 * 
 * @param rows      - Extracted inventory rows
 * @param datasetType - The sheet's dataset type (drives which rules apply)
 * 
 * Returns two convenience lists for the UI:
 *   - cleanRows: rows with 0 error-severity issues (→ "Imported")
 *   - reviewRows: rows with ≥1 error-severity issue (→ "Needs Review")
 */
export const validateRows = (
  rows: ExtractedInventoryRow[],
  datasetType: DatasetType = "inventory_count_sheet"
): { cleanRows: ExtractedInventoryRow[]; reviewRows: ExtractedInventoryRow[] } => {
  // Determine which rules apply based on dataset type
  const requiresCounts = datasetType === "inventory_count_sheet" || datasetType === "mixed_inventory_sheet";

  // Cross-sheet duplicate detection
  const globalItemCounts: Record<string, number> = {};
  for (const row of rows) {
    if (row.item) {
      globalItemCounts[row.item] = (globalItemCounts[row.item] || 0) + 1;
    }
  }

  const cleanRows: ExtractedInventoryRow[] = [];
  const reviewRows: ExtractedInventoryRow[] = [];

  for (const row of rows) {
    const issues: ValidationIssue[] = [];

    // 1. Missing item code
    if (!row.item) {
      issues.push({
        field: "item",
        severity: "warning",
        code: "MISSING_ITEM_CODE",
        message: "Missing item code",
      });
    }

    // 2. Missing description
    if (!row.description) {
      issues.push({
        field: "description",
        severity: "warning",
        code: "MISSING_DESCRIPTION",
        message: "Missing description",
      });
    }

    // 3. Missing supplier (after resolution)
    if (!row.resolvedSupplier || row.resolvedSupplier === "Others") {
      issues.push({
        field: "supplier",
        severity: "info",
        code: "MISSING_SUPPLIER",
        message: "No specific supplier detected",
      });
    }

    // 4. Missing org
    if (!row.org) {
      issues.push({
        field: "org",
        severity: "info",
        code: "MISSING_ORG",
        message: "Missing organization/unit",
      });
    }

    // 5. Invalid quantity (present but non-numeric) — only if count columns exist
    if (requiresCounts) {
      const sohRawKeys = Object.keys(row.rawRowData).filter(k => {
        const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        return ["systemonhand", "systemqty", "erp", "erpqty", "closingqty", "grandtotal", "onhand"].includes(norm);
      });
      if (sohRawKeys.some(k => isInvalidNumericPresent(row.rawRowData[k]))) {
        issues.push({
          field: "systemOnHand",
          severity: "error",
          code: "INVALID_QUANTITY",
          message: "System on hand contains invalid non-numeric value",
        });
      }

      const phyRawKeys = Object.keys(row.rawRowData).filter(k => {
        const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        return ["physicalcount", "phy", "countedqty", "actualqty"].includes(norm);
      });
      if (phyRawKeys.some(k => isInvalidNumericPresent(row.rawRowData[k]))) {
        issues.push({
          field: "physicalCount",
          severity: "error",
          code: "INVALID_QUANTITY",
          message: "Physical count contains invalid non-numeric value",
        });
      }
    }

    // 6. Invalid value (totalValueSar) — applies to all sheet types
    const valRawKeys = Object.keys(row.rawRowData).filter(k => {
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      return ["totalvalue", "value", "totalvaluesar", "inventoryvalue", "amount", "sarvalue"].includes(norm);
    });
    if (valRawKeys.some(k => isInvalidNumericPresent(row.rawRowData[k]))) {
      issues.push({
        field: "totalValueSar",
        severity: "warning",
        code: "INVALID_VALUE",
        message: "Total value (SAR) contains invalid non-numeric value",
      });
    }

    // 7. Duplicate item (same item code across sheets)
    if (row.item && globalItemCounts[row.item] > 1) {
      issues.push({
        field: "item",
        severity: "warning",
        code: "DUPLICATE_ITEM",
        message: `Item code "${row.item}" appears ${globalItemCounts[row.item]} times across sheets`,
      });
    }

    // 8. Unexpected blank fields (>50% of standard fields empty)
    const standardFields = [
      row.item, row.description, row.org, row.rawSupplier,
      row.totalValueSar !== null && row.totalValueSar !== 0 ? "has" : "",
    ];
    // Only include count fields in the blank check for count sheets
    if (requiresCounts) {
      standardFields.push(
        row.systemOnHand !== 0 ? "has" : "",
        row.physicalCount !== 0 ? "has" : ""
      );
    }
    const emptyCount = standardFields.filter(f => !f || f === "").length;
    if (emptyCount > Math.floor(standardFields.length / 2)) {
      issues.push({
        field: "row",
        severity: "warning",
        code: "UNEXPECTED_BLANK",
        message: "More than 50% of standard fields are empty",
      });
    }

    // 9. Missing both quantities — ONLY for count and mixed sheets
    if (requiresCounts) {
      const hasSystemVal = row.systemOnHand !== 0;
      const hasPhysicalVal = row.physicalCount !== 0;
      const sohRawKeys2 = Object.keys(row.rawRowData).filter(k => {
        const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        return ["systemonhand", "systemqty", "erp", "erpqty", "closingqty", "grandtotal", "onhand"].includes(norm);
      });
      const phyRawKeys2 = Object.keys(row.rawRowData).filter(k => {
        const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        return ["physicalcount", "phy", "countedqty", "actualqty"].includes(norm);
      });
      const sohAllEmpty = sohRawKeys2.length === 0 || sohRawKeys2.every(k => {
        const v = row.rawRowData[k];
        return v === null || v === undefined || String(v).trim() === "";
      });
      const phyAllEmpty = phyRawKeys2.length === 0 || phyRawKeys2.every(k => {
        const v = row.rawRowData[k];
        return v === null || v === undefined || String(v).trim() === "";
      });
      if (sohAllEmpty && phyAllEmpty && !hasSystemVal && !hasPhysicalVal) {
        issues.push({
          field: "quantities",
          severity: "error",
          code: "MISSING_BOTH_QUANTITIES",
          message: "Missing both system on hand and physical count",
        });
      }
    }

    // Attach issues to the row
    row.validationIssues = issues;

    // Split into clean vs review based on error-severity issues
    const hasErrors = issues.some(i => i.severity === "error");
    if (hasErrors) {
      reviewRows.push(row);
    } else {
      cleanRows.push(row);
    }
  }

  return { cleanRows, reviewRows };
};
