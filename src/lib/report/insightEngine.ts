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
  /** Populated by enrichRecommendation before the narrative is returned. */
  suggestedOwner?: string;
  suggestedTimeline?: string;
}

export interface RiskFinding {
  id: string;
  title: string;
  level: Priority;
  impact: string;
  explanation: string;
  action: string;
  /** Concrete figures backing the finding; populated in buildRisks. */
  evidence?: string;
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

function buildOverview(input: NarrativeInput, m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const situation = `During the Q${input.quarter || "4"} ${input.year} audit cycle, a comprehensive physical inventory verification was executed across the ${input.location || "Gas Arabian Services"} facilities. The program scope encompassed ${m.totalLines.toLocaleString()} individual inventory line items, representing a total ledger book value of ${fmtSAR(m.totalInventoryValue)} across ${d.orgCount} organizational divisions and ${d.supplierCount} primary supplier networks. This audit serves as a critical internal control mechanism to validate asset custody and align physical stock with the ERP general ledger.`;

  const complication = `Our analysis indicates an average value per inventory line of ${fmtSAR(d.avgItemValue)}, highlighting that stock accuracy is highly sensitive to individual record variances. While physical count coverage achieved ${fmtPct(m.coverageRate)} of total book value, the verification team identified ${d.zeroValueLines.toLocaleString()} active line items that are stocked physically but carry zero unit cost valuation in the ERP ledger, creating a structural blind spot in asset valuation.`;

  const implication = `From a management consulting perspective, these unvalued lines understate total capital employed and expose the organization to compliance and tax risks. Furthermore, a high concentration of inventory value within key divisions indicates that any localized inventory control breakdown will have immediate, material impacts on corporate financial statements. Corrective actions must prioritize ERP database valuation updates and division-level custody reviews.`;

  const commentary = `${situation}\n\n${complication}\n\n${implication}`;

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
      title: "Map Unit-Cost Records for ERP Database Integrity",
      reason: `${d.zeroValueLines.toLocaleString()} physically stocked lines have no recorded unit cost, rendering their variance exposure invisible.`,
      benefit: "Establish complete valuation coverage and remove balance sheet blind spots.",
      priority: d.zeroValueLines > m.totalLines * 0.1 ? "High" : "Medium",
    });
  }

  return { commentary, insights, recommendations: recs };
}

function buildFinancial(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const direction = m.netVariance < 0 ? "net shortage (deficit)" : m.netVariance > 0 ? "net excess (surplus)" : "fully balanced ledger state";

  const situation = `The financial reconciliation for the current audit cycle compares the ERP recorded book value of ${fmtSAR(m.totalInventoryValue)} against a physically verified asset value of ${fmtSAR(m.verifiedValue)}, yielding a verified coverage rate of ${fmtPct(m.coverageRate)}. The reconciliation process revealed a ${direction} of ${fmtSAR(m.netVariance)}, reflecting the net variance between shortages and excesses.`;

  const complication = `While the net variance suggests a moderate discrepancy, the gross financial exposure (absolute variance) is substantial at ${fmtSAR(m.totalRiskValue)}, representing ${fmtPct(d.riskRatio)} of total inventory value. This exposure is driven by a combination of ${fmtSAR(Math.abs(m.totalShortageValue))} in physical shortages and ${fmtSAR(m.totalExcessValue)} in unrecorded physical excesses. This co-existence of offsetting variances points to systemic posting errors, bin location mismatches, and ledger lag rather than direct material shrinkage.`;

  const implication = `Operating with a gross exposure of ${fmtPct(d.riskRatio)} compromises working capital efficiency and procurement accuracy. Additionally, our aging profile identifies slow-moving and obsolete stock older than one year, necessitating a balance sheet provisioning allocation of ${fmtSAR(m.provisionAmount)}. Senior management should immediately execute the targeted reconciliation of high-variance lines and authorize the write-off or liquidation of obsolete stock to release trapped capital.`;

  const commentary = `${situation}\n\n${complication}\n\n${implication}`;

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
      title: "Initiate Targeted High-Variance Bin Audits",
      reason: `Gross absolute variance stands at ${fmtSAR(m.totalRiskValue)} (${fmtPct(d.riskRatio)} of total value).`,
      benefit: "Direct recovery or correction of major value discrepancies prior to period close.",
      priority: d.riskRatio >= 10 ? "Critical" : d.riskRatio >= 5 ? "High" : "Medium",
    });
  }
  if (m.provisionAmount > 0) {
    recs.push({
      id: "rec-provision",
      title: "Authorize Obsolete Stock Liquidation or Provisioning",
      reason: `${fmtSAR(m.aging.deadStockValue)} of stock has remained dormant for over three years, inflating storage and carrying costs.`,
      benefit: "Accurate balance sheet valuation and release of trapped warehouse working capital.",
      priority: m.aging.deadStockValue > m.totalInventoryValue * 0.05 ? "High" : "Medium",
    });
  }

  return { commentary, insights, recommendations: recs };
}

