const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const files = [
  "Bartec 09.11.2025.xlsx",
  "Copy of MCH 07.12.2025.xlsx"
];

const financialAliases = [
  "Total Value (SAR)", "Total Value", "Value", "Inventory Value",
  "Stock Value", "Total Cost", "Amount", "SAR", "Net Value",
  "Extended Value", "Material Value", "Item Value", "VALUE IN SAR",
  "Total Amount"
].map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));

function cleanNum(val) {
  if (val === null || val === undefined) return null;
  const strVal = String(val).trim();
  if (strVal === "") return null;
  const cleaned = strVal.replace(/[\s,A-Za-z$]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

files.forEach(fileName => {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${fileName}`);
    return;
  }

  console.log(`\n=========================================`);
  console.log(`FILE: ${fileName}`);
  console.log(`=========================================`);

  const workbook = XLSX.readFile(filePath);
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    console.log(`\nSheet: "${sheetName}" (Total rows: ${rawRows.length})`);
    if (rawRows.length === 0) {
      console.log("  Empty sheet");
      return;
    }

    // Header Detection (using similar logic to findHeaderRow)
    let bestRowIndex = 0;
    let maxMatches = 0;
    const scanLimit = Math.min(25, rawRows.length);

    // Let's first log candidate headers in the first 25 rows
    for (let r = 0; r < scanLimit; r++) {
      const row = rawRows[r];
      if (!row) continue;
      // We look for columns
      const nonempty = row.filter(c => c !== null && c !== undefined && String(c).trim() !== "");
      if (nonempty.length >= 3) {
        // Count matches with all aliases in COLUMN_ALIASES from lib/inventory/types.ts
        // Let's just count some likely headers
        let matches = 0;
        row.forEach(cell => {
          if (!cell) return;
          const str = cell.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");
          if (["item", "itemcode", "description", "qty", "quantity", "amount", "value", "supplier", "org", "dif"].some(kw => str.includes(kw))) {
            matches++;
          }
        });
        if (matches > maxMatches) {
          maxMatches = matches;
          bestRowIndex = r;
        }
      }
    }

    const headerRow = rawRows[bestRowIndex] || [];
    console.log(`  Detected Header Row Index: ${bestRowIndex}`);
    console.log(`  Headers: ${JSON.stringify(headerRow)}`);

    // Let's scan all columns in the sheet to find candidates
    const candidates = [];
    headerRow.forEach((colName, colIndex) => {
      if (!colName) return;
      const normalized = colName.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      
      // Check if matches any of the financial aliases
      const matchesAlias = financialAliases.includes(normalized) || 
                           financialAliases.some(alias => normalized.includes(alias)) ||
                           ["value", "amount", "cost", "sar", "price", "rate"].some(kw => normalized.includes(kw));

      if (matchesAlias) {
        candidates.push({ colName, colIndex, normalized });
      }
    });

    if (candidates.length === 0) {
      console.log(`  Candidate financial columns: None detected based on name`);
    } else {
      console.log(`  Candidate financial columns:`);
      candidates.forEach(cand => {
        // Collect numeric stats for this column
        let numericCount = 0;
        let blankCount = 0;
        let nonNumericCount = 0;
        const samples = [];

        // Scan values below header row
        for (let r = bestRowIndex + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          const val = row ? row[cand.colIndex] : undefined;
          if (val === undefined || val === null || String(val).trim() === "") {
            blankCount++;
          } else {
            const num = cleanNum(val);
            if (num !== null) {
              numericCount++;
            } else {
              nonNumericCount++;
            }
            if (samples.length < 5) {
              samples.push(val);
            }
          }
        }

        console.log(`    - "${cand.colName}" (Index ${cand.colIndex}):`);
        console.log(`      * Numeric cells: ${numericCount}`);
        console.log(`      * Blank cells: ${blankCount}`);
        console.log(`      * Non-numeric cells: ${nonNumericCount}`);
        console.log(`      * Sample values: ${JSON.stringify(samples)}`);
      });
    }

    // Let's also print first 5 data rows for inspection
    console.log(`  First 5 data rows (below header):`);
    for (let r = bestRowIndex + 1; r < Math.min(bestRowIndex + 6, rawRows.length); r++) {
      console.log(`    Row ${r}: ${JSON.stringify(rawRows[r])}`);
    }
  });
});
