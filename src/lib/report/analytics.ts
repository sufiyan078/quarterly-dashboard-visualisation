import {
  computeDashboardMetrics,
  SupplierPerformance,
  CounterPerformance,
} from "@/lib/inventory/dashboardCalculations";
import { PreReportMetrics } from "@/lib/report/insightEngine";

/* ════════════════════════════════════════════════════════════════
   SHARED REPORT ANALYTICS — single source of truth
   One analytics object consumed by the Dashboard, the Pre-Report
   preview, and the final PDF report, so every KPI is calculated in
   exactly one place. Formulas below are the dashboard's own
   definitions, extracted verbatim — no new business logic.
   ════════════════════════════════════════════════════════════════ */

export interface DivisionQtyRow {
  division: string;
  physicalCount: number;
  systemOnHand: number;
  /** Physical Count − System On Hand (same as chart tooltip). */
  difference: number;
}

export interface AccuracyBreakdown {
  matchedCount: number;   // differenceQty === 0
  shortageCount: number;  // differenceQty < 0
  excessCount: number;    // differenceQty > 0
}

export interface ReportAnalytics {
  metrics: PreReportMetrics;

  /** Dashboard "Highest Coverage" card = divisions[0] (largest by ERP value). */
  highestCoverageDivision: { name: string; coverageRate: number } | null;

  /** Dashboard "Average Match Rate" = Σ matchedCount / Σ itemCount across suppliers. */
  avgSupplierMatchRate: number;

  /** Dashboard "Supplier Abs Variance" = Σ absoluteVarianceValue across suppliers. */
  supplierAbsVarianceTotal: number;

  /** Dashboard accuracy donut segments (item counts by discrepancy category). */
  accuracy: AccuracyBreakdown;

  /** Physical vs system quantities per division (chart + comparison table). */
  divisionQty: DivisionQtyRow[];

  /** All suppliers sorted by absolute variance DESC (dashboard ordering). */
  suppliersByVariance: SupplierPerformance[];

  /** Dashboard item ledger "Action Required" dataset: every non-closed item,
      sorted by absolute variance DESC. */
  actionItems: any[];
  actionRequiredCount: number;

  /** All active counters (dashboard renders every one — never sliced). */
  counters: CounterPerformance[];
}

export function buildReportAnalytics(formattedRows: any[], agingRecords: any[] = []): ReportAnalytics {
  const baseMetrics = computeDashboardMetrics(formattedRows, agingRecords);

  const matchedItems = formattedRows.filter(item => item.erpQty === item.physicalQty).length;
  const mismatchedItems = formattedRows.length - matchedItems;
  const matchRate = formattedRows.length > 0 ? (matchedItems / formattedRows.length) * 100 : 100;

  const metrics: PreReportMetrics = {
    ...baseMetrics,
    totalItems: baseMetrics.totalLines,
    matchRate,
    matchedItems,
    mismatchedItems,
    totalRiskValue: baseMetrics.totalFinancialRisk,
    healthScore: baseMetrics.inventoryHealthScore,
    netVariance: baseMetrics.varianceValue,
  };

  // ── Dashboard "Highest Coverage": divisions[0] (sorted by erpValue desc) ──
  const topDiv = metrics.divisions[0];
  const highestCoverageDivision = topDiv
    ? { name: topDiv.division, coverageRate: topDiv.coverageRate }
    : null;

  // ── Dashboard "Average Match Rate" (line-weighted across suppliers) ──
  const supMatched = metrics.suppliers.reduce((sum, s) => sum + s.matchedCount, 0);
  const supItems = metrics.suppliers.reduce((sum, s) => sum + s.itemCount, 0);
  const avgSupplierMatchRate = (supMatched / (supItems || 1)) * 100;

  const supplierAbsVarianceTotal = metrics.suppliers.reduce(
    (sum, s) => sum + s.absoluteVarianceValue, 0
  );

  // ── Accuracy breakdown (item counts by discrepancy category) ──
  let shortageCount = 0, excessCount = 0;
  const divQtyMap: Record<string, { phys: number; sys: number }> = {};

  for (const r of formattedRows) {
    const diff = r.differenceQty ?? 0;
    if (diff < 0) shortageCount++;
    else if (diff > 0) excessCount++;

    const div = (r.org || "Others").trim();
    if (!divQtyMap[div]) divQtyMap[div] = { phys: 0, sys: 0 };
    divQtyMap[div].phys += r.physicalQty ?? 0;
    divQtyMap[div].sys += r.erpQty ?? 0;
  }

  const divisionQty: DivisionQtyRow[] = Object.entries(divQtyMap)
    .map(([division, v]) => ({
      division,
      physicalCount: v.phys,
      systemOnHand: v.sys,
      difference: v.phys - v.sys,
    }))
    .sort((a, b) => b.systemOnHand - a.systemOnHand);

  const suppliersByVariance = [...metrics.suppliers]
    .sort((a, b) => b.absoluteVarianceValue - a.absoluteVarianceValue);

  // ── Dashboard item ledger: Action Required = every non-closed item ──
  const actionItems = formattedRows
    .filter((i) => i.status !== "closed")
    .sort((a, b) => (b.absoluteVarianceValue ?? 0) - (a.absoluteVarianceValue ?? 0));

  return {
    metrics,
    highestCoverageDivision,
    avgSupplierMatchRate,
    supplierAbsVarianceTotal,
    accuracy: { matchedCount: matchedItems, shortageCount, excessCount },
    divisionQty,
    suppliersByVariance,
    actionItems,
    actionRequiredCount: actionItems.length,
    counters: metrics.counters,
  };
}

