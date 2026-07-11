import * as XLSX from "xlsx";
import * as path from "path";
import { detectStructure } from "./structureDetector";
import { classifyRows } from "./rowClassifier";
import { extractInventoryRows } from "./inventoryExtractor";

const workspaceDir = process.cwd();
const filePath = path.join(workspaceDir, "Bartec 09.11.2025.xlsx");
const workbook = XLSX.readFile(filePath);
const structures = detectStructure(workbook);

for (const sheet of structures) {
  if (sheet.sheetName === "Counting Sheet") {
    console.log(`=== Counting Sheet ===`);
    console.log("Dataset Type:", sheet.datasetType);
    console.log("Column Map:", sheet.columnMap);
    
    const classified = classifyRows(sheet, "Bartec 09.11.2025.xlsx");
    const extracted = extractInventoryRows(classified, sheet, "test-report-id");
    
    console.log("\nSample Extracted Rows (first 3):");
    console.log(JSON.stringify(extracted.slice(0, 3), null, 2));
  }
}
