/**
 * Stage 1: Excel Reader
 * 
 * Reads .xlsx files in browser memory using the FileReader API and SheetJS.
 * Returns raw WorkBook objects — does NOT validate, classify, or save data.
 */

import * as XLSX from "xlsx";

export interface ReadWorkbookResult {
  fileName: string;
  workbook: XLSX.WorkBook;
}

/**
 * Reads a single .xlsx File object and returns the SheetJS WorkBook.
 * This is a pure I/O stage — no business logic.
 */
export const readExcelFile = (file: File): Promise<ReadWorkbookResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        resolve({ fileName: file.name, workbook });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Reads multiple .xlsx files and returns an array of WorkBook results.
 */
export const readExcelFiles = async (files: File[]): Promise<ReadWorkbookResult[]> => {
  return Promise.all(files.map(f => readExcelFile(f)));
};
