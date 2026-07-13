export type ReportSectionType =
  | 'cover'
  | 'toc'
  | 'executive'
  | 'kpi'            // Inventory Overview (facts grid)
  | 'financial'      // Financial Overview
  | 'health'         // Inventory Health
  | 'divisions'      // Organization Analysis
  | 'suppliers'      // Supplier Analysis
  | 'distribution'   // Inventory Distribution
  | 'validation'     // Validation Summary
  | 'risk'           // Key Risks & risk assessment
  | 'opportunities'  // Business Opportunities
  | 'recommendations'// Consolidated Recommendations
  | 'conclusion'     // Executive Conclusion
  | 'team'           // Personnel & Evidence appendix
  | 'backcover'      // Template "Thank You" closing page
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
  category: 'company_logo' | 'client_logo' | 'warehouse' | 'inventory' | 'supporting';
}

export interface ApprovalState {
  reportReviewed: boolean;
  layoutVerified: boolean;
  chartsVerified: boolean;
  tablesVerified: boolean;
  readyForExport: boolean;
}

export const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'cover', title: 'Cover Page', type: 'cover', enabled: true, order: 0, description: 'Report title, metadata, and branding', notes: '' },
  { id: 'toc', title: 'Table of Contents', type: 'toc', enabled: true, order: 1, description: 'Report contents, sections, and page references', notes: '' },
  { id: 'executive', title: 'Executive Summary', type: 'executive', enabled: true, order: 2, description: 'The complete inventory position in one page for senior management', notes: '' },
  { id: 'kpi', title: 'Inventory Overview', type: 'kpi', enabled: true, order: 3, description: 'Scale of the inventory: lines, value, organizations, and suppliers', notes: '' },
  { id: 'financial', title: 'Financial Overview', type: 'financial', enabled: true, order: 4, description: 'Book value versus verified value, variances, and financial exposure', notes: '' },
  { id: 'health', title: 'Inventory Health', type: 'health', enabled: true, order: 5, description: 'Composite health score, accuracy, and verification coverage', notes: '' },
  { id: 'divisions', title: 'Organization Analysis', type: 'divisions', enabled: true, order: 6, description: 'Value, accuracy, and variance by organization', notes: '' },
  { id: 'suppliers', title: 'Supplier Analysis', type: 'suppliers', enabled: true, order: 7, description: 'Supplier dependency, concentration, and variance exposure', notes: '' },
  { id: 'distribution', title: 'Inventory Distribution', type: 'distribution', enabled: true, order: 8, description: 'How value and volume are spread across the operation', notes: '' },
  { id: 'validation', title: 'Validation Summary', type: 'validation', enabled: true, order: 9, description: 'Data quality flags and reporting confidence', notes: '' },
  { id: 'risk', title: 'Key Risks', type: 'risk', enabled: true, order: 10, description: 'Data-supported business risks and the high-variance item ledger', notes: '' },
  { id: 'opportunities', title: 'Business Opportunities', type: 'opportunities', enabled: true, order: 11, description: 'Positive findings and improvement opportunities', notes: '' },
  { id: 'recommendations', title: 'Recommendations', type: 'recommendations', enabled: true, order: 12, description: 'Prioritized management actions with reasons and expected benefits', notes: '' },
  { id: 'conclusion', title: 'Executive Conclusion', type: 'conclusion', enabled: true, order: 13, description: 'Overall assessment, audit readiness, and sign-off', notes: '' },
  { id: 'team', title: 'Personnel & Evidence', type: 'team', enabled: true, order: 14, description: 'On-site audit team and verification evidence', notes: '' },
  { id: 'backcover', title: 'Closing Page', type: 'backcover', enabled: true, order: 15, description: 'Branded thank-you page closing the report', notes: '' },
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

  // Legacy (pre-storytelling) schema: rebuild from defaults, carrying over
  // the user's enabled flags and notes for sections that still exist.
  const isCurrentSchema = saved.some(s => s.id === 'conclusion');
  if (!isCurrentSchema) {
    const savedById = new Map(saved.map(s => [s.id, s]));
    const merged = DEFAULT_SECTIONS.map(def => {
      const prev = savedById.get(def.id);
      return prev ? { ...def, enabled: prev.enabled, notes: prev.notes } : { ...def };
    });
    const customs = saved.filter(s => s.type === 'custom');
    customs.forEach((c, i) => merged.push({ ...c, order: merged.length + i }));
    return merged;
  }

  // Current schema: keep the user's list (order, titles, customizations)
  // but union in any default sections introduced after their config was
  // saved (e.g. 'toc', 'backcover'), inserted at their default position
  // relative to the sections the user already has.
  const savedIds = new Set(saved.map(s => s.id));
  const result = [...saved].sort((a, b) => a.order - b.order);

  for (const def of DEFAULT_SECTIONS) {
    if (savedIds.has(def.id)) continue;

    // Find the default section that precedes `def` and exists in the saved
    // list; insert right after it (or at the start if none).
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