/* ════════════════════════════════════════════════════════════════
   PRE-GENERATION CONSISTENCY VALIDATION
   Cross-checks the analytics object before PDF export. Any failure
   blocks generation with a human-readable description, guaranteeing
   the report can never contradict the dashboard.
   ════════════════════════════════════════════════════════════════ */

export function validateReportAnalytics(a: ReportAnalytics): string[] {
  const errors: string[] = [];
  const m = a.metrics;

  const sumDivValue = m.divisions.reduce((s, d) => s + d.erpValue, 0);
  if (Math.abs(sumDivValue - m.totalInventoryValue) > 10) {
    errors.push(
      `Division totals (SAR ${Math.round(sumDivValue).toLocaleString("en-US")}) do not reconcile with total inventory value (SAR ${Math.round(m.totalInventoryValue).toLocaleString("en-US")}).`
    );
  }

  const sumSupplierItems = m.suppliers.reduce((s, x) => s + x.itemCount, 0);
  if (sumSupplierItems !== m.totalLines) {
    errors.push(
      `Supplier line totals (${sumSupplierItems.toLocaleString("en-US")}) do not reconcile with total inventory lines (${m.totalLines.toLocaleString("en-US")}).`
    );
  }

  const calculatedNet = m.totalExcessValue + m.totalShortageValue;
  if (Math.abs(m.netVariance - calculatedNet) > 10) {
    errors.push(
      `Net variance (${m.netVariance.toLocaleString("en-US")}) does not equal excess + shortage (${calculatedNet.toLocaleString("en-US")}).`
    );
  }

  const accTotal = a.accuracy.matchedCount + a.accuracy.shortageCount + a.accuracy.excessCount;
  if (accTotal !== m.totalLines) {
    errors.push(
      `Accuracy breakdown categories (${accTotal.toLocaleString("en-US")}) do not sum to total lines (${m.totalLines.toLocaleString("en-US")}).`
    );
  }

  if (a.actionRequiredCount !== a.actionItems.length) {
    errors.push(
      `Action Required count (${a.actionRequiredCount}) does not match the action item dataset (${a.actionItems.length}).`
    );
  }

  for (let i = 1; i < a.suppliersByVariance.length; i++) {
    if (a.suppliersByVariance[i].absoluteVarianceValue > a.suppliersByVariance[i - 1].absoluteVarianceValue) {
      errors.push("Supplier variance ordering is not sorted descending.");
      break;
    }
  }

  return errors;
}
