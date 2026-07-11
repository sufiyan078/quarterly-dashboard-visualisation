import * as XLSX from "xlsx";
import { 
  ParsedWorkbookResult, 
  ParsedInventoryRow, 
  IgnoredInventoryRow,
  NeedsReviewInventoryRow, 
  DetectedColumn, 
  IgnoredColumn 
} from "../types/inventory";

// Normalized aliases mapping for column detection
const ALIASES: Record<string, string[]> = {
  item: ["Item", "Item Code", "ITEM_CODE", "ITEM", "ITEM NO", "Material", "Material Code"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  description: ["Description", "ITEM_DESCRIPTION", "Item Description", "Material Description"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  org: ["Org", "Organization", "UNIT", "VAL_UNIT_CODE", "Division", "Sub Division"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  supplier: ["Supplier", "Supplier Name", "PARTY_NAME", "Vendor", "Vendor Name"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  totalValueSar: ["Total Value", "Value", "Total Value (SAR)", "Inventory Value", "Amount", "SAR Value"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  systemOnHand: ["System on hand", "System Qty", "ERP", "ERP Qty", "CLOSING_QTY", "Grand Total", "On Hand"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  physicalCount: ["Physical Count", "PHYSICAL COUNT", "PHY", "Counted Qty", "Actual Qty"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  variation: ["Variation", "Variance", "Difference", "DIF"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  remarks: ["Remarks", "Comments", "Remark"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
  reported: ["Reported", "Reported By", "Counted By", "Auditor", "Name"].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, "")),
};

const AGING_KEYWORDS = ["days", "yr", "year", "aging", ">", "<"];

/**
 * Detects if a column is an aging bucket column that should be ignored from the main dataset.
 */
export const isAgingColumn = (colName: string): boolean => {
  if (!colName) return false;
  const normalized = colName.toLowerCase().replace(/\s+/g, "");
  if (/\d+-\d+days/.test(normalized)) return true;
  if (/\d+days/.test(normalized)) return true;
  if (/\d+yr/.test(normalized)) return true;
  if (/year/.test(normalized)) return true;
  if (/aging/.test(normalized)) return true;
  if (/\d+\+yr/.test(normalized)) return true;
  if (/>\s*\d+/.test(normalized)) return true;
  if (AGING_KEYWORDS.some(kw => normalized.includes(kw))) return true;
  return false;
};

/**
 * Finds the header row index by scanning the first 25 rows and counting matches against standard column aliases.
 */
export const findHeaderRow = (rawRows: unknown[][]): number => {
  let bestRowIndex = 0;
  let maxMatches = 0;
  const searchRows = Math.min(25, rawRows.length);
  
  for (let i = 0; i < searchRows; i++) {
    const row = rawRows[i];
    if (!row) continue;
    let matches = 0;
    for (const cell of row) {
      if (cell === null || cell === undefined) continue;
      const cellStr = cell.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      if (!cellStr) continue;
      
      const matchesAny = Object.values(ALIASES).some(aliases => aliases.includes(cellStr));
      if (matchesAny) {
        matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestRowIndex = i;
    }
  }
  
  return maxMatches >= 2 ? bestRowIndex : 0;
};

/**
 * Supplier keyword list for description matching fallback
 */
const SUPPLIER_KEYWORDS: Record<string, string[]> = {
  "Pepperl+Fuchs": ["pepperl", "fuchs", "p+f", "pf"],
  "Weidmuller": ["weidmuller", "weidmüller", "weid"],
  "Bartec": ["bartec", "bart"],
  "MCH": ["mch"],
  "MEC": ["mec"],
  "MET": ["met"],
  "IPR": ["ipr", "ira"],
};

/**
 * Detects the supplier using the priority fallback strategy:
 * 1. Direct Supplier from sheet row
 * 2. Source File Name
 * 3. Description Match
 * 4. "Others" Fallback
 */
export const detectSupplier = (
  rawSupplier: string | null | undefined,
  description: string,
  fileName: string
): { supplierName: string; method: string } => {
  if (rawSupplier && rawSupplier.trim() !== "") {
    const cleaned = rawSupplier.trim();
    const lower = cleaned.toLowerCase();
    if (lower !== "others" && lower !== "other" && lower !== "unknown" && lower !== "n/a") {
      return { supplierName: cleaned, method: "direct_supplier_name" };
    }
  }

  const fileLower = fileName.toLowerCase();
  for (const [supplierName, keywords] of Object.entries(SUPPLIER_KEYWORDS)) {
    if (keywords.some(kw => fileLower.includes(kw))) {
      return { supplierName, method: "source_file_name" };
    }
  }

  const descLower = description.toLowerCase();
  for (const [supplierName, keywords] of Object.entries(SUPPLIER_KEYWORDS)) {
    if (keywords.some(kw => descLower.includes(kw))) {
      return { supplierName, method: "description_match" };
    }
  }

  return { supplierName: "Others", method: "unmatched_others" };
};

/**
 * Helper to clean and parse numeric cell values
 */
const cleanNum = (val: unknown): number | null => {
  if (val === null || val === undefined) {
    return null;
  }
  const strVal = String(val).trim();
  if (strVal === "") {
    return null;
  }
  const cleaned = strVal.replace(/[\s,A-Za-z$]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

/**
 * Parses a single Excel File (browser memory only)
 */
export const parseExcelFile = (file: File, reportId: string): Promise<Omit<ParsedWorkbookResult, "totalFiles">> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        
        const parsedRows: ParsedInventoryRow[] = [];
        const ignoredRows: IgnoredInventoryRow[] = [];
        const needsReviewRows: NeedsReviewInventoryRow[] = [];
        const detectedColumns: DetectedColumn[] = [];
        const ignoredColumns: IgnoredColumn[] = [];
        const missingRequiredColumnsSet = new Set<string>();

        const totalSheets = workbook.SheetNames.length;
        let totalRows = 0;

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;
          
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" }) as unknown[][];
          if (rawRows.length === 0) continue;

          totalRows += rawRows.length;

          // Find header row index
          const headerRowIndex = findHeaderRow(rawRows);
          const headerCells = rawRows[headerRowIndex] || [];

          // Determine if this sheet is a likely inventory sheet
          let matchCount = 0;
          for (const cell of headerCells) {
            if (cell === null || cell === undefined) continue;
            const cellStr = cell.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");
            if (!cellStr) continue;
            const matchesAny = Object.values(ALIASES).some(aliases => aliases.includes(cellStr));
            if (matchesAny) {
              matchCount++;
            }
          }

          const isSummarySheet = sheetName.toLowerCase().includes("summary");
          const isInventorySheet = (matchCount >= 2 && !isSummarySheet) || (matchCount >= 3);

          // If not an inventory sheet, classify all its rows as ignored_summary_row
          if (!isInventorySheet) {
            for (let r = 0; r < rawRows.length; r++) {
              const rowData = rawRows[r];
              const rawRowData: Record<string, unknown> = {};
              for (let j = 0; j < Math.max(headerCells.length, rowData.length); j++) {
                const headerKey = headerCells[j]?.toString() || `Column_${j + 1}`;
                rawRowData[headerKey] = rowData[j] ?? "";
              }
              ignoredRows.push({
                sourceFileName: file.name,
                sheetName,
                originalRowNumber: r + 1,
                rawRowData,
                category: "ignored_summary_row",
                reason: "Non-inventory summary sheet row"
              });
            }
            continue;
          }

          // Map column indices to fields
          const indexToFieldMap: Record<number, string> = {};
          const sheetRequiredCols = new Set<string>(["item", "description"]);
          const foundFields = new Set<string>();

          for (let j = 0; j < headerCells.length; j++) {
            const cell = headerCells[j];
            if (cell === null || cell === undefined || cell.toString().trim() === "") {
              continue;
            }

            const rawColName = cell.toString();
            const normalized = rawColName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");

            // Check standard aliases
            let matchedField: string | null = null;
            for (const [field, aliases] of Object.entries(ALIASES)) {
              if (aliases.includes(normalized)) {
                matchedField = field;
                break;
              }
            }

            if (matchedField) {
              indexToFieldMap[j] = matchedField;
              foundFields.add(matchedField);
              detectedColumns.push({
                sheetName,
                sourceColumn: rawColName,
                mappedField: matchedField
              });
            } else if (isAgingColumn(rawColName)) {
              indexToFieldMap[j] = "ignored_aging";
              ignoredColumns.push({
                sheetName,
                sourceColumn: rawColName,
                reason: "Aging Column"
              });
            } else {
              indexToFieldMap[j] = "ignored";
              ignoredColumns.push({
                sheetName,
                sourceColumn: rawColName,
                reason: "Unrecognized Column"
              });
            }
          }

          // Compute missing standard columns for this sheet
          for (const required of sheetRequiredCols) {
            if (!foundFields.has(required)) {
              missingRequiredColumnsSet.add(required);
            }
          }

          // Parse every single row in the rawRows array
          for (let r = 0; r < rawRows.length; r++) {
            const rowData = rawRows[r];

            // Reconstruct raw data object
            const rawRowData: Record<string, unknown> = {};
            for (let j = 0; j < Math.max(headerCells.length, rowData.length); j++) {
              const headerKey = headerCells[j]?.toString() || `Column_${j + 1}`;
              rawRowData[headerKey] = rowData[j] ?? "";
            }

            // 1. Check if row index is <= headerRowIndex
            if (r <= headerRowIndex) {
              ignoredRows.push({
                sourceFileName: file.name,
                sheetName,
                originalRowNumber: r + 1,
                rawRowData,
                category: "ignored_header_row",
                reason: r === headerRowIndex ? "Header row" : "Pre-header metadata row"
              });
              continue;
            }

            // 2. Check if row is completely empty
            const isEmpty = rowData.every(cell => cell === null || cell === undefined || cell.toString().trim() === "");
            if (isEmpty) {
              ignoredRows.push({
                sourceFileName: file.name,
                sheetName,
                originalRowNumber: r + 1,
                rawRowData,
                category: "ignored_empty_row",
                reason: "Fully empty row"
              });
              continue;
            }

            // Extract fields based on map first to help with categorization
            const rowObj: Record<string, unknown> = {};
            for (let j = 0; j < rowData.length; j++) {
              const field = indexToFieldMap[j];
              if (field && field !== "ignored" && field !== "ignored_aging") {
                rowObj[field] = rowData[j];
              }
            }

            const item = rowObj["item"] !== undefined ? String(rowObj["item"]).trim() : "";
            const description = rowObj["description"] !== undefined ? String(rowObj["description"]).trim() : "";
            const org = rowObj["org"] !== undefined ? String(rowObj["org"]).trim() : "";
            const rawSupplier = rowObj["supplier"] !== undefined ? String(rowObj["supplier"]) : undefined;
            const remarks = rowObj["remarks"] !== undefined ? String(rowObj["remarks"]).trim() : "";
            const reported = rowObj["reported"] !== undefined ? String(rowObj["reported"]).trim() : "";

            // 3. Repeated header row check (sometimes headers appear multiple times in a sheet)
            const itemLowerCleaned = item.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
            const isRepeatedHeader = ALIASES.item.includes(itemLowerCleaned) ||
                                     (itemLowerCleaned === "item" || itemLowerCleaned === "itemcode" || itemLowerCleaned === "materialcode");
            if (isRepeatedHeader) {
              ignoredRows.push({
                sourceFileName: file.name,
                sheetName,
                originalRowNumber: r + 1,
                rawRowData,
                category: "ignored_header_row",
                reason: "Repeated header row"
              });
              continue;
            }

            // 4. Check if both item code and description are empty - this cannot be a real item
            if (item === "" && description === "") {
              ignoredRows.push({
                sourceFileName: file.name,
                sheetName,
                originalRowNumber: r + 1,
                rawRowData,
                category: "ignored_empty_row",
                reason: "Empty row (no item code and no description)"
              });
              continue;
            }

            // 5. Check if it's a total/subtotal row
            const containsTotalKeyword = rowData.some((cell: any, cellIdx) => {
              if (cell === null || cell === undefined) return false;
              const cellStr = String(cell).toLowerCase().trim();
              
              // Only search the first 5 columns for total/subtotal labels to avoid false positives in remarks
              if (cellIdx > 4) return false;
              
              return cellStr === "total" || 
                     cellStr === "grand total" || 
                     cellStr === "subtotal" || 
                     cellStr === "sub-total" || 
                     cellStr.startsWith("sum of") || 
                     cellStr.startsWith("count of") || 
                     cellStr.startsWith("average");
            });

            if (containsTotalKeyword) {
              ignoredRows.push({
                sourceFileName: file.name,
                sheetName,
                originalRowNumber: r + 1,
                rawRowData,
                category: "ignored_total_row",
                reason: "Total/subtotal aggregation row"
              });
              continue;
            }

            // 6. Check if it's a technical metadata, note, or signature block at the bottom of the worksheet
            const nonBlankCells = rowData.filter((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== "");
            let isTechnicalMetadata = false;
            let technicalReason = "";

            const technicalKeywords = [
              "note:", "notes:", "disclaimer:", "prepared by", "approved by",
              "checked by", "reviewed by", "signature", "date:", "sign:", "page "
            ];

            if (nonBlankCells.length <= 4) {
              const matchedKeyword = nonBlankCells.find((cell: any) => {
                const cellStr = String(cell).toLowerCase().trim();
                return technicalKeywords.some(kw => cellStr.startsWith(kw) || cellStr.includes("signature:") || cellStr.includes("approved by:"));
              });

              if (matchedKeyword) {
                isTechnicalMetadata = true;
                technicalReason = `Technical metadata row (${String(matchedKeyword).trim()})`;
              }
            }

            if (isTechnicalMetadata) {
              ignoredRows.push({
                sourceFileName: file.name,
                sheetName,
                originalRowNumber: r + 1,
                rawRowData,
                category: "ignored_summary_row",
                reason: technicalReason
              });
              continue;
            }

            // Validate quantities
            const systemOnHandParsed = cleanNum(rowObj["systemOnHand"]);
            const physicalCountParsed = cleanNum(rowObj["physicalCount"]);

            const hasSystemVal = rowObj["systemOnHand"] !== undefined && rowObj["systemOnHand"] !== null && String(rowObj["systemOnHand"]).trim() !== "";
            const hasPhysicalVal = rowObj["physicalCount"] !== undefined && rowObj["physicalCount"] !== null && String(rowObj["physicalCount"]).trim() !== "";

            const hasInvalidSystemQty = hasSystemVal && systemOnHandParsed === null;
            const hasInvalidPhysicalQty = hasPhysicalVal && physicalCountParsed === null;
            const isMissingBothQty = systemOnHandParsed === null && physicalCountParsed === null;
            
            const isItemEmpty = item === "";
            const isDescEmpty = description === "";

            // If any validation check fails:
            if (isItemEmpty || isDescEmpty || hasInvalidSystemQty || hasInvalidPhysicalQty || isMissingBothQty) {
              let reason = "";
              if (isItemEmpty) reason = "Missing item code";
              else if (isDescEmpty) reason = "Missing description";
              else if (hasInvalidSystemQty || hasInvalidPhysicalQty) reason = "Invalid quantity format";
              else if (isMissingBothQty) reason = "Missing both system & physical quantities";
              else reason = "Schema validation failed";

              needsReviewRows.push({
                sourceFileName: file.name,
                sheetName,
                originalRowNumber: r + 1,
                rawRowData,
                category: "needs_review_possible_item",
                reason
              });
              continue;
            }

            const systemOnHand = systemOnHandParsed ?? 0;
            const physicalCount = physicalCountParsed ?? 0;
            const variation = physicalCount - systemOnHand;
            const totalValueSar = cleanNum(rowObj["totalValueSar"]) ?? 0;

            // Supplier detection fallback
            const { supplierName, method } = detectSupplier(rawSupplier, description, file.name);

            // Row is successfully parsed as parsed_inventory_item
            parsedRows.push({
              reportId,
              sourceFileName: file.name,
              sheetName,
              originalRowNumber: r + 1,
              item,
              description,
              org,
              supplier: supplierName,
              totalValueSar,
              systemOnHand,
              physicalCount,
              variation,
              remarks,
              reported,
              supplierName,
              detectedSupplierName: supplierName,
              supplierDetectionMethod: method
            });
          }
        }

        resolve({
          totalSheets,
          totalRows,
          parsedRows,
          ignoredRows,
          needsReviewRows,
          rejectedRows: needsReviewRows, // Kept for backwards compatibility
          detectedColumns,
          ignoredColumns,
          missingRequiredColumns: Array.from(missingRequiredColumnsSet)
        });

      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
