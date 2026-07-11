/**
 * Inventory Intelligence Engine — Type Definitions
 * 
 * All interfaces for the decomposed ingestion pipeline.
 * Re-exports legacy types for backward compatibility.
 */

// ─── Re-export legacy types for backward compat ─────────────────────────────
export type {
  ParsedInventoryRow,
  IgnoredInventoryRow,
  NeedsReviewInventoryRow,
  DetectedColumn,
  IgnoredColumn,
  ParsedWorkbookResult,
} from "../../types/inventory";

// ─── Stage 2: Structure Detection ───────────────────────────────────────────

/** 5-type dataset classification for each sheet */
export type DatasetType =
  | "inventory_count_sheet"
  | "inventory_aging_sheet"
  | "mixed_inventory_sheet"
  | "summary_sheet"
  | "unknown_sheet";

export interface ColumnMapping {
  columnIndex: number;
  sourceColumnName: string;
  /** The standard field this column maps to, or null if unrecognized */
  mappedField: string | null;
  mappingType: "standard" | "aging" | "ignored";
}

export interface SheetStructure {
  sheetName: string;
  sheetType: "inventory_sheet" | "summary_sheet" | "unknown_sheet";
  /** More granular dataset type — drives validation rules */
  datasetType: DatasetType;
  headerRowIndex: number;
  totalRawRows: number;
  columnMap: ColumnMapping[];
  agingColumnIndices: number[];
  /** Raw row data from SheetJS (header:1 mode) */
  rawRows: unknown[][];
  /** The header row cells for reference */
  headerCells: unknown[];
}

// ─── Sheet Diagnosis ────────────────────────────────────────────────────────

export interface MappingFailureWarning {
  field: string;
  message: string;
}

export interface SheetDiagnosis {
  sourceFileName: string;
  sheetName: string;
  datasetType: DatasetType;
  totalRowsScanned: number;
  importedRows: number;
  ignoredTechnicalRows: number;
  needsReviewRows: number;
  detectedStandardColumns: string[];
  detectedAgingColumns: string[];
  missingExpectedColumns: string[];
  mappingFailureWarnings: MappingFailureWarning[];
  confidenceLevel: "high" | "medium" | "low";
}

/** Fields that indicate an inventory-count sheet */
export const INVENTORY_COUNT_FIELDS = [
  "systemOnHand", "physicalCount", "variation",
];

/** Fields that are common to all inventory sheets */
export const INVENTORY_CORE_FIELDS = [
  "item", "description", "supplier", "org", "totalValueSar",
];

// ─── Stage 4: Aging Extraction ──────────────────────────────────────────────

export type AgingBucketKey =
  | "1_30d"
  | "31_60d"
  | "61_90d"
  | "91_180d"
  | "181_365d"
  | "1yr"
  | "2yr"
  | "3yr"
  | "4yr"
  | "5_7yr"
  | "7yr_plus";

export interface AgingBucketRecord {
  itemCode: string;
  sourceFileName: string;
  sheetName: string;
  originalRowNumber: number;
  buckets: Partial<Record<AgingBucketKey, number>>;
}

// ─── Stage 5: Row Classification ────────────────────────────────────────────

export type RowClassification =
  | "inventory_item"
  | "ignored_header_row"
  | "ignored_empty_row"
  | "ignored_total_row"
  | "ignored_subtotal_row"
  | "ignored_signature_row"
  | "ignored_metadata_row"
  | "ignored_summary_sheet_row";

export interface ClassifiedRow {
  sourceFileName: string;
  sheetName: string;
  originalRowNumber: number;
  rawRowData: Record<string, unknown>;
  classification: RowClassification;
  reason: string;
}

// ─── Stage 6: Validation ────────────────────────────────────────────────────

export type ValidationCode =
  | "MISSING_ITEM_CODE"
  | "MISSING_DESCRIPTION"
  | "MISSING_SUPPLIER"
  | "MISSING_ORG"
  | "INVALID_QUANTITY"
  | "INVALID_VALUE"
  | "DUPLICATE_ITEM"
  | "UNEXPECTED_BLANK"
  | "MISSING_BOTH_QUANTITIES";

export interface ValidationIssue {
  field: string;
  severity: "error" | "warning" | "info";
  code: ValidationCode;
  message: string;
}

// ─── Stage 3: Extracted Row (pre-validation) ────────────────────────────────

export interface ExtractedInventoryRow {
  reportId: string;
  sourceFileName: string;
  sheetName: string;
  originalRowNumber: number;
  rawRowData: Record<string, unknown>;
  /** All mapped fields — optional at extraction time */
  item: string;
  description: string;
  org: string;
  rawSupplier: string;
  totalValueSar: number | null;
  valueSource?: "direct" | "derived" | "missing";
  valueFormula?: string;
  systemOnHand: number;
  physicalCount: number;
  variation: number;
  remarks: string;
  reported: string;
  /** Attached after validation engine runs */
  validationIssues: ValidationIssue[];
  /** Attached after supplier resolution runs */
  resolvedSupplier: string;
  supplierDetectionMethod: string;
}

// ─── Column Alias Registry ──────────────────────────────────────────────────

/**
 * Normalized column alias map.
 * Keys are the standard field names. Values are normalized alias strings.
 */
export const COLUMN_ALIASES: Record<string, string[]> = {
  item: ["Item", "Item Code", "ITEM_CODE", "ITEM", "ITEM NO", "Material", "Material Code"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  description: ["Description", "ITEM_DESCRIPTION", "Item Description", "Material Description"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  org: ["Org", "Organization", "UNIT", "VAL_UNIT_CODE", "Division", "Sub Division"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  supplier: ["Supplier", "Supplier Name", "PARTY_NAME", "Vendor", "Vendor Name"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  totalValueSar: ["Total Value", "Value", "Total Value (SAR)", "Inventory Value", "Amount", "Amount SAR", "SAR Value", "Total SAR", "Line Value", "Stock Value", "Extended Value", "Ext Value", "Ext. Value", "Ext. Amount", "Ext Amount", "Closing Value", "CLOSING_VALUE", "Value SAR", "Total Cost", "SAR", "Net Value", "Material Value", "Item Value", "VALUE IN SAR", "Total Amount", "VALUE"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  unitPrice: ["Unit Price", "UnitPrice", "Unit Cost", "Cost", "Price", "Rate", "Price/Unit", "Cost/Unit", "Unit Rate", "Price SAR", "Cost SAR"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  systemOnHand: ["System on hand", "System Qty", "ERP", "ERP Qty", "CLOSING_QTY", "Grand Total", "On Hand"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  physicalCount: ["Physical Count", "PHYSICAL COUNT", "PHY", "Counted Qty", "Actual Qty"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  variation: ["Variation", "Variance", "Difference", "DIF"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  remarks: ["Remarks", "Comments", "Remark"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  reported: ["Reported", "Reported By", "Counted By", "Auditor", "Name"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
};

// ─── Supplier Keyword Registry ──────────────────────────────────────────────

export const SUPPLIER_KEYWORDS: Record<string, string[]> = {
  "Pepperl+Fuchs": ["pepperl", "fuchs", "p+f", "pf"],
  "Weidmuller": ["weidmuller", "weidmüller", "weid"],
  "Bartec": ["bartec", "bart"],
  "MCH": ["mch"],
  "MEC": ["mec"],
  "MET": ["met"],
  "IPR": ["ipr", "ira"],
};
