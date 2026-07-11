import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const workspaceDir = process.cwd();
const files = fs.readdirSync(workspaceDir).filter(f => f.endsWith(".xlsx"));

for (const fileName of files) {
  const filePath = path.join(workspaceDir, fileName);
  console.log(`\n=================== FILE: ${fileName} ===================`);
  try {
    const workbook = XLSX.readFile(filePath);
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      if (raw.length === 0) continue;
      console.log(`Sheet: "${name}" (rows: ${raw.length})`);
      // Find header row or print first 3 rows
      for (let i = 0; i < Math.min(3, raw.length); i++) {
        console.log(`  Row ${i}:`, JSON.stringify(raw[i].slice(0, 15)));
      }
    }
  } catch (err: any) {
    console.error(`Error reading ${fileName}:`, err.message);
  }
}
