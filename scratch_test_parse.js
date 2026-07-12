const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

// We simulate parseExcelFile behavior on Copy of 2026 - PHYSICAL STOCK - 01- Q.xlsx
const fileName = "Copy of 2026 - PHYSICAL STOCK - 01- Q.xlsx";
const filePath = path.join(process.cwd(), fileName);

if (!fs.existsSync(filePath)) {
  console.error("File not found:", filePath);
  process.exit(1);
}

const ALIASES = {
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

const isAgingColumn = (colName) => {
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

const findHeaderRow = (rawRows) => {
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

const cleanNum = (val) => {
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

try {
  console.log("Reading file:", filePath);
  const workbook = XLSX.readFile(filePath);
  console.log("Sheets:", workbook.SheetNames);
  
  const parsedRows = [];
  const ignoredRows = [];
  const needsReviewRows = [];
  const detectedColumns = [];
  const ignoredColumns = [];
  const missingRequiredColumnsSet = new Set();
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    console.log(`\nSheet "${sheetName}": ${rawRows.length} rows`);
    if (rawRows.length === 0) continue;
    
    const headerRowIndex = findHeaderRow(rawRows);
    const headerCells = rawRows[headerRowIndex] || [];
    console.log(`  Header row index: ${headerRowIndex}`);
    console.log(`  Header cells:`, headerCells.slice(0, 15));
    
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
    console.log(`  Is inventory sheet? ${isInventorySheet} (matchCount=${matchCount}, isSummary=${isSummarySheet})`);
    
    if (!isInventorySheet) {
      console.log(`  Skipping non-inventory sheet "${sheetName}"`);
      continue;
    }
    
    // Map columns
    const indexToFieldMap = {};
    const foundFields = new Set();
    
    for (let j = 0; j < headerCells.length; j++) {
      const cell = headerCells[j];
      if (cell === null || cell === undefined || cell.toString().trim() === "") continue;
      
      const rawColName = cell.toString();
      const normalized = rawColName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      
      let matchedField = null;
      for (const [field, aliases] of Object.entries(ALIASES)) {
        if (aliases.includes(normalized)) {
          matchedField = field;
          break;
        }
      }
      
      if (matchedField) {
        indexToFieldMap[j] = matchedField;
        foundFields.add(matchedField);
        detectedColumns.push({ sheetName, sourceColumn: rawColName, mappedField: matchedField });
      } else if (isAgingColumn(rawColName)) {
        indexToFieldMap[j] = "ignored_aging";
      } else {
        indexToFieldMap[j] = "ignored";
      }
    }
    
    console.log("  Mapped fields:", indexToFieldMap);
    
    // Test row loop
    let sheetParsed = 0;
    let sheetNeedsReview = 0;
    let sheetIgnored = 0;
    
    for (let r = 0; r < rawRows.length; r++) {
      const rowData = rawRows[r];
      if (r <= headerRowIndex) {
        sheetIgnored++;
        continue;
      }
      
      const isEmpty = rowData.every(cell => cell === null || cell === undefined || cell.toString().trim() === "");
      if (isEmpty) {
        sheetIgnored++;
        continue;
      }
      
      const rowObj = {};
      for (let j = 0; j < rowData.length; j++) {
        const field = indexToFieldMap[j];
        if (field && field !== "ignored" && field !== "ignored_aging") {
          rowObj[field] = rowData[j];
        }
      }
      
      const item = rowObj["item"] !== undefined ? String(rowObj["item"]).trim() : "";
      const description = rowObj["description"] !== undefined ? String(rowObj["description"]).trim() : "";
      
      const itemLowerCleaned = item.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      const isRepeatedHeader = ALIASES.item.includes(itemLowerCleaned) ||
                               (itemLowerCleaned === "item" || itemLowerCleaned === "itemcode" || itemLowerCleaned === "materialcode");
      if (isRepeatedHeader) {
        sheetIgnored++;
        continue;
      }
      
      if (item === "" && description === "") {
        sheetIgnored++;
        continue;
      }
      
      const containsTotalKeyword = rowData.some((cell, cellIdx) => {
        if (cell === null || cell === undefined) return false;
        if (cellIdx > 4) return false;
        const cellStr = String(cell).toLowerCase().trim();
        return cellStr === "total" || cellStr === "grand total" || cellStr === "subtotal" || cellStr === "sub-total";
      });
      if (containsTotalKeyword) {
        sheetIgnored++;
        continue;
      }
      
      const systemOnHandParsed = cleanNum(rowObj["systemOnHand"]);
      const physicalCountParsed = cleanNum(rowObj["physicalCount"]);
      
      const hasSystemVal = rowObj["systemOnHand"] !== undefined && rowObj["systemOnHand"] !== null && String(rowObj["systemOnHand"]).trim() !== "";
      const hasPhysicalVal = rowObj["physicalCount"] !== undefined && rowObj["physicalCount"] !== null && String(rowObj["physicalCount"]).trim() !== "";
      
      const hasInvalidSystemQty = hasSystemVal && systemOnHandParsed === null;
      const hasInvalidPhysicalQty = hasPhysicalVal && physicalCountParsed === null;
      const isMissingBothQty = systemOnHandParsed === null && physicalCountParsed === null;
      
      const isItemEmpty = item === "";
      const isDescEmpty = description === "";
      
      if (isItemEmpty || isDescEmpty || hasInvalidSystemQty || hasInvalidPhysicalQty || isMissingBothQty) {
        sheetNeedsReview++;
        if (sheetNeedsReview <= 5) {
          console.log(`    Needs Review Row ${r + 1}: item="${item}", desc="${description}", systemVal="${rowObj["systemOnHand"]}" (parsed=${systemOnHandParsed}), physicalVal="${rowObj["physicalCount"]}" (parsed=${physicalCountParsed})`);
        }
        continue;
      }
      
      sheetParsed++;
    }
    
    console.log(`  Sheet summary: Parsed=${sheetParsed}, NeedsReview=${sheetNeedsReview}, Ignored=${sheetIgnored}`);
  }
} catch (e) {
  console.error("Error during simulation:", e);
}
