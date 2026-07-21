import { ReportSection, CoverPageData, EditableContent, UploadedImage, ReportMeta } from "@/types/preReport";
import { PreReportMetrics, ReportNarrative } from "@/lib/report/insightEngine";

export interface QAIssue {
  id: string;
  category: "metadata" | "narrative" | "alignment" | "layout";
  severity: "error" | "warning";
  message: string;
  fixSuggestion?: string;
}

export function runQA({
  sections,
  cover,
  content,
  images,
  metrics,
  narrative,
  reportMeta,
}: {
  sections: ReportSection[];
  cover: CoverPageData;
  content: EditableContent;
  images: UploadedImage[];
  metrics: PreReportMetrics;
  narrative: ReportNarrative;
  reportMeta: ReportMeta;
}): QAIssue[] {
  const issues: QAIssue[] = [];

  // ────────────────────────────────────────────────────────────────
  // 1. Metadata Checks (Cover page and signatories)
  // ────────────────────────────────────────────────────────────────
  if (!cover.reportTitle?.trim()) {
    issues.push({
      id: "meta-title-empty",
      category: "metadata",
      severity: "error",
      message: "Report Title is missing.",
      fixSuggestion: "Enter a descriptive title for your quarterly inventory report.",
    });
  }

  if (!cover.clientName?.trim()) {
    issues.push({
      id: "meta-client-empty",
      category: "metadata",
      severity: "warning",
      message: "Client / Division name is not set on the cover page.",
      fixSuggestion: "Fill in the target client or operational entity name.",
    });
  }

  if (!cover.preparedBy?.trim()) {
    issues.push({
      id: "meta-prep-empty",
      category: "metadata",
      severity: "warning",
      message: "Prepared By signatory is empty.",
      fixSuggestion: "Add the name of the person or team that compiled the report.",
    });
  }

  if (!cover.checkedBy?.trim() || !cover.approvedBy?.trim()) {
    issues.push({
      id: "meta-signatories-empty",
      category: "metadata",
      severity: "warning",
      message: "Auditor signatories (Checked By / Approved By) are incomplete.",
      fixSuggestion: "Fill out the review partners to display on the conclusion signature blocks.",
    });
  }

  // ────────────────────────────────────────────────────────────────
  // 2. Narrative and Section Content Checks
  // ────────────────────────────────────────────────────────────────
  const enabledSections = sections.filter(s => s.enabled);
  
  if (enabledSections.some(s => s.type === "executive")) {
    const execText = content.executiveSummary?.trim() || narrative.executiveSummary;
    if (!execText || execText.length < 20) {
      issues.push({
        id: "narr-exec-empty",
        category: "narrative",
        severity: "error",
        message: "Executive Summary narrative is empty or too short.",
        fixSuggestion: "Write a high-level summary of the findings or use the AI-generated fallback.",
      });
    }
  }

  if (enabledSections.some(s => s.type === "team")) {
    const evidencePhotos = images.filter(img => img.category?.trim() !== "");
    if (evidencePhotos.length === 0) {
      issues.push({
        id: "narr-team-images",
        category: "narrative",
        severity: "warning",
        message: "Personnel & Evidence appendix page is enabled, but no evidence images are uploaded.",
        fixSuggestion: "Disable the Team section, or upload at least one JPG/PNG file in the Images tab.",
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 3. Numerical Cross-Reference Reconciliations
  // ────────────────────────────────────────────────────────────────
  
  // Verify that the total inventory values matches in sub-metrics
  const sumDivValue = metrics.divisions.reduce((sum, d) => sum + d.erpValue, 0);
  const diffDivValue = Math.abs(metrics.totalInventoryValue - sumDivValue);
  if (diffDivValue > 10) { // allow minor rounding offset
    issues.push({
      id: "align-div-value",
      category: "alignment",
      severity: "error",
      message: `Inventory Value Mismatch: Total KPI value (${metrics.totalInventoryValue.toLocaleString()}) does not match Division sum (${sumDivValue.toLocaleString()}).`,
      fixSuggestion: "Check if the division filters or underlying database mappings are aligned.",
    });
  }

  // Verify net variance matches shortage + excess
  const calculatedNet = metrics.totalExcessValue + metrics.totalShortageValue; // shortage is negative
  const diffNet = Math.abs(metrics.netVariance - calculatedNet);
  if (diffNet > 10) {
    issues.push({
      id: "align-variance-calc",
      category: "alignment",
      severity: "error",
      message: `Net Variance Alignment Failure: Reported Net Variance (${metrics.netVariance}) does not match Excess (${metrics.totalExcessValue}) minus Shortage (${Math.abs(metrics.totalShortageValue)}).`,
      fixSuggestion: "Verify the KPI computation engine output before proceeding.",
    });
  }

  // Warning on very high risk value
  if (metrics.totalRiskValue > metrics.totalInventoryValue * 0.3) {
    issues.push({
      id: "align-high-risk",
      category: "alignment",
      severity: "warning",
      message: `Extremely High Financial Exposure: Gross Risk Value exceeds 30% of total book value.`,
      fixSuggestion: "Double check top risk items to ensure correct unit costs are imported.",
    });
  }

  // ────────────────────────────────────────────────────────────────
  // 4. Layout & PDF compilation bugs
  // ────────────────────────────────────────────────────────────────
  if (metrics.highestRiskItems.length > 8) {
    issues.push({
      id: "layout-risk-ledger-overflow",
      category: "layout",
      severity: "warning",
      message: "The Key Risks table lists more than 8 items. This might overflow the A4 page boundaries.",
      fixSuggestion: "Verify page layouts in the live report preview.",
    });
  }

  if (metrics.divisions.length > 9) {
    issues.push({
      id: "layout-divisions-overflow",
      category: "layout",
      severity: "warning",
      message: `The Divisions table lists ${metrics.divisions.length} rows. A4 print rules limit it to the top 9.`,
      fixSuggestion: "The layout automatically slices at the top 9, but please verify representation.",
    });
  }

  return issues;
}
