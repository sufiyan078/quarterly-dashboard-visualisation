export interface DetectedColumn {
  sheetName: string;
  sourceColumn: string;
  mappedField: string; // The standard schema field name or 'ignored'
}

export interface IgnoredColumn {
  sheetName: string;
  sourceColumn: string;
  reason: string; // e.g. "Aging Column" or "Unrecognized Column"
}

export interface ParsedInventoryRow {
  reportId: string;
  sourceFileName: string;
  sheetName: string;
  originalRowNumber: number; // 1-based row number in the excel sheet
  item: string;
  description: string;
  org: string;
  supplier: string;
  totalValueSar: number | null;
  valueSource?: "direct" | "derived" | "missing";
  valueFormula?: string;
  systemOnHand: number;
  physicalCount: number;
  variation: number;
  remarks: string;
  reported: string;
  // Supplier detection — required on every imported row
  supplierName: string;
  detectedSupplierName: string;
  supplierDetectionMethod: string;
}

export interface IgnoredInventoryRow {
  sourceFileName: string;
  sheetName: string;
  originalRowNumber: number;
  rawRowData: Record<string, unknown>;
  category: "ignored_header_row" | "ignored_empty_row" | "ignored_total_row" | "ignored_summary_row";
  reason: string;
}

export interface NeedsReviewInventoryRow {
  sourceFileName: string;
  sheetName: string;
  originalRowNumber: number;
  rawRowData: Record<string, unknown>;
  category: "needs_review_possible_item";
  reason: string;
  /** Phase 4B: Dataset type of the source sheet */
  datasetType?: string;
  /** Phase 4B: Mapped fields found on this row */
  mappedFieldsFound?: string[];
  /** Phase 4B: Missing fields on this row */
  missingFields?: string[];
  /** Phase 4B: All validation issue codes */
  validationCodes?: string[];
}

/** Phase 4B: Per-sheet diagnosis report */
export interface SheetDiagnosisResult {
  sourceFileName: string;
  sheetName: string;
  datasetType: string;
  totalRowsScanned: number;
  importedRows: number;
  ignoredTechnicalRows: number;
  needsReviewRows: number;
  detectedStandardColumns: string[];
  detectedAgingColumns: string[];
  missingExpectedColumns: string[];
  mappingFailureWarnings: { field: string; message: string }[];
  confidenceLevel: "high" | "medium" | "low";
  financialDiscovery?: {
    headerRowIndex: number;
    allHeaderNames: string[];
    candidateColumns: {
      columnName: string;
      columnIndex: number;
      numericCellCount: number;
      blankCellCount: number;
      sampleValues: string[];
      isRejected: boolean;
      rejectionReason?: string;
    }[];
    selectedValueColumn: string | null;
    selectedValueColumnName: string | null;
    confidence: "high" | "medium" | "low" | "none";
    reason: string;
  };
}

// ─── Phase 4C: Data Profiling Engine Interfaces ─────────────────────────────

export interface ProfilerRowAccountability {
  totalRows: number;
  importedRows: number;
  ignoredRows: number;
  needsReviewRows: number;
  accountabilityCheckPassed: boolean;
  integrityCheckPassed?: boolean;
  totalWorksheetRows: number;
  importedInventoryRows: number;
  ignoredTechnicalRows: number;
}

export interface ProfilerItemProfile {
  totalItemRows: number;
  uniqueItemCodes: number;
  duplicateItemCodesCount: number;
  blankItemCount: number;
  blankDescriptionCount: number;
  sampleDuplicateItems: string[];
  duplicateItemCodes: string[];
  blankItemCodesCount: number;
  blankDescriptionsCount: number;
}

export interface ProfilerOrgProfile {
  uniqueOrgs: number;
  blankOrgCount: number;
  topOrgsByRowCount: { org: string; count: number }[];
  topOrgsByTotalValue: { org: string; totalValue: number }[];
  topOrgByRows?: string;
  topOrgByValue?: string;
  blankOrgsCount: number;
}

export interface ProfilerSupplierProfile {
  uniqueSuppliers: number;
  blankSupplierCount: number;
  othersSupplierCount: number;
  topSuppliersByRowCount: { supplier: string; count: number }[];
  topSuppliersByTotalValue: { supplier: string; totalValue: number }[];
  topSupplierByRows?: string;
  topSupplierByValue?: string;
  blankSuppliersCount: number;
}

export interface ProfilerValueProfile {
  totalInventoryValueSar: number;
  blankValueCount: number;
  invalidValueCount: number;
  zeroValueCount: number;
  negativeValueCount: number;
  topHighestValueItems: { item: string; description: string; value: number }[];
  totalInventoryValue: number;
  blankOrInvalidValueCount: number;
  financialValueStatus: "not_found" | "all_zero" | "all_blank" | "parsed_successfully";
}

export interface ProfilerQuantityProfile {
  hasQuantityData: boolean;
  totalSystemOnHand: number;
  totalPhysicalCount: number;
  blankSystemOnHandCount: number;
  blankPhysicalCountCount: number;
  negativeQuantityCount: number;
  variationMismatchCount: number;
  negativeQuantitiesCount: number;
  missingPhysicalCountCount: number;
}

export interface ProfilerAgingProfile {
  hasAgingData: boolean;
  totalAgingRows: number;
  detectedAgingBuckets: string[];
  totalValueByAgingBucket: Record<string, number>;
  agingBucketRowsMissingItemCode: number;
  valueBreakdownByAgingBucket: Record<string, number>;
}

export interface ProfilerWarning {
  code: string;
  message: string;
  severity: "warning" | "error" | "info";
}

export interface InventoryDataProfile {
  rowAccountability: ProfilerRowAccountability;
  itemProfile: ProfilerItemProfile;
  organizationProfile: ProfilerOrgProfile;
  orgProfile: ProfilerOrgProfile;
  supplierProfile: ProfilerSupplierProfile;
  valueProfile: ProfilerValueProfile;
  quantityProfile: ProfilerQuantityProfile;
  agingProfile: ProfilerAgingProfile;
  warnings: ProfilerWarning[];
}

export interface ParsedWorkbookResult {
  totalFiles: number;
  totalSheets: number;
  totalRows: number;
  parsedRows: ParsedInventoryRow[];
  ignoredRows: IgnoredInventoryRow[];
  needsReviewRows: NeedsReviewInventoryRow[];
  rejectedRows: NeedsReviewInventoryRow[]; // Kept for backwards compatibility
  detectedColumns: DetectedColumn[];
  ignoredColumns: IgnoredColumn[];
  missingRequiredColumns: string[];
  /** Phase 4B: Per-sheet diagnosis data */
  sheetDiagnoses?: SheetDiagnosisResult[];
  /** Phase 4C: Data profile of the uploaded workbook(s) */
  dataProfile?: InventoryDataProfile;
  /** Phase 4D/5: Aging data records extracted from sheets */
  agingData?: any[];
}


