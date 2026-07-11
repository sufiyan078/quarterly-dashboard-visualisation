import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

const workspaceDir = process.cwd();
let output = "";

function log(msg: string) {
  output += msg + "\n";
  console.log(msg);
}

function inspectFile(fileName: string) {
  const filePath = path.join(workspaceDir, fileName);
  if (!fs.existsSync(filePath)) {
    log(`File not found: ${filePath}`);
    return;
  }
  log(`\n=== Inspecting File: ${fileName} ===`);
  const workbook = XLSX.readFile(filePath);

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
    }) as unknown[][];

    if (rawRows.length === 0) {
      log(`Sheet "${sheetName}": EMPTY`);
      continue;
    }

    log(`\nSheet: "${sheetName}" (Total raw rows: ${rawRows.length})`);
    
    // Look at first 15 rows to see if we can identify headers
    for (let r = 0; r < Math.min(15, rawRows.length); r++) {
      const row = rawRows[r];
      if (!row) continue;
      const nonempty = row.filter(c => c !== null && c !== undefined && c.toString().trim() !== "");
      if (nonempty.length >= 3) {
        log(`  Row ${r} candidate headers (${nonempty.length} non-empty): ${JSON.stringify(nonempty.slice(0, 15))}`);
      }
    }
  }
}

inspectFile("Bartec 09.11.2025.xlsx");
inspectFile("Copy of MCH 07.12.2025.xlsx");

fs.writeFileSync(path.join(workspaceDir, "inspection_output.txt"), output, "utf8");
log("\nFull inspection results written to inspection_output.txt");
