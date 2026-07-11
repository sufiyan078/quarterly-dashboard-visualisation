import { ParsedInventoryRow } from "@/types/inventory";

export interface ComputedInventoryRow extends ParsedInventoryRow {
  itemCode: string;
  differenceQty: number;
  absoluteDifferenceQty: number;
  unitCost: number;
  erpValue: number;
  physicalValue: number;
  varianceValue: number;
  absoluteVarianceValue: number;
  issueCategory: "Quantity Match" | "Shortage" | "Excess";
  validationWarnings: string[];
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
  status: "open" | "pending" | "closed" | "needs_review";
}

export interface InventoryCalculationSummary {
  totalItems: number;
  matchedItems: number;
  mismatchedItems: number;
  shortageItemsCount: number;
  excessItemsCount: number;
  matchRate: number; // matchedItems / totalItems
  mismatchRate: number; // mismatchedItems / totalItems
  shortagePercentage: number; // shortageItems / totalItems
  excessPercentage: number; // excessItems / totalItems
  totalShortageValue: number;
  totalExcessValue: number;
  netVariance: number;
  totalErpValue: number;
  totalPhysicalValue: number;
}

/**
 * Computes individual row metrics (quantities, fallback unit cost, variances, issue categories)
 * for a list of parsed inventory rows.
 */
export function computeRowMetrics(
  rows: ParsedInventoryRow[],
  companyId: string,
  reportId: string
): ComputedInventoryRow[] {
  // Step 1: Build a map of item code -> unit cost for items that have systemOnHand > 0 and totalValueSar > 0
  const itemCostMap: Record<string, number> = {};
  for (const row of rows) {
    const itemCode = (row.item || "").trim();
    if (itemCode && row.systemOnHand > 0 && row.totalValueSar !== null && row.totalValueSar > 0) {
      itemCostMap[itemCode] = row.totalValueSar / row.systemOnHand;
    }
  }

  // Step 2: Compute metrics for each row
  return rows.map((row) => {
    const itemCode = (row.item || "").trim();
    const erpQty = row.systemOnHand || 0;
    const physicalQty = row.physicalCount || 0;
    const differenceQty = physicalQty - erpQty;
    const absoluteDifferenceQty = Math.abs(differenceQty);

    // Determine unit cost (with fallback mapping if systemOnHand is 0)
    let unitCost = 0;
    if (erpQty > 0 && row.totalValueSar !== null && row.totalValueSar > 0) {
      unitCost = row.totalValueSar / erpQty;
    } else if (itemCode && itemCostMap[itemCode] !== undefined) {
      unitCost = itemCostMap[itemCode];
    } else if (row.totalValueSar !== null && row.totalValueSar > 0 && erpQty === 0) {
      // In cases where systemOnHand is 0 but there is totalValueSar, we can't do totalValueSar / erpQty.
      // But if there is a unit cost in the workbook we'd use it, or fallback. Let's use totalValueSar if
      // physical qty is > 0 and it represents unit value? No, let's keep unitCost as 0 unless found.
      unitCost = 0;
    }

    const erpValue = erpQty * unitCost;
    const physicalValue = physicalQty * unitCost;
    const varianceValue = physicalValue - erpValue; // differenceQty * unitCost
    const absoluteVarianceValue = Math.abs(varianceValue);

    let issueCategory: "Quantity Match" | "Shortage" | "Excess" = "Quantity Match";
    if (differenceQty < 0) {
      issueCategory = "Shortage";
    } else if (differenceQty > 0) {
      issueCategory = "Excess";
    }

    // Capture validation issues
    const validationWarnings: string[] = [];
    if (!itemCode) {
      validationWarnings.push("Missing item code");
    }
    if (!row.description) {
      validationWarnings.push("Missing description");
    }
    if (!row.supplier || row.supplier.toLowerCase() === "others") {
      validationWarnings.push("Supplier classified as Others");
    }
    if (!row.org) {
      validationWarnings.push("Missing organization/unit");
    }

    const statusVal = differenceQty === 0 && validationWarnings.length === 0 ? "closed" : "open";

    return {
      ...row,
      itemCode,
      differenceQty,
      absoluteDifferenceQty,
      unitCost,
      erpValue,
      physicalValue,
      varianceValue,
      absoluteVarianceValue,
      issueCategory,
      validationWarnings,
      companyId: companyId || "",
      reportId: reportId || "",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: statusVal
    } as ComputedInventoryRow;
  });
}

/**
 * Aggregates computed rows to build a calculation summary for the report.
 */
export function calculateInventorySummary(
  computedRows: ComputedInventoryRow[]
): InventoryCalculationSummary {
  const totalItems = computedRows.length;
  let matchedItems = 0;
  let mismatchedItems = 0;
  let shortageItemsCount = 0;
  let excessItemsCount = 0;
  let totalShortageValue = 0;
  let totalExcessValue = 0;
  let totalErpValue = 0;
  let totalPhysicalValue = 0;

  for (const row of computedRows) {
    totalErpValue += row.erpValue;
    totalPhysicalValue += row.physicalValue;

    if (row.differenceQty === 0) {
      matchedItems++;
    } else {
      mismatchedItems++;
      if (row.differenceQty < 0) {
        shortageItemsCount++;
        totalShortageValue += row.varianceValue; // negative value
      } else {
        excessItemsCount++;
        totalExcessValue += row.varianceValue; // positive value
      }
    }
  }

  const matchPercentage = totalItems > 0 ? (matchedItems / totalItems) * 100 : 100;
  const mismatchPercentage = totalItems > 0 ? (mismatchedItems / totalItems) * 100 : 0;
  const shortagePercentage = totalItems > 0 ? (shortageItemsCount / totalItems) * 100 : 0;
  const excessPercentage = totalItems > 0 ? (excessItemsCount / totalItems) * 100 : 0;
  const netVariance = totalExcessValue + totalShortageValue;

  return {
    totalItems,
    matchedItems,
    mismatchedItems,
    shortageItemsCount,
    excessItemsCount,
    matchRate: parseFloat(matchPercentage.toFixed(2)),
    mismatchRate: parseFloat(mismatchPercentage.toFixed(2)),
    shortagePercentage: parseFloat(shortagePercentage.toFixed(2)),
    excessPercentage: parseFloat(excessPercentage.toFixed(2)),
    totalShortageValue: parseFloat(totalShortageValue.toFixed(2)),
    totalExcessValue: parseFloat(totalExcessValue.toFixed(2)),
    netVariance: parseFloat(netVariance.toFixed(2)),
    totalErpValue: parseFloat(totalErpValue.toFixed(2)),
    totalPhysicalValue: parseFloat(totalPhysicalValue.toFixed(2)),
  };
}
