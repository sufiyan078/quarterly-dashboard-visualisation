import { DashboardMetrics } from "@/lib/inventory/dashboardCalculations";

/* ════════════════════════════════════════════════════════════════
   EXECUTIVE NARRATIVE / INSIGHT ENGINE
   Rule-based generation of business commentary, insights, risks,
   opportunities, and recommendations for the executive report.

   HARD CONSTRAINTS:
   - Never modifies or recalculates any KPI: it only reads values
     already produced by computeDashboardMetrics and the raw rows.
   - Every generated statement is gated on an explicit data
     threshold; if the supporting evidence does not exist the
     statement (or the whole risk/recommendation) is not emitted.
   ════════════════════════════════════════════════════════════════ */

export type Priority = "Critical" | "High" | "Medium" | "Low";

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  benefit: string;
  priority: Priority;
}

export interface RiskFinding {
  id: string;
  title: string;
  level: Priority;
  impact: string;
  explanation: string;
  action: string;
}

export interface Opportunity {
  id: string;
  title: string;
  detail: string;
}

export interface SectionNarrative {
  commentary: string;
  insights: string[];
  recommendations: Recommendation[];
}

export interface ExecutiveConclusion {
  paragraphs: string[];
  overallAssessment: string;
}

export interface ValidationStats {
  totalLines: number;
  flaggedLines: number;
  missingCodeCount: number;
  missingDescCount: number;
  missingOrgCount: number;
  unclassifiedSupplierCount: number;
}

export interface ReportNarrative {
  executiveSummary: string;
  overview: SectionNarrative;
  financial: SectionNarrative;
  health: SectionNarrative;
  organizations: SectionNarrative;
  suppliers: SectionNarrative;
  distribution: SectionNarrative;
  validation: SectionNarrative;
  validationStats: ValidationStats;
  risks: RiskFinding[];
  opportunities: Opportunity[];
  consolidatedRecommendations: Recommendation[];
  conclusion: ExecutiveConclusion;
}

/** Metrics shape used by the pre-report page (DashboardMetrics + aliases). */
export interface PreReportMetrics extends DashboardMetrics {
  totalItems: number;
  matchRate: number;
  matchedItems: number;
  mismatchedItems: number;
  totalRiskValue: number;
  healthScore: number;
  netVariance: number;
}

export interface NarrativeInput {
  quarter: string;
  year: number | string;
  clientName: string;
  location: string;
  metrics: PreReportMetrics;
  /** Formatted rows (as prepared by the pre-report page) — used only
      to aggregate validation-flag counts that already exist per row. */
  rows: any[];
}

/* ─── Derived presentation statistics (ratios of existing KPIs) ─── */
interface DerivedStats {
  orgCount: number;
  supplierCount: number;
  topDivisionName: string;
  topDivisionShare: number; // % of total ERP value
  topSupplierName: string;
  topSupplierShare: number; // % of total ERP value
  top3SupplierShare: number;
  othersSupplierLines: number;
  avgItemValue: number;
  valuationCoverage: number; // % of lines with a unit cost > 0
  zeroValueLines: number;
  warningLines: number;
  warningRate: number; // % of lines with >= 1 validation warning
  missingCodeCount: number;
  missingDescCount: number;
  missingOrgCount: number;
  unclassifiedSupplierCount: number;
  riskRatio: number; // financial risk / inventory value (%)
  hasAgingData: boolean;
}

const pct = (num: number, den: number): number =>
  den > 0 ? (num / den) * 100 : 0;

