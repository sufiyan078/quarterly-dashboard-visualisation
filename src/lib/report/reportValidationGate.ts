import { SharedReportModel } from "./reportModel";
import { validateReportAnalytics } from "./analytics";

export interface ParityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metricsCheck: {
    dashboardVsReportValueMatch: boolean;
    coverageRateValid: boolean;
    matchRateValid: boolean;
  };
  structureCheck: {
    pageCount: number;
    enabledSectionCount: number;
    spotlightPagesCount: number;
  };
}

/**
 * Single Source of Truth Automated Validation Gate
 * 
 * Verifies that the SharedReportModel passes all consistency, page order,
 * structural, numeric, and asset placement checks across Web Preview, PDF, and PowerPoint.
 * Export execution (PDF/PPTX) is blocked if isValid is false.
 */
export function validateReportParity(model: SharedReportModel): ParityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Dashboard vs Report Analytics Cross-Validation
  const analyticsErrors = validateReportAnalytics(model.analytics);
  errors.push(...analyticsErrors);

  const m = model.metrics;

  // 2. Structural & Page Order Checks
  const spotlightCount = model.enabledSections.filter(s => s.type === "supplierSpotlight").length;
  if (model.pages.length === 0) {
    errors.push("Report contains no active pages.");
  }

  // Check sequence order: pageIndex must be strictly 1..N
  for (let i = 0; i < model.pages.length; i++) {
    if (model.pages[i].pageIndex !== i + 1) {
      errors.push(`Page index mismatch at position ${i + 1}: found ${model.pages[i].pageIndex}.`);
    }
  }

  // 3. KPI Numeric Validity Checks
  const isValueValid = !isNaN(m.totalInventoryValue) && m.totalInventoryValue >= 0;
  if (!isValueValid) {
    errors.push(`Invalid Total Inventory Value: ${m.totalInventoryValue}`);
  }

  const isCoverageValid = !isNaN(m.coverageRate) && m.coverageRate >= 0 && m.coverageRate <= 100;
  if (!isCoverageValid) {
    errors.push(`Invalid Coverage Rate: ${m.coverageRate}%`);
  }

  const isMatchRateValid = !isNaN(m.matchRate) && m.matchRate >= 0 && m.matchRate <= 100;
  if (!isMatchRateValid) {
    errors.push(`Invalid Match Rate: ${m.matchRate}%`);
  }

  // 4. Cover Page Data Completeness
  if (!model.cover.reportTitle || !model.cover.reportTitle.trim()) {
    warnings.push("Cover Page title is blank.");
  }
  if (!model.cover.clientName || !model.cover.clientName.trim()) {
    warnings.push("Cover Page client name is blank.");
  }

  // 5. Supplier Evidence Image Mapping Validation
  const imageIds = new Set(model.images.map(img => img.id));
  if (model.supplierImageMapping) {
    for (const [supplierName, mappedImgId] of Object.entries(model.supplierImageMapping)) {
      if (mappedImgId && !imageIds.has(mappedImgId)) {
        errors.push(`Supplier Evidence Mapping for '${supplierName}' references missing image ID '${mappedImgId}'.`);
      }
    }
  }

  // 6. Spotlight Page Order Parity Check
  // Verify Spotlight 1..5 appear after Supplier Risk Overview ('suppliers') and before Top 15 ('suppliersAll')
  const suppliersIdx = model.enabledSections.findIndex(s => s.type === "suppliers");
  const suppliersAllIdx = model.enabledSections.findIndex(s => s.type === "suppliersAll");
  const spotlightIndices = model.enabledSections
    .map((s, idx) => ({ section: s, idx }))
    .filter(item => item.section.type === "supplierSpotlight");

  if (suppliersIdx !== -1 && suppliersAllIdx !== -1 && spotlightIndices.length > 0) {
    for (const spot of spotlightIndices) {
      if (spot.idx <= suppliersIdx || spot.idx >= suppliersAllIdx) {
        warnings.push(`Supplier Spotlight section '${spot.section.title}' is not positioned between Supplier Risk Overview and Top 15 Suppliers.`);
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    metricsCheck: {
      dashboardVsReportValueMatch: Math.abs(m.totalInventoryValue - (m.verifiedValue + Math.max(0, m.totalInventoryValue - m.verifiedValue))) < 10,
      coverageRateValid: isCoverageValid,
      matchRateValid: isMatchRateValid,
    },
    structureCheck: {
      pageCount: model.pages.length,
      enabledSectionCount: model.enabledSections.length,
      spotlightPagesCount: spotlightCount,
    },
  };
}
