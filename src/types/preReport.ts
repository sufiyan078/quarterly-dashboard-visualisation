export type ReportSectionType =
  | 'cover'
  | 'toc'
  | 'executive'      // Executive Insights & Summary (client p.2)
  | 'kpi'            // Portfolio Overview — Inventory Health & Accuracy (client p.3)
  | 'coverage'       // Coverage & Variance — Division Coverage & Supplier Risk (client p.4)
  | 'financial'      // (legacy) Financial Overview
  | 'health'         // (legacy) Inventory Health
  | 'divisions'      // Division Analysis — Reconciliation Performance (client p.5)
  | 'divisionItems'  // Division Items Mapped & Risk Table (client p.6)
  | 'workbooks'      // Workbook Ingestion & Count Comparison (client p.7)
  | 'suppliers'      // Supplier Analysis — Supplier Risk Overview (client p.8)
  | 'suppliersAll'   // All Suppliers Breakdown (client p.9)
  | 'workforce'      // Workforce Analysis — Count Team Performance (client p.10)
  | 'leaderboard'    // Physical Count Team Leaderboard (client p.11)
  | 'distribution'   // (legacy) Inventory Distribution
  | 'validation'     // Full Registry — Reconciliation Registry Overview (client p.14)
  | 'risk'           // Financial Risk — High-Risk Discrepancy Analysis (client p.12)
  | 'riskItems'      // Top 10 High-Risk Discrepancy Items (client p.13)
  | 'actionItems'    // Items Requiring Action (client p.15)
  | 'opportunities'  // (legacy) Business Opportunities
  | 'recommendations'// (legacy) Consolidated Recommendations
  | 'conclusion'     // (legacy) Executive Conclusion
  | 'team'           // Proofs & Site Photographs (dynamic, client p.16, skipped when empty)
  | 'backcover'      // Thank You closing page
  | 'custom';

export interface ReportSection {
  id: string;
  title: string;
  type: ReportSectionType;
  enabled: boolean;
  order: number;
  description: string;
  notes: string;
}

export interface CoverPageData {
  reportTitle: string;
  reportSubtitle: string;
  clientName: string;
  reportingPeriod: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  confidentialityStatement: string;
  companyLogoUrl: string;
  clientLogoUrl: string;
}

export interface EditableContent {
  executiveSummary: string;
  recommendations: string;
  auditorRemarks: string;
  observations: string;
}

export interface UploadedImage {
  id: string;
  name: string;
  url: string;
  caption: string;
  category: string;
}

export interface ApprovalState {
  reportReviewed: boolean;
  layoutVerified: boolean;
  chartsVerified: boolean;
  tablesVerified: boolean;
  readyForExport: boolean;
}

/**
 * Default flow mirrors the client-approved reference report
 * (Physical_Inventory_Verification_Report.pdf) page-for-page.
 * The Proofs section expands to as many pages as uploaded images
 * require and is skipped entirely when no images exist.
 */
export const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'cover', title: 'Physical Inventory Verification Report', type: 'cover', enabled: true, order: 0, description: 'Cover page with report date and health score', notes: '' },
  { id: 'executive', title: 'Executive Insights & Summary', type: 'executive', enabled: true, order: 1, description: 'Headline KPIs, operational concentration, and key observations', notes: '' },
  { id: 'kpi', title: 'Inventory Health & Accuracy', type: 'kpi', enabled: true, order: 2, description: 'Portfolio overview: valuation, verification, health score, and accuracy breakdown', notes: '' },
  { id: 'coverage', title: 'Division Coverage & Supplier Risk', type: 'coverage', enabled: true, order: 3, description: 'Coverage rate by cost center, top suppliers by variance, and count progress', notes: '' },
  { id: 'divisions', title: 'Reconciliation Performance by Division', type: 'divisions', enabled: true, order: 4, description: 'Division analysis: scope, highlights, and net operational variance', notes: '' },
  { id: 'divisionItems', title: 'Division Items Mapped & Risk Table', type: 'divisionItems', enabled: true, order: 5, description: 'Item catalog distribution by cost center and top variance divisions', notes: '' },
  { id: 'workbooks', title: 'Workbook Ingestion & Count Comparison', type: 'workbooks', enabled: true, order: 6, description: 'Ingested worksheet statistics and physical vs system quantities', notes: '' },
  { id: 'suppliers', title: 'Supplier Risk Overview', type: 'suppliers', enabled: true, order: 7, description: 'Supplier analysis: mapped entities, exposure, and variance share', notes: '' },
  { id: 'suppliersAll', title: 'All Suppliers Breakdown', type: 'suppliersAll', enabled: true, order: 8, description: 'Detailed inventory analytics for all resolved supplier entities', notes: '' },
  { id: 'workforce', title: 'Count Team Performance', type: 'workforce', enabled: true, order: 9, description: 'Workforce analysis: active counters, productivity, and accuracy', notes: '' },
  { id: 'leaderboard', title: 'Physical Count Team Leaderboard', type: 'leaderboard', enabled: true, order: 10, description: 'Verification speed and accuracy metrics for field counters', notes: '' },
  { id: 'risk', title: 'High-Risk Discrepancy Analysis', type: 'risk', enabled: true, order: 11, description: 'Financial risk: absolute exposure and where it concentrates', notes: '' },
  { id: 'riskItems', title: 'Top 10 High-Risk Discrepancy Items', type: 'riskItems', enabled: true, order: 12, description: 'Item rows representing the highest financial vulnerability', notes: '' },
  { id: 'validation', title: 'Reconciliation Registry Overview', type: 'validation', enabled: true, order: 13, description: 'Full registry: filtered stats and action-required summary', notes: '' },
  { id: 'actionItems', title: 'Items Requiring Action', type: 'actionItems', enabled: true, order: 14, description: 'High-risk open items requiring management follow-up', notes: '' },
  { id: 'team', title: 'Proofs & Site Photographs', type: 'team', enabled: true, order: 15, description: 'Uploaded proof photographs; expands to extra pages, skipped when empty', notes: '' },
  { id: 'backcover', title: 'Thank You', type: 'backcover', enabled: true, order: 16, description: 'Closing page', notes: '' },
];