export const fmtSAR = (n: number): string =>
  `SAR ${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export const fmtPct = (n: number, digits = 1): string =>
  `${n.toFixed(digits)}%`;

function deriveStats(m: PreReportMetrics, rows: any[]): DerivedStats {
  const totalValue = m.totalInventoryValue;

  const topDivision = m.divisions[0]; // already sorted by erpValue desc
  const suppliersByValue = [...m.suppliers].sort((a, b) => b.erpValue - a.erpValue);
  const topSupplier = suppliersByValue[0];
  const top3Value = suppliersByValue.slice(0, 3).reduce((s, x) => s + x.erpValue, 0);

  let zeroValueLines = 0;
  let warningLines = 0;
  let missingCodeCount = 0;
  let missingDescCount = 0;
  let missingOrgCount = 0;
  let unclassifiedSupplierCount = 0;
  let valuedLines = 0;

  for (const r of rows) {
    if ((r.unitCost || 0) > 0) valuedLines++;
    else if ((r.erpQty || 0) > 0) zeroValueLines++;

    const warnings: string[] = Array.isArray(r.validationWarnings) ? r.validationWarnings : [];
    if (warnings.length > 0) warningLines++;
    for (const w of warnings) {
      const lw = String(w).toLowerCase();
      if (lw.includes("item code")) missingCodeCount++;
      else if (lw.includes("description")) missingDescCount++;
      else if (lw.includes("organization") || lw.includes("unit")) missingOrgCount++;
      else if (lw.includes("supplier")) unclassifiedSupplierCount++;
    }
    if (!warnings.length && (r.supplier === "Others" || !r.supplier)) {
      unclassifiedSupplierCount++;
    }
  }

  const othersSupplierLines = m.suppliers.find(
    (s) => s.supplier.toLowerCase() === "others"
  )?.itemCount ?? 0;

  return {
    orgCount: m.divisions.length,
    supplierCount: m.suppliers.length,
    topDivisionName: topDivision?.division ?? "",
    topDivisionShare: topDivision ? pct(topDivision.erpValue, totalValue) : 0,
    topSupplierName: topSupplier?.supplier ?? "",
    topSupplierShare: topSupplier ? pct(topSupplier.erpValue, totalValue) : 0,
    top3SupplierShare: pct(top3Value, totalValue),
    othersSupplierLines,
    avgItemValue: m.totalLines > 0 ? totalValue / m.totalLines : 0,
    valuationCoverage: pct(valuedLines, rows.length),
    zeroValueLines,
    warningLines,
    warningRate: pct(warningLines, rows.length),
    missingCodeCount,
    missingDescCount,
    missingOrgCount,
    unclassifiedSupplierCount,
    riskRatio: pct(m.totalRiskValue, totalValue),
    hasAgingData: m.aging.totalAgedValue > 0,
  };
}

/* ─── Qualitative descriptors (single source of truth) ─── */
function accuracyWord(matchRate: number): string {
  if (matchRate >= 98) return "excellent";
  if (matchRate >= 95) return "strong";
  if (matchRate >= 90) return "adequate";
  if (matchRate >= 80) return "below expectation";
  return "weak";
}

function coverageWord(coverage: number): string {
  if (coverage >= 98) return "near-complete";
  if (coverage >= 90) return "high";
  if (coverage >= 75) return "partial";
  return "limited";
}

/* ════════════════════════════════════════════════════════════════
   SECTION NARRATIVES
   ════════════════════════════════════════════════════════════════ */

function buildOverview(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const commentary =
    `The verification exercise covered ${m.totalLines.toLocaleString()} inventory lines with a recorded book value of ${fmtSAR(m.totalInventoryValue)}, ` +
    `spread across ${d.orgCount} organization${d.orgCount === 1 ? "" : "s"} and ${d.supplierCount} supplier group${d.supplierCount === 1 ? "" : "s"}. ` +
    `The average value per inventory line is ${fmtSAR(d.avgItemValue)}, which frames the scale of financial exposure carried by individual record errors.`;

  if (m.totalLines > 0) {
    insights.push(
      `${m.matchedItems.toLocaleString()} of ${m.totalLines.toLocaleString()} lines (${fmtPct(m.matchRate)}) reconciled exactly between the ERP ledger and the physical count.`
    );
  }
  if (d.topDivisionShare >= 40) {
    insights.push(
      `Inventory value is concentrated: ${d.topDivisionName} alone holds ${fmtPct(d.topDivisionShare)} of total book value, so conditions in this organization dominate the overall result.`
    );
  } else if (d.orgCount > 1) {
    insights.push(
      `Inventory value is reasonably distributed across organizations; the largest holder, ${d.topDivisionName}, accounts for ${fmtPct(d.topDivisionShare)} of total value.`
    );
  }
  if (d.valuationCoverage < 95 && d.zeroValueLines > 0) {
    insights.push(
      `${fmtPct(100 - d.valuationCoverage)} of lines carry no unit cost in the ERP — including ${d.zeroValueLines.toLocaleString()} lines with stock on hand — and are therefore invisible to every value-based figure in this report.`
    );
    recs.push({
      id: "rec-valuation",
      title: "Complete ERP unit-cost records",
      reason: `${d.zeroValueLines.toLocaleString()} stocked lines have no unit cost, so their financial exposure is invisible to this report.`,
      benefit: "Full financial visibility of the inventory and more reliable variance valuation.",
      priority: d.zeroValueLines > m.totalLines * 0.1 ? "High" : "Medium",
    });
  }

  return { commentary, insights, recommendations: recs };
}

function buildFinancial(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const direction =
    m.netVariance < 0 ? "a net shortage" : m.netVariance > 0 ? "a net excess" : "a fully balanced position";

  const commentary =
    `Recorded inventory stands at ${fmtSAR(m.totalInventoryValue)} against a physically verified value of ${fmtSAR(m.verifiedValue)}, ` +
    `a ${coverageWord(m.coverageRate)} coverage rate of ${fmtPct(m.coverageRate)}. ` +
    `Reconciliation produced ${direction} of ${fmtSAR(m.netVariance)}, composed of ${fmtSAR(m.totalShortageValue)} in shortages and ${fmtSAR(m.totalExcessValue)} in excess stock. ` +
    `Gross financial exposure (absolute variance) is ${fmtSAR(m.totalRiskValue)}, equal to ${fmtPct(d.riskRatio)} of book value.`;

  if (d.riskRatio >= 5) {
    insights.push(
      `Gross variance exposure of ${fmtPct(d.riskRatio)} of inventory value is material and warrants a formal reconciliation program.`
    );
  } else if (d.riskRatio > 0) {
    insights.push(
      `Gross variance exposure is contained at ${fmtPct(d.riskRatio)} of inventory value.`
    );
  }
  if (Math.abs(m.totalShortageValue) > 0 && m.totalExcessValue > 0) {
    const offset = Math.min(Math.abs(m.totalShortageValue), m.totalExcessValue);
    if (offset > 0 && Math.abs(m.netVariance) < m.totalRiskValue * 0.5) {
      insights.push(
        `Shortages and excesses partially offset each other: the net variance of ${fmtSAR(m.netVariance)} understates the gross movement of ${fmtSAR(m.totalRiskValue)}, a pattern consistent with stock being recorded in the wrong location or code.`
      );
    }
  }
  if (m.provisionAmount > 0) {
    insights.push(
      `Aging analysis indicates a provisioning requirement of ${fmtSAR(m.provisionAmount)} under the applied policy (25% at 1–2 years, 50% at 2–3 years, 100% beyond 3 years).`
    );
  }

  if (d.riskRatio >= 2) {
    recs.push({
      id: "rec-reconcile",
      title: "Run a targeted reconciliation of high-variance lines",
      reason: `Gross variance exposure is ${fmtSAR(m.totalRiskValue)} (${fmtPct(d.riskRatio)} of book value).`,
      benefit: "Direct recovery or correction of the largest value discrepancies before period close.",
      priority: d.riskRatio >= 10 ? "Critical" : d.riskRatio >= 5 ? "High" : "Medium",
    });
  }
  if (m.provisionAmount > 0) {
    recs.push({
      id: "rec-provision",
      title: "Review slow-moving and dead stock for provisioning or disposal",
      reason: `${fmtSAR(m.aging.deadStockValue)} of stock is older than three years and ${fmtSAR(m.aging.slowMovingValue)} is one to three years old.`,
      benefit: "Accurate balance-sheet valuation and reduced carrying cost of obsolete inventory.",
      priority: m.aging.deadStockValue > m.totalInventoryValue * 0.05 ? "High" : "Medium",
    });
  }

  return { commentary, insights, recommendations: recs };
}

function buildHealth(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const commentary =
    `The composite inventory health score is ${m.healthScore} out of 100, rated “${m.inventoryHealthStatus}”. ` +
    `The score combines count accuracy (${fmtPct(m.matchRate)}), value coverage (${fmtPct(m.coverageRate)}), financial risk, open items, and aging provisions into a single management indicator.`;

  insights.push(
    `Physical count accuracy of ${fmtPct(m.matchRate)} is ${accuracyWord(m.matchRate)} relative to common inventory-audit expectations (95%+).`
  );
  if (m.coverageRate < 90) {
    insights.push(
      `Verified value covers only ${fmtPct(m.coverageRate)} of book value; conclusions on unverified stock rely on ERP records alone.`
    );
  }
  if (m.remainingLines > 0) {
    insights.push(
      `${m.remainingLines.toLocaleString()} lines recorded no physical count during the exercise and remain unverified.`
    );
  }

  if (m.matchRate < 95) {
    recs.push({
      id: "rec-accuracy",
      title: "Strengthen counting procedures in low-accuracy areas",
      reason: `Overall count accuracy is ${fmtPct(m.matchRate)}, below the 95% benchmark for reliable inventory records.`,
      benefit: "Higher record reliability, fewer operational surprises, and a stronger audit position next cycle.",
      priority: m.matchRate < 80 ? "Critical" : m.matchRate < 90 ? "High" : "Medium",
    });
  }
  if (m.remainingLines > 0 && m.totalLines > 0 && m.remainingLines / m.totalLines > 0.05) {
    recs.push({
      id: "rec-coverage",
      title: "Schedule completion counts for unverified lines",
      reason: `${m.remainingLines.toLocaleString()} lines (${fmtPct(pct(m.remainingLines, m.totalLines))}) were not physically counted.`,
      benefit: "Complete verification coverage and a defensible basis for the audit opinion.",
      priority: m.remainingLines / m.totalLines > 0.2 ? "High" : "Medium",
    });
  }

  return { commentary, insights, recommendations: recs };
}

function buildOrganizations(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const divs = m.divisions;
  const commentary =
    divs.length > 0
      ? `Inventory is held across ${divs.length} organization${divs.length === 1 ? "" : "s"}. ` +
        `${d.topDivisionName} carries the largest book value at ${fmtSAR(divs[0].erpValue)} (${fmtPct(d.topDivisionShare)} of the total), ` +
        `with a matching rate of ${fmtPct(divs[0].matchingRate)} across its ${divs[0].itemCount.toLocaleString()} lines.`
      : "No organization-level breakdown is available for this reporting period.";

  if (divs.length > 1) {
    const best = [...divs].sort((a, b) => b.matchingRate - a.matchingRate)[0];
    const worst = [...divs].sort((a, b) => a.matchingRate - b.matchingRate)[0];
    if (best.division !== worst.division && best.matchingRate - worst.matchingRate >= 10) {
      insights.push(
        `Accuracy varies materially between organizations: ${best.division} reconciles at ${fmtPct(best.matchingRate)} while ${worst.division} reconciles at ${fmtPct(worst.matchingRate)}, indicating process differences rather than a uniform issue.`
      );
    }
  }
  if (m.highestRiskDivision && m.highestRiskDivision !== "None") {
    const riskDiv = divs.find((x) => x.division === m.highestRiskDivision);
    if (riskDiv && Math.abs(riskDiv.varianceValue) > 0) {
      insights.push(
        `${m.highestRiskDivision} contributes the largest net variance (${fmtSAR(riskDiv.varianceValue)}) and should be the first focus of corrective work.`
      );
      recs.push({
        id: "rec-org-focus",
        title: `Investigate variances in ${m.highestRiskDivision}`,
        reason: `This organization carries the largest net variance of ${fmtSAR(riskDiv.varianceValue)}.`,
        benefit: "Concentrates corrective effort where the financial impact is highest.",
        priority: Math.abs(riskDiv.varianceValue) > m.totalInventoryValue * 0.02 ? "High" : "Medium",
      });
    }
  }

  return { commentary, insights, recommendations: recs };
}

function buildSuppliers(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const commentary =
    m.suppliers.length > 0
      ? `The inventory base spans ${m.suppliers.length} supplier group${m.suppliers.length === 1 ? "" : "s"}. ` +
        `${d.topSupplierName} represents the largest holding at ${fmtPct(d.topSupplierShare)} of total book value, and the three largest suppliers together account for ${fmtPct(d.top3SupplierShare)}.`
      : "No supplier-level breakdown is available for this reporting period.";

  if (d.topSupplierShare >= 40) {
    insights.push(
      `Supplier concentration is high: dependence on ${d.topSupplierName} (${fmtPct(d.topSupplierShare)} of value) exposes operations to a single supply source.`
    );
    recs.push({
      id: "rec-supplier-dependency",
      title: `Reduce dependency on ${d.topSupplierName}`,
      reason: `A single supplier accounts for ${fmtPct(d.topSupplierShare)} of inventory value.`,
      benefit: "Lower supply-chain risk and improved negotiating position.",
      priority: d.topSupplierShare >= 60 ? "High" : "Medium",
    });
  } else if (m.suppliers.length >= 3) {
    insights.push(
      `Supplier exposure is diversified; no single supplier exceeds ${fmtPct(d.topSupplierShare)} of inventory value.`
    );
  }
  if (m.highestRiskSupplier && m.highestRiskSupplier !== "None") {
    const rs = m.suppliers.find((s) => s.supplier === m.highestRiskSupplier);
    if (rs && rs.absoluteVarianceValue > 0) {
      insights.push(
        `${m.highestRiskSupplier} shows the largest absolute variance (${fmtSAR(rs.absoluteVarianceValue)} across ${rs.itemCount.toLocaleString()} lines, matching at ${fmtPct(rs.matchingRate)}).`
      );
    }
  }
  if (d.othersSupplierLines > 0 && m.totalLines > 0 && d.othersSupplierLines / m.totalLines > 0.1) {
    insights.push(
      `${d.othersSupplierLines.toLocaleString()} lines (${fmtPct(pct(d.othersSupplierLines, m.totalLines))}) could not be attributed to a named supplier and are grouped under “Others”, limiting supplier-level accountability.`
    );
    recs.push({
      id: "rec-supplier-mapping",
      title: "Improve supplier attribution of inventory records",
      reason: `${fmtPct(pct(d.othersSupplierLines, m.totalLines))} of lines are unattributed (“Others”).`,
      benefit: "Reliable supplier scorecards and cleaner accountability for variances.",
      priority: "Medium",
    });
  }

  return { commentary, insights, recommendations: recs };
}

function buildDistribution(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];

  const commentary =
    `This section maps how the ${fmtSAR(m.totalInventoryValue)} of recorded value and ${m.totalLines.toLocaleString()} lines are distributed across the operation. ` +
    `Distribution shape determines where counting effort, controls, and working capital are actually deployed.`;

  if (m.divisions.length > 1) {
    const top = m.divisions[0];
    const valueShare = pct(top.erpValue, m.totalInventoryValue);
    const lineShare = pct(top.itemCount, m.totalLines);
    if (valueShare - lineShare >= 15) {
      insights.push(
        `${top.division} holds ${fmtPct(valueShare)} of value with only ${fmtPct(lineShare)} of lines — a high-value, low-line profile where individual record errors are expensive.`
      );
    } else if (lineShare - valueShare >= 15) {
      insights.push(
        `${top.division} holds ${fmtPct(lineShare)} of lines but only ${fmtPct(valueShare)} of value — a high-volume, low-value profile where counting workload, not financial risk, is the main burden.`
      );
    }
  }
  if (m.subDivisions.length > 1) {
    insights.push(
      `Stock is physically spread over ${m.subDivisions.length} count sheets/areas; the largest, ${m.subDivisions[0].subDivision}, carries ${fmtSAR(m.subDivisions[0].erpValue)}.`
    );
  }
  if (d.topDivisionShare >= 60) {
    insights.push(
      `With ${fmtPct(d.topDivisionShare)} of value in one organization, the distribution is heavily skewed; a localized issue there would move the company-wide result.`
    );
  }

  return { commentary, insights, recommendations: [] };
}

function buildValidation(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const commentary =
    d.warningLines > 0
      ? `Automated validation flagged ${d.warningLines.toLocaleString()} of ${m.totalLines.toLocaleString()} lines (${fmtPct(d.warningRate)}) with at least one data-quality warning. ` +
        `Flags are advisory: no data was discarded, and all flagged lines remain in the calculations above.`
      : `Automated validation completed with no data-quality warnings across ${m.totalLines.toLocaleString()} lines, indicating disciplined master-data maintenance.`;

  if (d.missingCodeCount > 0) {
    insights.push(`${d.missingCodeCount.toLocaleString()} lines are missing an item code, which prevents reliable cross-period tracking of those items.`);
  }
  if (d.missingDescCount > 0) {
    insights.push(`${d.missingDescCount.toLocaleString()} lines have no description, reducing traceability during physical verification.`);
  }
  if (d.unclassifiedSupplierCount > 0) {
    insights.push(`${d.unclassifiedSupplierCount.toLocaleString()} lines lack a resolvable supplier and were classified under “Others”.`);
  }
  if (d.missingOrgCount > 0) {
    insights.push(`${d.missingOrgCount.toLocaleString()} lines are missing an organization/unit assignment.`);
  }
  if (d.warningLines === 0) {
    insights.push("The absence of validation warnings supports a high level of confidence in the figures presented in this report.");
  }

  if (d.warningRate >= 10) {
    recs.push({
      id: "rec-data-quality",
      title: "Launch a master-data cleanup for flagged records",
      reason: `${fmtPct(d.warningRate)} of inventory lines carry data-quality warnings (missing codes, descriptions, suppliers, or units).`,
      benefit: "Higher confidence in future counts and less manual investigation effort.",
      priority: d.warningRate >= 20 ? "High" : "Medium",
    });
  } else if (d.warningLines > 0) {
    recs.push({
      id: "rec-data-quality",
      title: "Correct the remaining flagged records",
      reason: `${d.warningLines.toLocaleString()} lines carry residual data-quality warnings.`,
      benefit: "Moves the dataset to fully clean master data ahead of the next count cycle.",
      priority: "Low",
    });
  }

  return { commentary, insights, recommendations: recs };
}

/* ════════════════════════════════════════════════════════════════
   RISKS / OPPORTUNITIES / CONCLUSION
   ════════════════════════════════════════════════════════════════ */

function buildRisks(m: PreReportMetrics, d: DerivedStats): RiskFinding[] {
  const risks: RiskFinding[] = [];

  if (d.riskRatio >= 2) {
    risks.push({
      id: "risk-exposure",
      title: "Financial Exposure from Stock Variances",
      level: d.riskRatio >= 10 ? "Critical" : d.riskRatio >= 5 ? "High" : "Medium",
      impact: `${fmtSAR(m.totalRiskValue)} of gross variance (${fmtPct(d.riskRatio)} of book value).`,
      explanation: `Physical counts diverge from ERP records by ${fmtSAR(m.totalRiskValue)} in absolute terms — ${fmtSAR(m.totalShortageValue)} short and ${fmtSAR(m.totalExcessValue)} over.`,
      action: "Prioritize reconciliation of the top-variance items listed in the risk ledger before financial close.",
    });
  }
  if (m.matchRate < 90 && m.totalLines > 0) {
    risks.push({
      id: "risk-accuracy",
      title: "Low Inventory Record Accuracy",
      level: m.matchRate < 80 ? "High" : "Medium",
      impact: `${m.mismatchedItems.toLocaleString()} of ${m.totalLines.toLocaleString()} lines (${fmtPct(100 - m.matchRate)}) failed to reconcile.`,
      explanation: `A count accuracy of ${fmtPct(m.matchRate)} is below the 95% level generally expected for dependable planning and financial reporting.`,
      action: "Introduce cycle counting and root-cause reviews in the organizations with the lowest matching rates.",
    });
  }
  if (d.topSupplierShare >= 40) {
    risks.push({
      id: "risk-supplier",
      title: "High Supplier Dependency",
      level: d.topSupplierShare >= 60 ? "High" : "Medium",
      impact: `${fmtPct(d.topSupplierShare)} of inventory value sits with ${d.topSupplierName}.`,
      explanation: "Concentration of inventory value in a single supplier increases exposure to supply disruption and pricing pressure.",
      action: "Assess alternative sources for the highest-value item families of this supplier.",
    });
  }
  if (d.topDivisionShare >= 60) {
    risks.push({
      id: "risk-concentration",
      title: "Inventory Concentration in One Organization",
      level: "Medium",
      impact: `${d.topDivisionName} holds ${fmtPct(d.topDivisionShare)} of total value.`,
      explanation: "A localized operational problem (access, damage, process failure) in this organization would affect the majority of inventory value.",
      action: "Verify that storage, insurance, and counting controls in this organization match its share of value.",
    });
  }
  if (m.coverageRate < 75 && m.totalInventoryValue > 0) {
    risks.push({
      id: "risk-coverage",
      title: "Limited Verification Coverage",
      level: m.coverageRate < 50 ? "High" : "Medium",
      impact: `Only ${fmtPct(m.coverageRate)} of book value was physically verified.`,
      explanation: `${m.remainingLines.toLocaleString()} lines were not counted; their reported values rest on ERP records alone.`,
      action: "Complete the outstanding counts or formally scope them into the next cycle.",
    });
  }
  if (d.zeroValueLines > 0 && m.totalLines > 0 && d.zeroValueLines / m.totalLines > 0.05) {
    risks.push({
      id: "risk-zero-value",
      title: "Unvalued Inventory Records",
      level: "Medium",
      impact: `${d.zeroValueLines.toLocaleString()} stocked lines (${fmtPct(pct(d.zeroValueLines, m.totalLines))}) carry no unit cost.`,
      explanation: "Lines without unit costs are invisible in every value-based figure in this report, understating both inventory value and variance exposure.",
      action: "Populate ERP unit costs for stocked items and re-run the valuation.",
    });
  }
  if (d.warningRate >= 10) {
    risks.push({
      id: "risk-data-quality",
      title: "Master-Data Quality Gaps",
      level: d.warningRate >= 20 ? "High" : "Medium",
      impact: `${fmtPct(d.warningRate)} of lines carry data-quality warnings.`,
      explanation: "Missing item codes, descriptions, suppliers, or unit assignments reduce traceability and weaken the reliability of grouped analysis.",
      action: "Assign ownership for master-data cleanup with a completion target before the next count.",
    });
  }
  if (m.aging.deadStockValue > 0) {
    risks.push({
      id: "risk-aging",
      title: "Obsolete and Slow-Moving Stock",
      level: m.aging.deadStockValue > m.totalInventoryValue * 0.1 ? "High" : "Medium",
      impact: `${fmtSAR(m.aging.deadStockValue)} of stock is older than three years; the indicated provision is ${fmtSAR(m.provisionAmount)}.`,
      explanation: "Aged stock ties up warehouse space and working capital while its recoverable value declines.",
      action: "Review the aged population for disposal, resale, or write-down in line with the provisioning policy.",
    });
  }

  const order: Priority[] = ["Critical", "High", "Medium", "Low"];
  return risks.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
}

function buildOpportunities(m: PreReportMetrics, d: DerivedStats): Opportunity[] {
  const ops: Opportunity[] = [];

  if (m.matchRate >= 95) {
    ops.push({
      id: "op-accuracy",
      title: "Strong Count Accuracy",
      detail: `A ${fmtPct(m.matchRate)} match rate demonstrates disciplined stock handling and provides a reliable foundation for planning and financial reporting.`,
    });
  }
  if (m.coverageRate >= 90) {
    ops.push({
      id: "op-coverage",
      title: "High Verification Coverage",
      detail: `${fmtPct(m.coverageRate)} of book value was physically verified, giving management a direct-observation basis for the reported figures.`,
    });
  }
  if (d.topSupplierShare < 40 && m.suppliers.length >= 3) {
    ops.push({
      id: "op-diversification",
      title: "Healthy Supplier Diversification",
      detail: `No supplier exceeds ${fmtPct(d.topSupplierShare)} of inventory value, limiting single-source supply risk.`,
    });
  }
  if (d.warningRate === 0 && m.totalLines > 0) {
    ops.push({
      id: "op-data",
      title: "Clean Master Data",
      detail: "Every line passed automated validation, an uncommon result that materially strengthens confidence in this report.",
    });
  } else if (d.warningRate > 0 && d.warningRate < 5) {
    ops.push({
      id: "op-data",
      title: "Near-Clean Master Data",
      detail: `Only ${fmtPct(d.warningRate)} of lines carry validation warnings, indicating generally reliable inventory records.`,
    });
  }
  if (m.healthScore >= 85) {
    ops.push({
      id: "op-health",
      title: "Audit-Ready Inventory Position",
      detail: `A health score of ${m.healthScore} (“${m.inventoryHealthStatus}”) positions the operation well for external audit with limited additional preparation.`,
    });
  }
  if (m.totalExcessValue > 0 && Math.abs(m.totalShortageValue) > 0) {
    ops.push({
      id: "op-offset",
      title: "Recoverable Variance Through Reconciliation",
      detail: `Because ${fmtSAR(m.totalExcessValue)} of excess coexists with ${fmtSAR(m.totalShortageValue)} of shortages, part of the gross variance may resolve through location and code corrections rather than genuine loss.`,
    });
  }

  return ops;
}

function dedupeAndSortRecommendations(recs: Recommendation[]): Recommendation[] {
  const seen = new Map<string, Recommendation>();
  for (const r of recs) if (!seen.has(r.id)) seen.set(r.id, r);
  const order: Priority[] = ["Critical", "High", "Medium", "Low"];
  return [...seen.values()].sort(
    (a, b) => order.indexOf(a.priority) - order.indexOf(b.priority)
  );
}

function buildExecutiveSummary(
  input: NarrativeInput,
  m: PreReportMetrics,
  d: DerivedStats,
  risks: RiskFinding[],
  recs: Recommendation[]
): string {
  const period = `${input.quarter} ${input.year}`.trim();
  const parts: string[] = [];

  parts.push(
    `This report presents the results of the ${period} physical inventory verification${input.clientName ? ` for ${input.clientName}` : ""}${input.location ? ` (${input.location})` : ""}. ` +
    `The exercise covered ${m.totalLines.toLocaleString()} inventory lines with a recorded value of ${fmtSAR(m.totalInventoryValue)}, of which ${fmtSAR(m.verifiedValue)} (${fmtPct(m.coverageRate)}) was physically verified.`
  );

  parts.push(
    `Count accuracy reached ${fmtPct(m.matchRate)}, with ${m.matchedItems.toLocaleString()} lines reconciling exactly and ${m.mismatchedItems.toLocaleString()} showing quantity differences. ` +
    `The net reconciliation variance is ${m.netVariance < 0 ? "negative " : m.netVariance > 0 ? "positive " : ""}${fmtSAR(m.netVariance)}, within a gross exposure of ${fmtSAR(m.totalRiskValue)} (${fmtPct(d.riskRatio)} of book value). ` +
    `The composite inventory health score is ${m.healthScore} of 100 (“${m.inventoryHealthStatus}”).`
  );

  if (risks.length > 0) {
    const top = risks[0];
    parts.push(
      `${risks.length} business risk${risks.length === 1 ? "" : "s"} ${risks.length === 1 ? "was" : "were"} identified from the data, led by “${top.title}” (${top.level}). ` +
      (recs.length > 0
        ? `Management attention is drawn to ${recs.length} recommendation${recs.length === 1 ? "" : "s"}, beginning with: ${recs[0].title.toLowerCase()}.`
        : "")
    );
  } else {
    parts.push(
      "No material business risks were identified from the data in this cycle. The position presented is stable, and the recommendations focus on sustaining current performance."
    );
  }

  parts.push(
    `Overall, the inventory position is assessed as ${m.inventoryHealthStatus.toLowerCase()}${m.auditConclusion.startsWith("Unqualified") ? ", supported by a clean audit conclusion" : m.auditConclusion.startsWith("Qualified") ? ", with a qualified audit conclusion reflecting minor variances" : ", and the audit conclusion signals material discrepancies requiring correction"}. ` +
    `The sections that follow move from the overall position through financial, organizational, and supplier analysis to specific risks, opportunities, and actions.`
  );

  return parts.join("\n\n");
}

function buildConclusion(
  m: PreReportMetrics,
  d: DerivedStats,
  risks: RiskFinding[],
  ops: Opportunity[],
  recs: Recommendation[]
): ExecutiveConclusion {
  const paragraphs: string[] = [];

  paragraphs.push(
    `The ${m.totalLines.toLocaleString()}-line inventory, valued at ${fmtSAR(m.totalInventoryValue)}, closes the cycle with a health score of ${m.healthScore} (“${m.inventoryHealthStatus}”), ` +
    `count accuracy of ${fmtPct(m.matchRate)}, and verification coverage of ${fmtPct(m.coverageRate)}. ` +
    `Net variance stands at ${fmtSAR(m.netVariance)} against a gross exposure of ${fmtSAR(m.totalRiskValue)}.`
  );

  if (d.warningLines > 0) {
    paragraphs.push(
      `Data quality is workable but not clean: ${d.warningLines.toLocaleString()} lines (${fmtPct(d.warningRate)}) carry validation warnings, and ${d.zeroValueLines > 0 ? `${d.zeroValueLines.toLocaleString()} stocked lines remain unvalued in the ERP` : "valuation coverage is otherwise complete"}. These gaps bound the precision of supplier and organization-level conclusions.`
    );
  } else {
    paragraphs.push(
      "Data quality is a clear strength of this cycle: every line passed automated validation, which raises the confidence that can be placed in the figures and groupings presented."
    );
  }

  if (risks.length > 0) {
    paragraphs.push(
      `The risk register contains ${risks.length} item${risks.length === 1 ? "" : "s"} (${risks.filter(r => r.level === "Critical" || r.level === "High").length} rated High or Critical), balanced by ${ops.length} positive finding${ops.length === 1 ? "" : "s"}. ` +
      (recs.length > 0
        ? `The recommendation set is deliberately short — ${recs.length} action${recs.length === 1 ? "" : "s"} — and sequenced by priority so that ${recs[0].title.toLowerCase()} is addressed first.`
        : "No corrective actions are required beyond sustaining current practice.")
    );
  } else {
    paragraphs.push(
      `No risks met the evidence threshold for inclusion, and ${ops.length} positive finding${ops.length === 1 ? "" : "s"} ${ops.length === 1 ? "was" : "were"} recorded. The operation should focus on sustaining the practices that produced this result.`
    );
  }

  const overallAssessment =
    m.healthScore >= 85
      ? "The inventory position is sound and audit-ready. Remaining actions are refinements, not corrections."
      : m.healthScore >= 70
        ? "The inventory position is broadly reliable, with specific, addressable weaknesses identified in this report."
        : m.healthScore >= 50
          ? "The inventory position requires management attention; the prioritized recommendations should be actioned before the next reporting cycle."
          : "The inventory position presents material control weaknesses; immediate corrective action is required and re-verification is advised.";

  return { paragraphs, overallAssessment };
}

/* ════════════════════════════════════════════════════════════════
   PUBLIC ENTRY POINT
   ════════════════════════════════════════════════════════════════ */

export function buildReportNarrative(input: NarrativeInput): ReportNarrative {
  const m = input.metrics;
  const d = deriveStats(m, input.rows);

  const overview = buildOverview(m, d);
  const financial = buildFinancial(m, d);
  const health = buildHealth(m, d);
  const organizations = buildOrganizations(m, d);
  const suppliers = buildSuppliers(m, d);
  const distribution = buildDistribution(m, d);
  const validation = buildValidation(m, d);
  const risks = buildRisks(m, d);
  const opportunities = buildOpportunities(m, d);

  const consolidatedRecommendations = dedupeAndSortRecommendations([
    ...overview.recommendations,
    ...financial.recommendations,
    ...health.recommendations,
    ...organizations.recommendations,
    ...suppliers.recommendations,
    ...validation.recommendations,
  ]);

  const executiveSummary = buildExecutiveSummary(input, m, d, risks, consolidatedRecommendations);
  const conclusion = buildConclusion(m, d, risks, opportunities, consolidatedRecommendations);

  return {
    executiveSummary,
    overview,
    financial,
    health,
    organizations,
    suppliers,
    distribution,
    validation,
    validationStats: {
      totalLines: input.rows.length,
      flaggedLines: d.warningLines,
      missingCodeCount: d.missingCodeCount,
      missingDescCount: d.missingDescCount,
      missingOrgCount: d.missingOrgCount,
      unclassifiedSupplierCount: d.unclassifiedSupplierCount,
    },
    risks,
    opportunities,
    consolidatedRecommendations,
    conclusion,
  };
}
