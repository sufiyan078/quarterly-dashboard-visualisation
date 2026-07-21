import {
  ReportSection, CoverPageData, EditableContent, UploadedImage, ApprovalState, SupplierImageMapping,
  DEFAULT_SECTIONS, DEFAULT_COVER, DEFAULT_CONTENT, DEFAULT_APPROVAL, mergeWithDefaultSections,
  ReportSectionType
} from "@/types/preReport";
import { ReportAnalytics, buildReportAnalytics } from "@/lib/report/analytics";
import { ReportNarrative, buildReportNarrative, PreReportMetrics } from "@/lib/report/insightEngine";

export interface SharedReportPage {
  pageIndex: number;
  totalPages: number;
  sectionId: string;
  sectionType: ReportSectionType;
  title: string;
  kicker: string;
  subtitle?: string;
  description: string;
  notes?: string;
  pageData?: any;
}

export interface SharedReportModel {
  sections: ReportSection[];
  enabledSections: ReportSection[];
  cover: CoverPageData;
  content: EditableContent;
  images: UploadedImage[];
  proofImages: UploadedImage[];
  metrics: PreReportMetrics;
  narrative: ReportNarrative;
  analytics: ReportAnalytics;
  reportMeta: { quarter: string; year: number | string; location: string };
  supplierImageMapping: SupplierImageMapping;
  approval: ApprovalState;
  pages: SharedReportPage[];
  totalPages: number;
  generatedAt: string;
}

export interface BuildReportModelInput {
  sections?: ReportSection[];
  cover?: Partial<CoverPageData>;
  content?: Partial<EditableContent>;
  images?: UploadedImage[];
  approval?: Partial<ApprovalState>;
  supplierImageMapping?: SupplierImageMapping;
  formattedRows: any[];
  agingRecords?: any[];
  reportMeta: { quarter: string; year: number | string; location: string; title?: string; warehouseName?: string };
  totalPagesOverride?: number;
}

export function getProofImagesFromList(images: UploadedImage[]): UploadedImage[] {
  return (images || []).filter(
    img => !String(img.category || "").toLowerCase().includes("logo") && !img.supplierName
  );
}

export const PROOFS_PER_PAGE = 6;

import { resolveClientName, resolveReportingPeriod } from "./reportResolvers";

export function buildSharedReportModel(input: BuildReportModelInput): SharedReportModel {
  const mergedSections = mergeWithDefaultSections(input.sections);
  const enabledSections = mergedSections.filter(s => s.enabled);

  const resolvedClient = resolveClientName(
    input.cover?.clientName,
    input.reportMeta.warehouseName,
    input.reportMeta.location
  );

  const resolvedPeriod = resolveReportingPeriod(
    input.cover?.reportingPeriod,
    input.reportMeta.quarter,
    input.reportMeta.year
  );

  const cover: CoverPageData = {
    ...DEFAULT_COVER,
    ...input.cover,
    reportTitle: input.cover?.reportTitle || input.reportMeta.title || "Physical Inventory Verification Report",
    clientName: resolvedClient,
    reportingPeriod: resolvedPeriod,
  };

  const content: EditableContent = {
    ...DEFAULT_CONTENT,
    ...input.content,
  };

  const images = input.images || [];
  const proofImages = getProofImagesFromList(images);
  const supplierImageMapping = input.supplierImageMapping || {};
  const approval: ApprovalState = {
    ...DEFAULT_APPROVAL,
    ...input.approval,
  };

  const analytics = buildReportAnalytics(input.formattedRows, input.agingRecords || []);
  const metrics = analytics.metrics;

  const narrative = buildReportNarrative({
    quarter: String(input.reportMeta.quarter || ""),
    year: String(input.reportMeta.year || ""),
    clientName: cover.clientName,
    location: input.reportMeta.location,
    metrics,
    rows: input.formattedRows,
  });

  // Calculate total pages for page numbering
  const corePageCount = enabledSections.reduce((sum, s) => {
    if (s.type === "team") return sum + Math.ceil(proofImages.length / PROOFS_PER_PAGE);
    return sum + 1;
  }, 0);

  const totalPages = input.totalPagesOverride && input.totalPagesOverride > corePageCount
    ? input.totalPagesOverride
    : corePageCount;

  // Build page models in deterministic order
  const pages: SharedReportPage[] = [];
  let currentPageIndex = 1;

  for (const s of enabledSections) {
    if (s.type === "team") {
      const pageCount = Math.ceil(proofImages.length / PROOFS_PER_PAGE);
      if (pageCount === 0) {
        // If team section enabled but 0 proof images, render single page or skip
        pages.push({
          pageIndex: currentPageIndex++,
          totalPages,
          sectionId: s.id,
          sectionType: s.type,
          title: s.title,
          kicker: "Verification Evidence",
          description: s.description,
          notes: s.notes,
          pageData: { chunk: [], pageNumber: 1, totalProofPages: 1 },
        });
      } else {
        for (let p = 0; p < pageCount; p++) {
          const chunk = proofImages.slice(p * PROOFS_PER_PAGE, (p + 1) * PROOFS_PER_PAGE);
          pages.push({
            pageIndex: currentPageIndex++,
            totalPages,
            sectionId: s.id,
            sectionType: s.type,
            title: p === 0 ? s.title : `${s.title} (Continued)`,
            kicker: "Verification Evidence",
            description: s.description,
            notes: s.notes,
            pageData: { chunk, pageNumber: p + 1, totalProofPages: pageCount },
          });
        }
      }
    } else {
      let kicker = "System Generated · 100% Deterministic";
      let subtitle: string | undefined = undefined;

      switch (s.type) {
        case "cover": kicker = "Audit Report"; break;
        case "executive": kicker = "System Generated · 100% Deterministic"; break;
        case "kpi": kicker = "Portfolio Overview"; break;
        case "coverage": kicker = "Coverage & Variance"; break;
        case "divisions": kicker = "Division Analysis"; break;
        case "divisionItems": kicker = "Division Analysis"; break;
        case "workbooks": kicker = "Data Sources"; break;
        case "suppliers": kicker = "Supplier Analysis"; break;
        case "supplierSpotlight":
          kicker = "Supplier Deep-Dive";
          break;
        case "suppliersAll":
          kicker = "Supplier Analysis";
          subtitle = "Detailed inventory analytics for all resolved supplier entities · Top 15 by absolute variance";
          break;
        case "workforce": kicker = "Workforce Analysis"; break;
        case "leaderboard": kicker = "Workforce Analysis"; break;
        case "risk": kicker = "Financial Risk"; break;
        case "riskItems": kicker = "Financial Risk"; break;
        case "validation": kicker = "Full Registry"; break;
        case "actionItems": kicker = "Full Registry"; break;
        case "backcover": kicker = "Closing Page"; break;
      }

      pages.push({
        pageIndex: currentPageIndex++,
        totalPages,
        sectionId: s.id,
        sectionType: s.type,
        title: s.title,
        kicker,
        subtitle,
        description: s.description,
        notes: s.notes,
      });
    }
  }

  return {
    sections: mergedSections,
    enabledSections,
    cover,
    content,
    images,
    proofImages,
    metrics,
    narrative,
    analytics,
    reportMeta: {
      quarter: String(input.reportMeta.quarter || ""),
      year: input.reportMeta.year,
      location: input.reportMeta.location || "",
    },
    supplierImageMapping,
    approval,
    pages,
    totalPages,
    generatedAt: new Date().toISOString(),
  };
}