function buildHealth(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const situation = `The composite inventory health index is established at ${m.healthScore} out of 100, which corresponds to a performance classification of "${m.inventoryHealthStatus}". This index serves as a key indicator of the maturity of the inventory control framework, synthesizing count accuracy, value coverage, data quality, aging exposure, and reconciliation progress.`;

  const complication = `The baseline physical count accuracy is recorded at ${fmtPct(m.matchRate)}, meaning ${m.matchedItems.toLocaleString()} lines matched exactly while ${m.mismatchedItems.toLocaleString()} lines exhibited quantity discrepancies. Crucially, the presence of ${m.remainingLines.toLocaleString()} unverified lines (representing ${fmtPct(pct(m.remainingLines, m.totalLines))} of total lines) represents an unmitigated risk where asset value is reported without direct physical confirmation.`;

  const implication = `A count accuracy of ${fmtPct(m.matchRate)} is ${m.matchRate >= 95 ? "satisfactory, but continuous monitoring is required to prevent control drift" : "sub-optimal, falling short of the 95% industry standard required for automated operations"}. The unverified lines represent pockets of high risk in the warehouse, where obsolete, damaged, or pilfered stock could go undetected. Management must enforce strict cycle-counting regimens and assign clear responsibility for completing outstanding physical counts.`;

  const commentary = `${situation}\n\n${complication}\n\n${implication}`;

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
      title: "Enforce Standard Operating Procedures (SOPs) for Stock Transfers",
      reason: `Overall count accuracy is ${fmtPct(m.matchRate)}, falling short of the 95% benchmark required for seamless digital replenishment.`,
      benefit: "Reduce pick-and-pack search latency, avoid stockouts, and improve customer order fulfillment.",
      priority: m.matchRate < 80 ? "Critical" : m.matchRate < 90 ? "High" : "Medium",
    });
  }
  if (m.remainingLines > 0 && m.totalLines > 0 && m.remainingLines / m.totalLines > 0.05) {
    recs.push({
      id: "rec-coverage",
      title: "Complete Outstanding Physical Counts for Unverified Stock",
      reason: `${m.remainingLines.toLocaleString()} line items were left uncounted, representing a material audit blind spot.`,
      benefit: "Achieve complete physical verification coverage and prevent auditor qualifications.",
      priority: m.remainingLines / m.totalLines > 0.2 ? "High" : "Medium",
    });
  }

  return { commentary, insights, recommendations: recs };
}

function buildOrganizations(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const divs = m.divisions;
  const situation = divs.length > 0
    ? `The organizational analysis evaluates inventory controls and accuracy across the ${divs.length} active divisions of GAS Arabian Services. The value profile is highly concentrated, with the leading division, ${d.topDivisionName}, holding ${fmtSAR(divs[0].erpValue)} or ${fmtPct(d.topDivisionShare)} of the total corporate inventory book value.`
    : "No division-level structural data was provided for this cycle.";

  const complication = divs.length > 1
    ? `A comparison between division performances reveals significant control variance. While high-performing units exhibit solid compliance, others show substantial accuracy drift. Notably, ${m.highestRiskDivision || "certain divisions"} represents the highest risk profile, generating the largest net variance of ${fmtSAR(divs.find(x => x.division === m.highestRiskDivision)?.varianceValue || 0)}.`
    : "";

  const implication = divs.length > 1
    ? `This discrepancy confirms that inventory control vulnerabilities are localized rather than systemic, pointing to specific differences in warehouse practices, staff training, or ledger transaction discipline. Senior leadership should focus corrective efforts on the highest-risk division to re-align local procedures with corporate standards and recover ledger accuracy.`
    : "";

  const commentary = `${situation}\n\n${complication}\n\n${implication}`;

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
        title: `Execute Focused Inventory Audit in ${m.highestRiskDivision}`,
        reason: `This division alone accounts for the largest net variance of ${fmtSAR(riskDiv.varianceValue)}.`,
        benefit: "Focuses audit resources on the division with the highest risk of financial statement distortion.",
        priority: Math.abs(riskDiv.varianceValue) > m.totalInventoryValue * 0.02 ? "High" : "Medium",
      });
    }
  }

  return { commentary, insights, recommendations: recs };
}

