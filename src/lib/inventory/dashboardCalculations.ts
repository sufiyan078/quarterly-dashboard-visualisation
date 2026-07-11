import { ComputedInventoryRow } from "./calculations";

export interface DivisionPerformance {
  division: string;
  erpValue: number;
  erpQty: number;
  itemCount: number;
  matchedCount: number;
  matchingRate: number;
  verifiedValue: number;
  varianceValue: number;
  coverageRate: number;
}

export interface SubDivisionPerformance {
  subDivision: string;
  erpValue: number;
  erpQty: number;
  itemCount: number;
  matchedCount: number;
  matchingRate: number;
  verifiedValue: number;
  varianceValue: number;
  coverageRate: number;
}

export interface SupplierPerformance {
  supplier: string;
  erpValue: number;
  erpQty: number;
  itemCount: number;
  matchedCount: number;
  matchingRate: number;
  verifiedValue: number;
  varianceValue: number;
  absoluteVarianceValue: number;
  coverageRate: number;
}

export interface AgingBucketSummary {
  range1_2yr: number; // 1yr
  range2_3yr: number; // 2yr
  range3_4yr: number; // 3yr
  range4_5yr: number; // 4yr
  range5_7yr: number; // 5_7yr
  rangeOver7yr: number; // 7yr_plus
  totalAgedValue: number;
  agingPercentage: number;
  slowMovingValue: number; // 1-3 years
  deadStockValue: number; // 3+ years
  provisionAmount: number;
}

export interface CounterPerformance {
  name: string;
  itemsCounted: number;
  verifiedQty: number;
  verifiedValue: number;
  productivityRate: number;
  accuracyRate: number;
}

export interface DashboardMetrics {
  // Section 1: Executive Summary
  totalInventoryValue: number;
  totalQuantity: number;
  totalLines: number;
  verifiedValue: number;
  verifiedQuantity: number;
  coverageRate: number;
  inventoryHealthScore: number;
  inventoryHealthStatus: string;
  totalFinancialRisk: number;
  provisionAmount: number;
  varianceValue: number;
  totalShortageValue: number;
  totalExcessValue: number;

  // Section 2 & 3: Division & Sub-Division Performance
  divisions: DivisionPerformance[];
  subDivisions: SubDivisionPerformance[];

  // Section 4: Supplier Performance
  suppliers: SupplierPerformance[];

  // Section 5: External Audit Performance
  sampleCount: number;
  auditCoverageRate: number;
  auditConclusion: string;

  // Section 6: Inventory Aging
  aging: AgingBucketSummary;

  // Section 7: Stock Count Performance
  verifiedLines: number;
  remainingLines: number;

  // Section 8: Individual Performance
  counters: CounterPerformance[];

  // Section 10: Financial Risk details
  highestRiskDivision: string;
  highestRiskSupplier: string;
  highestRiskItems: any[];
}

