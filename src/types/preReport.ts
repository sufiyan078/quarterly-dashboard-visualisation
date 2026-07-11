export interface ReportSection {
  id: string;
  title: string;
  type: 'cover' | 'kpi' | 'executive' | 'divisions' | 'suppliers' | 'risk' | 'team' | 'custom';
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
  { id: 'kpi', title: 'Executive KPIs', type: 'kpi', enabled: true, order: 1, description: 'Key performance indicators and health score', notes: '' },
  { id: 'executive', title: 'Executive Summary & Audit Opinion', type: 'executive', enabled: true, order: 2, description: 'Financial overview, coverage, and audit conclusion', notes: '' },
  { id: 'divisions', title: 'Operational Divisions Breakdown', type: 'divisions', enabled: true, order: 3, description: 'Variance and reconciliation by business division', notes: '' },
  { id: 'suppliers', title: 'Supplier Analysis', type: 'suppliers', enabled: true, order: 4, description: 'Top suppliers by financial risk exposure', notes: '' },
  { id: 'risk', title: 'High-Risk Items Ledger', type: 'risk', enabled: true, order: 5, description: 'Top 10 discrepancy items requiring attention', notes: '' },
  { id: 'team', title: 'Personnel & Evidence', type: 'team', enabled: true, order: 6, description: 'On-site audit team and verification evidence', notes: '' },
];

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