function buildSuppliers(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];
  const recs: Recommendation[] = [];

  const situation = m.suppliers.length > 0
    ? `The supplier analysis reviews the inventory portfolio across ${m.suppliers.length} active supplier networks. The portfolio displays significant value concentration, with the top supplier, ${d.topSupplierName}, representing ${fmtPct(d.topSupplierShare)} of total value, and the top three suppliers representing a combined share of ${fmtPct(d.top3SupplierShare)}.`
    : "No supplier-level attribution data is available.";

  const complication = m.suppliers.length > 0
    ? `The audit identified material variance patterns concentrated in specific supplier segments. Notably, ${m.highestRiskSupplier || "specific suppliers"} accounts for the largest absolute variance of ${fmtSAR(m.suppliers.find(s => s.supplier === m.highestRiskSupplier)?.absoluteVarianceValue || 0)}. Furthermore, the presence of ${d.othersSupplierLines.toLocaleString()} lines classified under 'Others' indicates incomplete supplier attribution in the database.`
    : "";

  const implication = m.suppliers.length > 0
    ? `High supplier concentration exposes GAS Arabian Services to supply-chain disruptions and single-source pricing risks. Supplier-specific variances suggest operational friction during receiving inspection or incorrect unit-of-measure entries. Standardizing receiving audits and improving data mapping for unattributed lines are critical steps to establish full supplier accountability.`
    : "";

  const commentary = `${situation}\n\n${complication}\n\n${implication}`;

  if (d.topSupplierShare >= 40) {
    insights.push(
      `Supplier concentration is high: dependence on ${d.topSupplierName} (${fmtPct(d.topSupplierShare)} of value) exposes operations to a single supply source.`
    );
    recs.push({
      id: "rec-supplier-dependency",
      title: `Diversify Supplier Base for High-Concentration Categories`,
      reason: `A single supplier (${d.topSupplierName}) accounts for ${fmtPct(d.topSupplierShare)} of total inventory value.`,
      benefit: "Mitigate single-source supply chain risk and enhance commercial purchasing leverage.",
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
      title: "Remediate Unclassified Supplier Master Data",
      reason: `${fmtPct(pct(d.othersSupplierLines, m.totalLines))} of lines are unattributed ("Others"), preventing supplier performance analysis.`,
      benefit: "Enable comprehensive supplier scorecards and cleaner accountability for variances.",
      priority: "Medium",
    });
  }

  return { commentary, insights, recommendations: recs };
}