export function computeDashboardMetrics(
  computedRows: any[],
  agingRecords: any[] = []
): DashboardMetrics {
  const totalLines = computedRows.length;
  let totalInventoryValue = 0;
  let totalQuantity = 0;
  let verifiedValue = 0;
  let verifiedQuantity = 0;
  let totalFinancialRisk = 0; // sum of absolute variance values
  let totalShortageValue = 0;
  let totalExcessValue = 0;
  let varianceValue = 0;
  let matchedLines = 0;
  let pendingLines = 0;

  // Group mappings
  const divisionMap: Record<string, any[]> = {};
  const subDivisionMap: Record<string, any[]> = {};
  const supplierMap: Record<string, any[]> = {};
  const counterMap: Record<string, any[]> = {};

  for (const row of computedRows) {
    totalInventoryValue += row.erpValue;
    totalQuantity += row.erpQty;

    // Verified: physical count matches erpQty, capped to avoid coverage > 100%
    const itemVerifiedQty = Math.min(row.erpQty, row.physicalQty);
    verifiedQuantity += itemVerifiedQty;
    verifiedValue += itemVerifiedQty * row.unitCost;

    totalFinancialRisk += row.absoluteVarianceValue;

    if (row.varianceValue < 0) {
      totalShortageValue += Math.abs(row.varianceValue);
    } else {
      totalExcessValue += row.varianceValue;
    }
    varianceValue += row.varianceValue;

    if (row.differenceQty === 0) {
      matchedLines++;
    }
    if (row.status === "open") {
      pendingLines++;
    }

    // Grouping
    const div = (row.org || "Others").trim();
    if (!divisionMap[div]) divisionMap[div] = [];
    divisionMap[div].push(row);

    const subDiv = (row.sheetName || "Sheet 1").trim();
    if (!subDivisionMap[subDiv]) subDivisionMap[subDiv] = [];
    subDivisionMap[subDiv].push(row);

    const supp = (row.supplier || "Others").trim();
    if (!supplierMap[supp]) supplierMap[supp] = [];
    supplierMap[supp].push(row);

    // Counter names
    const counterName = (row.reported || "").trim();
    if (counterName && counterName.toLowerCase() !== "unknown") {
      if (!counterMap[counterName]) counterMap[counterName] = [];
      counterMap[counterName].push(row);
    }
  }

  // 1. Division Calculations
  const divisions = Object.entries(divisionMap).map(([divName, rows]) => {
    let divErpValue = 0;
    let divErpQty = 0;
    let divVerifiedValue = 0;
    let divVarianceValue = 0;
    let divMatched = 0;

    for (const r of rows) {
      divErpValue += r.erpValue;
      divErpQty += r.erpQty;
      const vQty = Math.min(r.erpQty, r.physicalQty);
      divVerifiedValue += vQty * r.unitCost;
      divVarianceValue += r.varianceValue;
      if (r.differenceQty === 0) divMatched++;
    }

    return {
      division: divName,
      erpValue: parseFloat(divErpValue.toFixed(2)),
      erpQty: divErpQty,
      itemCount: rows.length,
      matchedCount: divMatched,
      matchingRate: rows.length > 0 ? parseFloat(((divMatched / rows.length) * 100).toFixed(2)) : 100,
      verifiedValue: parseFloat(divVerifiedValue.toFixed(2)),
      varianceValue: parseFloat(divVarianceValue.toFixed(2)),
      coverageRate: divErpValue > 0 ? parseFloat(((divVerifiedValue / divErpValue) * 100).toFixed(2)) : 100,
    };
  }).sort((a, b) => b.erpValue - a.erpValue);

  // 2. Sub-Division Calculations
  const subDivisions = Object.entries(subDivisionMap).map(([subName, rows]) => {
    let subErpValue = 0;
    let subErpQty = 0;
    let subVerifiedValue = 0;
    let subVarianceValue = 0;
    let subMatched = 0;

    for (const r of rows) {
      subErpValue += r.erpValue;
      subErpQty += r.erpQty;
      const vQty = Math.min(r.erpQty, r.physicalQty);
      subVerifiedValue += vQty * r.unitCost;
      subVarianceValue += r.varianceValue;
      if (r.differenceQty === 0) subMatched++;
    }

    return {
      subDivision: subName,
      erpValue: parseFloat(subErpValue.toFixed(2)),
      erpQty: subErpQty,
      itemCount: rows.length,
      matchedCount: subMatched,
      matchingRate: rows.length > 0 ? parseFloat(((subMatched / rows.length) * 100).toFixed(2)) : 100,
      verifiedValue: parseFloat(subVerifiedValue.toFixed(2)),
      varianceValue: parseFloat(subVarianceValue.toFixed(2)),
      coverageRate: subErpValue > 0 ? parseFloat(((subVerifiedValue / subErpValue) * 100).toFixed(2)) : 100,
    };
  }).sort((a, b) => b.erpValue - a.erpValue);

  // 3. Supplier Calculations
  const suppliers = Object.entries(supplierMap).map(([suppName, rows]) => {
    let suppErpValue = 0;
    let suppErpQty = 0;
    let suppVerifiedValue = 0;
    let suppVarianceValue = 0;
    let suppAbsVarianceValue = 0;
    let suppMatched = 0;

    for (const r of rows) {
      suppErpValue += r.erpValue;
      suppErpQty += r.erpQty;
      const vQty = Math.min(r.erpQty, r.physicalQty);
      suppVerifiedValue += vQty * r.unitCost;
      suppVarianceValue += r.varianceValue;
      suppAbsVarianceValue += r.absoluteVarianceValue;
      if (r.differenceQty === 0) suppMatched++;
    }

    return {
      supplier: suppName,
      erpValue: parseFloat(suppErpValue.toFixed(2)),
      erpQty: suppErpQty,
      itemCount: rows.length,
      matchedCount: suppMatched,
      matchingRate: rows.length > 0 ? parseFloat(((suppMatched / rows.length) * 100).toFixed(2)) : 100,
      verifiedValue: parseFloat(suppVerifiedValue.toFixed(2)),
      varianceValue: parseFloat(suppVarianceValue.toFixed(2)),
      absoluteVarianceValue: parseFloat(suppAbsVarianceValue.toFixed(2)),
      coverageRate: suppErpValue > 0 ? parseFloat(((suppVerifiedValue / suppErpValue) * 100).toFixed(2)) : 100,
    };
  }).sort((a, b) => b.erpValue - a.erpValue);

  // 4. Aging Calculations
  let range1_2yr = 0;
  let range2_3yr = 0;
  let range3_4yr = 0;
  let range4_5yr = 0;
  let range5_7yr = 0;
  let rangeOver7yr = 0;

  for (const record of agingRecords) {
    if (record.buckets) {
      range1_2yr += record.buckets["1yr"] || 0;
      range2_3yr += record.buckets["2yr"] || 0;
      range3_4yr += record.buckets["3yr"] || 0;
      range4_5yr += record.buckets["4yr"] || 0;
      range5_7yr += record.buckets["5_7yr"] || 0;
      rangeOver7yr += record.buckets["7yr_plus"] || 0;
    }
  }

  const totalAgedValue = range1_2yr + range2_3yr + range3_4yr + range4_5yr + range5_7yr + rangeOver7yr;
  const agingPercentage = totalInventoryValue > 0 ? parseFloat(((totalAgedValue / totalInventoryValue) * 100).toFixed(2)) : 0;
  const slowMovingValue = range1_2yr + range2_3yr;
  const deadStockValue = range3_4yr + range4_5yr + range5_7yr + rangeOver7yr;

  // Provisioning rule: 1-2yr: 25%, 2-3yr: 50%, 3+yr: 100%
  const provisionAmount = parseFloat(
    (range1_2yr * 0.25 + range2_3yr * 0.50 + deadStockValue * 1.00).toFixed(2)
  );

  const agingSummary: AgingBucketSummary = {
    range1_2yr: parseFloat(range1_2yr.toFixed(2)),
    range2_3yr: parseFloat(range2_3yr.toFixed(2)),
    range3_4yr: parseFloat(range3_4yr.toFixed(2)),
    range4_5yr: parseFloat(range4_5yr.toFixed(2)),
    range5_7yr: parseFloat(range5_7yr.toFixed(2)),
    rangeOver7yr: parseFloat(rangeOver7yr.toFixed(2)),
    totalAgedValue: parseFloat(totalAgedValue.toFixed(2)),
    agingPercentage,
    slowMovingValue: parseFloat(slowMovingValue.toFixed(2)),
    deadStockValue: parseFloat(deadStockValue.toFixed(2)),
    provisionAmount,
  };

  // 5. Stock Count Performance Lines
  const verifiedLines = computedRows.filter(r => r.physicalQty > 0).length;
  const remainingLines = totalLines - verifiedLines;

  // 6. Individual Performance
  const counters = Object.entries(counterMap).map(([cName, rows]) => {
    let cVerifiedQty = 0;
    let cVerifiedValue = 0;
    let cMatched = 0;

    for (const r of rows) {
      cVerifiedQty += r.physicalQty;
      cVerifiedValue += r.physicalValue;
      if (r.differenceQty === 0) cMatched++;
    }

    return {
      name: cName,
      itemsCounted: rows.length,
      verifiedQty: cVerifiedQty,
      verifiedValue: parseFloat(cVerifiedValue.toFixed(2)),
      productivityRate: totalLines > 0 ? parseFloat(((rows.length / totalLines) * 100).toFixed(2)) : 0,
      accuracyRate: rows.length > 0 ? parseFloat(((cMatched / rows.length) * 100).toFixed(2)) : 100,
    };
  }).sort((a, b) => b.itemsCounted - a.itemsCounted);

  // 7. Executive Summaries & Conclusions
  const coverageRate = totalInventoryValue > 0 ? parseFloat(((verifiedValue / totalInventoryValue) * 100).toFixed(2)) : 100;
  const matchRate = totalLines > 0 ? (matchedLines / totalLines) * 100 : 100;

  // Inventory Health Score
  // Start with 100, apply penalties:
  // - Match Rate deficiency: 40% weight
  // - Coverage Rate deficiency: 30% weight
  // - Financial Risk relative to Inventory Value: max 15 points penalty
  // - Pending items rate: max 10 points penalty
  // - Aging provision rate relative to Inventory Value: max 5 points penalty
  const riskRatio = totalInventoryValue > 0 ? totalFinancialRisk / totalInventoryValue : 0;
  const pendingRatio = totalLines > 0 ? pendingLines / totalLines : 0;
  const provisionRatio = totalInventoryValue > 0 ? provisionAmount / totalInventoryValue : 0;

  const matchPenalty = (100 - matchRate) * 0.40;
  const coveragePenalty = (100 - coverageRate) * 0.30;
  const riskPenalty = Math.min(15, riskRatio * 15 * 5); // scales up quickly if risk is substantial
  const pendingPenalty = pendingRatio * 10;
  const provisionPenalty = Math.min(5, provisionRatio * 5 * 5);

  const inventoryHealthScore = Math.max(0, Math.min(100, parseFloat(
    (100 - (matchPenalty + coveragePenalty + riskPenalty + pendingPenalty + provisionPenalty)).toFixed(1)
  )));

  let inventoryHealthStatus = "Critical";
  if (inventoryHealthScore >= 95) inventoryHealthStatus = "Excellent";
  else if (inventoryHealthScore >= 85) inventoryHealthStatus = "Good";
  else if (inventoryHealthScore >= 70) inventoryHealthStatus = "Average";
  else if (inventoryHealthScore >= 50) inventoryHealthStatus = "Needs Attention";

  // Section 5 External Audit Conclusion
  let auditConclusion = "Adverse Opinion - Material discrepancy detected between physical inventory and ledger records.";
  if (coverageRate >= 98 && matchRate >= 95) {
    auditConclusion = "Unqualified (Clean) Opinion - The physical inventory count matches the ledger with high accuracy and minimal discrepancy.";
  } else if (coverageRate >= 90) {
    auditConclusion = "Qualified Opinion - The physical inventory count is generally accurate, with minor variance observed.";
  }

  // Section 10 Highest Risk details
  const highestRiskDivision = divisions.length > 0
    ? divisions.reduce((max, d) => Math.abs(d.varianceValue) > Math.abs(max.varianceValue) ? d : max, divisions[0]).division
    : "None";

  const highestRiskSupplier = suppliers.length > 0
    ? suppliers.reduce((max, s) => s.absoluteVarianceValue > max.absoluteVarianceValue ? s : max, suppliers[0]).supplier
    : "None";

  const seenItems = new Set<string>();
  const distinctRiskItems: any[] = [];
  const sortedRows = [...computedRows].sort((a, b) => b.absoluteVarianceValue - a.absoluteVarianceValue);
  for (const row of sortedRows) {
    const key = `${row.itemCode || ""}-${row.org || ""}`;
    if (!seenItems.has(key)) {
      seenItems.add(key);
      distinctRiskItems.push(row);
    }
  }
  const highestRiskItems = distinctRiskItems.slice(0, 10);

  return {
    totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2)),
    totalQuantity,
    totalLines,
    verifiedValue: parseFloat(verifiedValue.toFixed(2)),
    verifiedQuantity,
    coverageRate,
    inventoryHealthScore,
    inventoryHealthStatus,
    totalFinancialRisk: parseFloat(totalFinancialRisk.toFixed(2)),
    provisionAmount,
    varianceValue: parseFloat(varianceValue.toFixed(2)),
    totalShortageValue: parseFloat(totalShortageValue.toFixed(2)),
    totalExcessValue: parseFloat(totalExcessValue.toFixed(2)),
    divisions,
    subDivisions,
    suppliers,
    sampleCount: totalLines,
    auditCoverageRate: coverageRate,
    auditConclusion,
    aging: agingSummary,
    verifiedLines,
    remainingLines,
    counters,
    highestRiskDivision,
    highestRiskSupplier,
    highestRiskItems,
  };
}
