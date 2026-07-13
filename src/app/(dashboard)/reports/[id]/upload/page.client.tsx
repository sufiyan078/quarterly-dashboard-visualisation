"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db, doc, getDoc, updateDoc, setDoc } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useInventoryData } from "@/context/InventoryDataContext";
import { parseExcelFile, profileInventoryData } from "@/lib/inventory";
import { ParsedWorkbookResult } from "@/types/inventory";
import { getHighestStep } from "@/lib/workflow";
import { useReportId } from "@/lib/useReportId";

import {
  Upload as UploadIcon,
  FileSpreadsheet,
  ArrowRight,
  X,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  FileCheck2,
  Layers
} from "lucide-react";

interface Report {
  title: string;
  quarter: string;
  year: number;
  status: string;
  highestStepReached?: number;
}

interface SelectedFile {
  name: string;
  size: number;
  lastModified: number;
  status: string;
  fileObject: File;
}

export default function UploadExcel() {
  const router = useRouter();
  const id = useReportId();
  const { user, profile } = useAuth();
  const { setParsedResult } = useInventoryData();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!id || id === "placeholder") return;
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const docRef = doc(db, "reports", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setReport(docSnap.data() as Report);
        } else {
          setError("Report session not found.");
        }
      } catch (err: any) {
        console.error("Error fetching report:", err);
        setError("Could not retrieve report metadata. Verify your connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  const addFiles = (selectedList: File[]) => {
    setError(null);
    const invalidFiles = selectedList.filter((f) => !f.name.toLowerCase().endsWith(".xlsx"));
    if (invalidFiles.length > 0) { setError("Only .xlsx files are accepted."); return; }

    const uniqueList: File[] = [];
    const duplicates: string[] = [];
    for (const f of selectedList) {
      const dup = files.some(e => e.name === f.name && e.size === f.size && e.lastModified === f.lastModified)
        || uniqueList.some(a => a.name === f.name && a.size === f.size && a.lastModified === f.lastModified);
      if (dup) duplicates.push(f.name); else uniqueList.push(f);
    }
    if (duplicates.length > 0) { setError(`Already selected: ${Array.from(new Set(duplicates)).join(", ")}`); return; }

    const MAX_FILE = 20 * 1024 * 1024;
    const oversized = uniqueList.filter(f => f.size > MAX_FILE);
    if (oversized.length > 0) { setError(`Exceeds 20MB: ${oversized.map(f => f.name).join(", ")}`); return; }

    const MAX_TOTAL = 50 * 1024 * 1024;
    const curTotal = files.reduce((a, f) => a + f.size, 0);
    const newTotal = uniqueList.reduce((a, f) => a + f.size, 0);
    if (curTotal + newTotal > MAX_TOTAL) { setError("Total upload cannot exceed 50MB."); return; }

    setFiles(prev => [...prev, ...uniqueList.map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified, status: "Ready", fileObject: f }))]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = ""; }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const loadSampleFilesForTesting = async () => {
    try {
      const fetchFile = async (url: string, filename: string) => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], filename, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      };
      const file1 = await fetchFile("/PhysicalStock.xlsx", "Copy of 2026 - PHYSICAL STOCK - 01- Q.xlsx");
      const file2 = await fetchFile("/Bartec.xlsx", "Bartec 09.11.2025.xlsx");
      const file3 = await fetchFile("/MCH.xlsx", "Copy of MCH 07.12.2025.xlsx");
      const newFiles = [file1, file2, file3].map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified, status: "Ready", fileObject: f }));
      setFiles(prev => { const filtered = prev.filter(p => !newFiles.some(n => n.name === p.name)); return [...filtered, ...newFiles]; });
      setError(null);
    } catch (err: any) {
      setError("Failed to load test files: " + err.message);
    }
  };

  const handleProceed = async () => {
    if (files.length === 0) { setError("Please select at least one Excel file."); return; }
    setIsProcessing(true); setError(null);
    try {
      const results = await Promise.all(files.map(f => parseExcelFile(f.fileObject, id)));
      const allParsedRows = results.flatMap(r => r.parsedRows);
      const allIgnoredRows = results.flatMap(r => r.ignoredRows);
      const allNeedsReviewRows = results.flatMap(r => r.needsReviewRows);
      const allSheetDiagnoses = results.flatMap(r => r.sheetDiagnoses || []);
      const allAgingData = results.flatMap(r => r.agingData || []);
      const dataProfile = profileInventoryData(allParsedRows, allIgnoredRows, allNeedsReviewRows, allSheetDiagnoses, allAgingData);
      const aggregated: ParsedWorkbookResult = {
        totalFiles: files.length,
        totalSheets: results.reduce((s, r) => s + r.totalSheets, 0),
        totalRows: results.reduce((s, r) => s + r.totalRows, 0),
        parsedRows: allParsedRows, ignoredRows: allIgnoredRows, needsReviewRows: allNeedsReviewRows,
        rejectedRows: allNeedsReviewRows, detectedColumns: results.flatMap(r => r.detectedColumns),
        ignoredColumns: results.flatMap(r => r.ignoredColumns),
        missingRequiredColumns: Array.from(new Set(results.flatMap(r => r.missingRequiredColumns))),
        sheetDiagnoses: allSheetDiagnoses, dataProfile, agingData: allAgingData
      };
      setParsedResult(aggregated);
      const currentHighest = getHighestStep(report);
      await setDoc(doc(db, "reports", id), {
        uploadedFileNames: files.map(f => f.name),
        uploadedFiles: files.map(f => ({ filename: f.name, size: f.size, uploadTimestamp: new Date().toISOString(), uploadedBy: profile?.email || user?.email || "Unknown", reportId: id, uploadStatus: f.status })),
        updatedAt: new Date(),
        highestStepReached: Math.max(currentHighest, 2)
      }, { merge: true });
      router.push(`/reports/${id}/validate`);
    } catch (err: any) {
      setError(err?.message || "Failed to parse Excel files. Check your files and connection.");
      setIsProcessing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024, sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const totalSize = files.reduce((a, f) => a + f.size, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
        <span className="mt-4 text-sm text-slate-400">Loading upload workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports" className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
            {report?.quarter} {report?.year} Cycle
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Upload Excel Files: {report?.title}
          </h1>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="grid grid-cols-5 gap-2 sm:gap-4 max-w-3xl mx-auto border-b border-slate-800/80 pb-4 w-full">
        {[
          { number: 1, label: "Upload Excel", path: "upload" },
          { number: 2, label: "Validate Data", path: "validate" },
          { number: 3, label: "Dashboard", path: "dashboard" },
          { number: 4, label: "Pre-Report", path: "pre-report" },
          { number: 5, label: "Report PDF", path: "builder" }
        ].map((step) => {
          const isCurrent = step.number === 1;
          const isReached = getHighestStep(report) >= step.number;

          if (isCurrent) {
            return (
              <div key={step.number} className="border-b-2 border-indigo-500 pb-2 flex items-center justify-center gap-2">
                <span className="h-4.5 w-4.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-bold flex items-center justify-center text-indigo-400 flex-shrink-0">{step.number}</span>
                <span className="text-[11px] sm:text-xs text-white font-bold">{step.label}</span>
              </div>
            );
          }

          if (isReached) {
            return (
              <Link
                key={step.number}
                href={`/reports/${id}/${step.path}`}
                className="border-b-2 border-transparent pb-2 opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="h-4.5 w-4.5 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-400 flex-shrink-0">{step.number}</span>
                <span className="text-[11px] sm:text-xs text-slate-400 font-medium">{step.label}</span>
              </Link>
            );
          }

          return (
            <div key={step.number} className="border-b-2 border-transparent pb-2 opacity-35 flex items-center justify-center gap-2">
              <span className="h-4.5 w-4.5 rounded-full bg-slate-800/80 text-[10px] font-bold flex items-center justify-center text-slate-500 flex-shrink-0">{step.number}</span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-400 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-3xl mx-auto space-y-6 w-full">

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative group rounded-2xl border-2 border-dashed transition-all duration-300 p-10 text-center cursor-pointer overflow-hidden ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
              : "border-slate-700 hover:border-indigo-500/60 bg-gradient-to-br from-[#0c0e15] to-[#0f1220]"
          }`}
        >
          <input
            type="file"
            multiple
            accept=".xlsx"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

          <div className="relative flex flex-col items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
              isDragging
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                : "bg-slate-900 border-slate-800 text-slate-400 group-hover:border-indigo-500/40 group-hover:text-indigo-400 group-hover:bg-indigo-500/10"
            }`}>
              <UploadIcon className="h-7 w-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                {isDragging ? "Release to add files" : "Drag & drop Excel files here"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">or click anywhere in this area to browse</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded border border-slate-800 bg-slate-900/60 text-slate-500">.xlsx only</span>
              <span className="px-2 py-0.5 rounded border border-slate-800 bg-slate-900/60 text-slate-500">max 20MB / file</span>
              <span className="px-2 py-0.5 rounded border border-slate-800 bg-slate-900/60 text-slate-500">50MB total</span>
            </div>

            <button
              id="load-test-files-btn"
              type="button"
              onClick={(e) => { e.stopPropagation(); loadSampleFilesForTesting(); }}
              className="relative z-20 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-all"
            >
              Load Sample Test Files
            </button>
          </div>
        </div>

        {/* Selected Files Card */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-[#0c0e15] to-[#0f1120] p-5 flex flex-col gap-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Selected Files</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${
              files.length > 0
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : "bg-slate-800 border-slate-700 text-slate-500"
            }`}>
              {files.length} file{files.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* File List */}
          <div className="min-h-[140px]">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 py-8">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <FileUp className="h-4 w-4 text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-500">No files selected yet</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Drop files above or click to browse</p>
                </div>
              </div>
            ) : (
              <ul className="space-y-2 overflow-y-auto max-h-[260px] pr-1">
                {files.map((file, idx) => (
                  <li key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-900 hover:border-slate-800 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">{formatBytes(file.size)}</span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> {file.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="p-1 rounded-lg text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Stats bar (shown when files added) */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-950/60 border border-slate-900 px-3 py-2 text-center">
                <span className="text-[9px] text-slate-500 uppercase block">Total Files</span>
                <span className="text-sm font-bold text-white font-mono">{files.length}</span>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-slate-900 px-3 py-2 text-center">
                <span className="text-[9px] text-slate-500 uppercase block">Total Size</span>
                <span className="text-sm font-bold text-white font-mono">{formatBytes(totalSize)}</span>
              </div>
            </div>
          )}

          {/* Proceed Button */}
          <div className="pt-2 border-t border-slate-800/60">
            <button
              onClick={handleProceed}
              disabled={isProcessing || files.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all shadow-lg disabled:cursor-not-allowed
                bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400
                disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Parsing files...
                </>
              ) : (
                <>
                  <FileCheck2 className="h-4 w-4" />
                  Proceed to Validation
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            {files.length === 0 && (
              <p className="text-[10px] text-slate-600 text-center mt-2">Add at least one .xlsx file to continue</p>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}