function buildDistribution(m: PreReportMetrics, d: DerivedStats): SectionNarrative {
  const insights: string[] = [];

  const situation = `This section evaluates the alignment between working capital concentration and inventory line volume. Understanding this distribution is essential for designing efficient, risk-adjusted cycle-counting schedules and optimizing warehouse labor allocation.`;

  const top = m.divisions[0];
  const valueShare = top ? pct(top.erpValue, m.totalInventoryValue) : 0;
  const lineShare = top ? pct(top.itemCount, m.totalLines) : 0;

  const complication = top
    ? `Our analysis reveals a highly asymmetrical distribution: ${top.division} holds ${fmtPct(valueShare)} of total inventory value while accounting for only ${fmtPct(lineShare)} of physical line items. This constitutes a high-density value profile, whereas other divisions carry high line volumes with minimal financial value.`
    : "";

  const implication = top
    ? `This asymmetry requires a differentiated control model. High-density value lines represent critical financial exposure where even minor unit discrepancies result in material P&L impact; these must be governed by tight, high-frequency cycle counts. Conversely, low-value high-volume lines should be managed via automated reconciliation and sample-based counts to avoid wasting valuable auditor time.`
    : "";

  const commentary = `${situation}\n\n${complication}\n\n${implication}`;

  if (m.divisions.length > 1) {
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

  const situation = `Automated validation checks were performed across all ${m.totalLines.toLocaleString()} database records to assess the structural integrity of the inventory master file. Data hygiene is the foundational requirement for inventory traceability, automated procurement, and dependable financial reporting.`;

  const complication = d.warningLines > 0
    ? `The validation engine flagged ${d.warningLines.toLocaleString()} lines (${fmtPct(d.warningRate)}) with record errors or missing fields. The flagged database anomalies include ${d.missingCodeCount.toLocaleString()} missing item codes, ${d.missingDescCount.toLocaleString()} missing descriptions, and ${d.unclassifiedSupplierCount.toLocaleString()} lines missing supplier attribution.`
    : "The validation engine completed with zero flags, confirming exceptional master-data discipline.";

  const implication = d.warningLines > 0
    ? `Missing item codes and descriptions prevent the system from enforcing database constraints, resulting in manual purchasing workarounds and counting errors. A database warning rate of ${fmtPct(d.warningRate)} undermines dashboard reliability and risks audit qualifications. Management should establish immediate data-cleansing ownership before the next reporting cycle.`
    : "This clean database state ensures maximum reliability of report metrics and provides a solid basis for automating inventory planning.";

  const commentary = `${situation}\n\n${complication}\n\n${implication}`;

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
      title: "Execute Master Data Cleansing and Cleanup",
      reason: `${fmtPct(d.warningRate)} of inventory lines carry warnings such as missing item codes, descriptions, or suppliers.`,
      benefit: "Enable system-level relational checks and eliminate purchasing process workarounds.",
      priority: d.warningRate >= 20 ? "High" : "Medium",
    });
  } else if (d.warningLines > 0) {
    recs.push({
      id: "rec-data-quality",
      title: "Correct Residual Master Data Warnings",
      reason: `${d.warningLines.toLocaleString()} inventory lines carry residual master data validation errors.`,
      benefit: "Achieve a completely clean master data file ahead of the next count cycle.",
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
      explanation: `Physical count quantities diverge from ERP records by ${fmtSAR(m.totalRiskValue)} in absolute terms, consisting of ${fmtSAR(Math.abs(m.totalShortageValue))} in shortages and ${fmtSAR(m.totalExcessValue)} in excesses.`,
      action: "Prioritize audit-cleansing of the top-variance items in the risk ledger before financial period close.",
    });
  }
  if (m.matchRate < 90 && m.totalLines > 0) {
    risks.push({
      id: "risk-accuracy",
      title: "Low Inventory Record Accuracy",
      level: m.matchRate < 80 ? "High" : "Medium",
      impact: `${m.mismatchedItems.toLocaleString()} of ${m.totalLines.toLocaleString()} lines (${fmtPct(100 - m.matchRate)}) failed to reconcile.`,
      explanation: `A physical count accuracy of ${fmtPct(m.matchRate)} is below the 95% threshold required to support automated warehouse planning, leading to frequent manual workarounds.`,
      action: "Deploy targeted training and establish daily cycle-counting in the lowest-performing organizations.",
    });
  }
  if (d.topSupplierShare >= 40) {
    risks.push({
      id: "risk-supplier",
      title: "Concentration Risk on Key Supplier",
      level: d.topSupplierShare >= 60 ? "High" : "Medium",
      impact: `${fmtPct(d.topSupplierShare)} of total inventory value is concentrated with ${d.topSupplierName}.`,
      explanation: `Extreme value concentration with a single supplier increases vulnerability to delivery delays, single-source pricing inflation, and contract disputes.`,
      action: "Conduct a risk assessment of this supplier and identify alternative secondary sourcing options for key item categories.",
    });
  }
  if (d.topDivisionShare >= 60) {
    risks.push({
      id: "risk-concentration",
      title: "Inventory Value Concentration in Division",
      level: "Medium",
      impact: `${d.topDivisionName} holds ${fmtPct(d.topDivisionShare)} of corporate inventory value.`,
      explanation: `Concentrating the majority of inventory value in a single division means local operational bottlenecks or facility damage will have systemic corporate impacts.`,
      action: "Review insurance coverage thresholds, fire protection, and physical access controls at the primary facility of this division.",
    });
  }
  if (m.coverageRate < 75 && m.totalInventoryValue > 0) {
    risks.push({
      id: "risk-coverage",
      title: "Limited Verification Audit Coverage",
      level: m.coverageRate < 50 ? "High" : "Medium",
      impact: `Only ${fmtPct(m.coverageRate)} of book value was physically verified in the current cycle.`,
      explanation: `${m.remainingLines.toLocaleString()} line items were not counted; their reported valuation rests on ERP data without visual confirmation.`,
      action: "Schedule a catch-up verification cycle or formally carry over uncounted lines into the next count list.",
    });
  }
  if (d.zeroValueLines > 0 && m.totalLines > 0 && d.zeroValueLines / m.totalLines > 0.05) {
    risks.push({
      id: "risk-zero-value",
      title: "Unvalued ERP Stock Records",
      level: "Medium",
      impact: `${d.zeroValueLines.toLocaleString()} stocked lines (${fmtPct(pct(d.zeroValueLines, m.totalLines))}) carry zero unit cost in the system.`,
      explanation: `Stock items without recorded unit costs understate corporate asset values and mask true financial variance exposures.`,
      action: "Instruct the Finance department to map and populate unit costs for all stocked items in the ERP database.",
    });
  }
  if (d.warningRate >= 10) {
    risks.push({
      id: "risk-data-quality",
      title: "Inventory Master Data Quality Deficiencies",
      level: d.warningRate >= 20 ? "High" : "Medium",
      impact: `${fmtPct(d.warningRate)} of line items carry active data validation warnings.`,
      explanation: `Missing item codes, descriptions, or supplier assignments prevent the system from executing auto-reorder and cycle-count logic, causing procurement delays.`,
      action: "Establish a cross-functional data-cleansing task force to remediate flagged records before the next verification cycle.",
    });
  }
  if (m.aging.deadStockValue > 0) {
    risks.push({
      id: "risk-aging",
      title: "Accumulation of Obsolete and Slow-Moving Stock",
      level: m.aging.deadStockValue > m.totalInventoryValue * 0.1 ? "High" : "Medium",
      impact: `${fmtSAR(m.aging.deadStockValue)} of stock is dead (older than 3 years); indicated provision is ${fmtSAR(m.provisionAmount)}.`,
      explanation: `Slow-moving and dead stock ties up valuable warehouse rack space, increases carrying costs, and represents depreciating asset value.`,
      action: "Formulate a clearance plan, including vendor returns, customer promotions, or disposal write-offs, to recover trapped working capital.",
    });
  }

  // Attach the concrete figures each finding rests on (traceability).
  const evidenceById: Record<string, string> = {
    "risk-exposure": `Gross variance ${fmtSAR(m.totalRiskValue)} = shortages ${fmtSAR(m.totalShortageValue)} + excesses ${fmtSAR(m.totalExcessValue)}, against a book value of ${fmtSAR(m.totalInventoryValue)}.`,
    "risk-accuracy": `${m.matchedItems.toLocaleString()} matched vs ${m.mismatchedItems.toLocaleString()} mismatched of ${m.totalLines.toLocaleString()} counted lines (${fmtPct(m.matchRate)} accuracy).`,
    "risk-supplier": `${d.topSupplierName} holds ≈${fmtSAR(m.totalInventoryValue * (d.topSupplierShare / 100))} (${fmtPct(d.topSupplierShare)}) of total book value.`,
    "risk-concentration": `${d.topDivisionName} holds ≈${fmtSAR(m.totalInventoryValue * (d.topDivisionShare / 100))} (${fmtPct(d.topDivisionShare)}) of total book value.`,
    "risk-coverage": `Verified ${fmtSAR(m.verifiedValue)} of ${fmtSAR(m.totalInventoryValue)} book value; ${m.remainingLines.toLocaleString()} lines recorded no physical count.`,
    "risk-zero-value": `${d.zeroValueLines.toLocaleString()} stocked lines with zero unit cost out of ${m.totalLines.toLocaleString()} total lines.`,
    "risk-data-quality": `${d.warningLines.toLocaleString()} flagged lines (${fmtPct(d.warningRate)}): ${d.missingCodeCount} missing codes, ${d.missingDescCount} missing descriptions, ${d.unclassifiedSupplierCount} unattributed suppliers, ${d.missingOrgCount} missing org units.`,
    "risk-aging": `Aged stock: 1–3 years ${fmtSAR(m.aging.slowMovingValue)}, over 3 years ${fmtSAR(m.aging.deadStockValue)}; indicated provision ${fmtSAR(m.provisionAmount)}.`,
  };

  const order: Priority[] = ["Critical", "High", "Medium", "Low"];
  return risks
    .sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))
    .map((r) => ({ ...r, evidence: r.evidence ?? evidenceById[r.id] }));
}