/**
 * Merges a previously saved section configuration (possibly from the
 * older 7-section schema) with the current storytelling defaults.
 * User customizations (enabled flag, notes) survive for sections that
 * still exist; new narrative sections are added in story order; any
 * custom sections the user created are appended at the end.
 */
export function mergeWithDefaultSections(saved: ReportSection[] | undefined): ReportSection[] {
  if (!saved || saved.length === 0) return DEFAULT_SECTIONS;

  // Configs saved before the client-blueprint flow (identified by the
  // absence of the 'coverage' section) are rebuilt on the fixed client
  // page sequence. Enabled flags and notes carry over for sections that
  // still exist; sections not in the blueprint are dropped from the flow
  // (their renderers remain available via custom re-adding).
  const isClientSchema = saved.some(s => s.id === 'coverage');
  if (!isClientSchema) {
    const savedById = new Map(saved.map(s => [s.id, s]));
    const merged = DEFAULT_SECTIONS.map(def => {
      const prev = savedById.get(def.id);
      return prev ? { ...def, enabled: prev.enabled, notes: prev.notes } : { ...def };
    });
    const customs = saved.filter(s => s.type === 'custom');
    customs.forEach((c, i) => merged.push({ ...c, order: merged.length + i }));
    return merged;
  }

  // Client schema: keep the user's list but union in any newly introduced
  // default sections at their blueprint position.
  const savedIds = new Set(saved.map(s => s.id));
  const result = [...saved].sort((a, b) => a.order - b.order);

  for (const def of DEFAULT_SECTIONS) {
    if (savedIds.has(def.id)) continue;
    const defIdx = DEFAULT_SECTIONS.findIndex(d => d.id === def.id);
    let insertAt = 0;
    for (let i = defIdx - 1; i >= 0; i--) {
      const anchorIdx = result.findIndex(s => s.id === DEFAULT_SECTIONS[i].id);
      if (anchorIdx !== -1) { insertAt = anchorIdx + 1; break; }
    }
    result.splice(insertAt, 0, { ...def });
    savedIds.add(def.id);
  }

  return result.map((s, i) => ({ ...s, order: i }));
}

export const DEFAULT_COVER: CoverPageData = {
  reportTitle: '',
  reportSubtitle: 'Physical Inventory Verification & Reconciliation',
  clientName: '',
  reportingPeriod: '',
  preparedBy: '',
  checkedBy: '',
  approvedBy: '',
  confidentialityStatement: 'CONFIDENTIAL — This document contains proprietary inventory data. Unauthorized distribution is prohibited.',
  companyLogoUrl: '',
  clientLogoUrl: '',
};

export const DEFAULT_CONTENT: EditableContent = {
  executiveSummary: '',
  recommendations: '',
  auditorRemarks: '',
  observations: '',
};

export const DEFAULT_APPROVAL: ApprovalState = {
  reportReviewed: false,
  layoutVerified: false,
  chartsVerified: false,
  tablesVerified: false,
  readyForExport: false,
};