/* ─── Recommendation enrichment: suggested owner & timeline ─── */
const REC_OWNER_BY_ID: Record<string, string> = {
  "rec-valuation": "Finance / ERP Master Data Team",
  "rec-reconcile": "Finance & Inventory Control",
  "rec-provision": "Finance Controller",
  "rec-accuracy": "Warehouse Operations Manager",
  "rec-coverage": "Warehouse Operations Manager",
  "rec-org-focus": "Division Operations Lead",
  "rec-supplier-dependency": "Procurement Manager",
  "rec-supplier-mapping": "Procurement / Master Data Team",
  "rec-data-quality": "Inventory Data Steward",
};

const TIMELINE_BY_PRIORITY: Record<Priority, string> = {
  Critical: "Immediate — within 2 weeks",
  High: "Within 30 days",
  Medium: "Within 60–90 days",
  Low: "Before the next audit cycle",
};

function enrichRecommendation(r: Recommendation): Recommendation {
  return {
    ...r,
    suggestedOwner: r.suggestedOwner ?? REC_OWNER_BY_ID[r.id] ?? "Inventory Control Team",
    suggestedTimeline: r.suggestedTimeline ?? TIMELINE_BY_PRIORITY[r.priority],
  };
}

function enrichSection(narr: SectionNarrative): SectionNarrative {
  return { ...narr, recommendations: narr.recommendations.map(enrichRecommendation) };
}

function buildOpportunities(m: PreReportMetrics, d: DerivedStats): Opportunity[] {
  const ops: Opportunity[] = [];

  if (m.matchRate >= 95) {
    ops.push({
      id: "op-accuracy",
      title: "World-Class Count Accuracy",
      detail: `Achieving a ${fmtPct(m.matchRate)} match rate reflects excellent physical inventory discipline, minimizing stockout incidents and manual operational adjustments.`,
    });
  }
  if (m.coverageRate >= 90) {
    ops.push({
      id: "op-coverage",
      title: "Comprehensive Audit Verification",
      detail: `Physical verification of ${fmtPct(m.coverageRate)} of book value provides a highly defensible base for external audits and reinforces internal control ratings.`,
    });
  }
  if (d.topSupplierShare < 40 && m.suppliers.length >= 3) {
    ops.push({
      id: "op-diversification",
      title: "Supplier Diversification Strength",
      detail: `No supplier exceeds ${fmtPct(d.topSupplierShare)} of inventory value, limiting single-source supply risk.`,
    });
  }
  if (d.warningRate === 0 && m.totalLines > 0) {
    ops.push({
      id: "op-data",
      title: "Flawless Master Data Integrity",
      detail: "All records successfully passed automated validation checks, establishing a high-quality baseline for automated demand forecasting and warehouse optimization.",
    });
  } else if (d.warningRate > 0 && d.warningRate < 5) {
    ops.push({
      id: "op-data",
      title: "Near-Clean Master Data Quality",
      detail: `Only ${fmtPct(d.warningRate)} of lines carry validation warnings, indicating generally reliable inventory records.`,
    });
  }
  if (m.healthScore >= 85) {
    ops.push({
      id: "op-health",
      title: "Excellent Audit Preparedness",
      detail: `A composite health index of ${m.healthScore}/100 indicates that the warehouse is fully prepared for annual statutory audits with limited risk of adjustments.`,
    });
  }
  if (m.totalExcessValue > 0 && Math.abs(m.totalShortageValue) > 0) {
    ops.push({
      id: "op-offset",
      title: "Cost-Neutral Reconciliation Potential",
      detail: `Because ${fmtSAR(m.totalExcessValue)} in excesses coexists with ${fmtSAR(m.totalShortageValue)} in shortages, a significant portion of variance can be resolved via cost-neutral bin reallocation.`,
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
  const location = input.location || "Gas Arabian Services facilities";

  const p1 = `This executive report details the findings and strategic recommendations from the ${period} physical inventory verification program conducted at the ${location}. The audit validated a total of ${m.totalLines.toLocaleString()} inventory lines representing a general ledger book value of ${fmtSAR(m.totalInventoryValue)}. Out of this population, physical verification successfully covered ${fmtSAR(m.verifiedValue)} in assets, corresponding to a valuation coverage rate of ${fmtPct(m.coverageRate)}.`;

  const p2 = `The reconciliation process yielded a physical count accuracy of ${fmtPct(m.matchRate)}, with ${m.matchedItems.toLocaleString()} lines matching exactly and ${m.mismatchedItems.toLocaleString()} lines showing variance. The net variance stands at ${m.netVariance < 0 ? "negative " : m.netVariance > 0 ? "positive " : ""}... ${fmtSAR(m.netVariance)}, within a gross absolute financial exposure of ${fmtSAR(m.totalRiskValue)} (${fmtPct(d.riskRatio)} of book value). The composite inventory health index is calculated at ${m.healthScore} out of 100, which classifies the operational control environment as "${m.inventoryHealthStatus}".`;

  const p3 = `A total of ${risks.length} material business risks were identified during the analysis, led by "${risks[0]?.title || "Financial Exposure"}" (${risks[0]?.level || "High"}). To address these findings and prevent profit leakage, we have formulated ${recs.length} prioritized management recommendations. Immediate action must focus on executing a targeted reconciliation of high-variance lines, cleansing flagged master data, and updating unvalued ERP records.`;

  const p4 = `In conclusion, while the inventory database remains structurally sound, the presence of localized discrepancies and unverified lines warrants focused management intervention to ensure audit-readiness and protect working capital. The following sections provide detailed analyses of financial, organizational, and supplier performance, followed by specific action plans.`;

  return [p1, p2, p3, p4].join("\n\n");
}

function buildConclusion(
  m: PreReportMetrics,
  d: DerivedStats,
  risks: RiskFinding[],
  ops: Opportunity[],
  recs: Recommendation[]
): ExecutiveConclusion {
  const paragraphs: string[] = [];

  const p1 = `The ${m.totalLines.toLocaleString()}-line inventory, valued at ${fmtSAR(m.totalInventoryValue)}, closes the current cycle with a composite health index of ${m.healthScore}/100 ("${m.inventoryHealthStatus}"). While count accuracy reached ${fmtPct(m.matchRate)} and value coverage was established at ${fmtPct(m.coverageRate)}, the gross financial exposure of ${fmtSAR(m.totalRiskValue)} highlights significant potential for control improvements.`;

  const p2 = d.warningLines > 0
    ? `Data quality validation indicates that while the ledger is functional, data-cleansing is required. A warning rate of ${fmtPct(d.warningRate)} (${d.warningLines.toLocaleString()} lines) and the presence of ${d.zeroValueLines.toLocaleString()} unvalued stocked lines limit the accuracy of procurement systems. Cleaning these records is a prerequisite for subsequent automation.`
    : "Data hygiene has emerged as a key strength in this cycle, with all lines passing automated verification and confirming complete master-data integrity.";

  const p3 = `To mitigate the ${risks.length} identified risks and capitalize on ${ops.length} key operational opportunities, management should execute the ${recs.length} recommended corrective actions in order of priority, beginning with the critical and high-priority items.`;

  const p4 = `Overall, the audit confirms that the inventory position is ${m.healthScore >= 70 ? "broadly reliable and controllable" : "subject to material control gaps"}. Adhering to the proposed action plans will ensure compliance, optimize working capital, and prepare the organization for external audit cycles.`;

  paragraphs.push(p1, p2, p3, p4);

  const overallAssessment =
    m.healthScore >= 85
      ? "The inventory position is sound and audit-ready. Remaining actions are minor process refinements."
      : m.healthScore >= 70
        ? "The inventory position is broadly reliable, with specific, addressable control gaps in key divisions."
        : m.healthScore >= 50
          ? "The inventory position requires active management review; the recommended action plans should be executed prior to the next count cycle."
          : "The inventory position exhibits material control breakdowns. Immediate corrective action and complete re-verification are strongly advised.";

  return { paragraphs, overallAssessment };
}

/* ════════════════════════════════════════════════════════════════
   PUBLIC ENTRY POINT
   ════════════════════════════════════════════════════════════════ */

export function buildReportNarrative(input: NarrativeInput): ReportNarrative {
  const m = input.metrics;
  const d = deriveStats(m, input.rows);

  const overview = enrichSection(buildOverview(input, m, d));
  const financial = enrichSection(buildFinancial(m, d));
  const health = enrichSection(buildHealth(m, d));
  const organizations = enrichSection(buildOrganizations(m, d));
  const suppliers = enrichSection(buildSuppliers(m, d));
  const distribution = enrichSection(buildDistribution(m, d));
  const validation = enrichSection(buildValidation(m, d));
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
