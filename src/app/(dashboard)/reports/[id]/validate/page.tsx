"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db, doc, getDoc, updateDoc, writeBatch, collection, setDoc } from "@/lib/firebase";
import { useInventoryData } from "@/context/InventoryDataContext";
import { ParsedInventoryRow, IgnoredInventoryRow, NeedsReviewInventoryRow, SheetDiagnosisResult, InventoryDataProfile } from "@/types/inventory";
import { profileInventoryData } from "@/lib/inventory/dataProfiler";
import { getHighestStep } from "@/lib/workflow";
import { computeRowMetrics, calculateInventorySummary } from "@/lib/inventory/calculations";
import { 
  ArrowLeft, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  XCircle,
  FileQuestion,
  Package,
  Building2,
  Truck,
  Calendar,
  TrendingUp,
  BarChart3,
  Loader2,
  ShieldCheck
} from "lucide-react";

interface Report {
  title: string;
  quarter: string;
  year: number;
  status: string;
  uploadedFileNames: string[];
  companyId?: string;
  highestStepReached?: number;
}

export default function DataValidation({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { parsedResult } = useInventoryData();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approveStatus, setApproveStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"parsed" | "ignored" | "needsReview" | "sheetDiagnosis">("parsed");
  const [selectedDiagIndex, setSelectedDiagIndex] = useState<number>(0);

  useEffect(() => {
    const fetchReport = async () => {
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
        setError("Could not retrieve report metadata.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  useEffect(() => {
    if (!loading && !parsedResult && report && ["validated", "generated", "approved", "closed"].includes(report.status.toLowerCase())) {
      router.replace(`/reports/${id}/dashboard`);
    }
  }, [loading, parsedResult, report, router, id]);

  const handleApprove = async () => {
    setIsApproving(true);
    setApproveStatus("Initializing calculations...");
    try {
      const companyId = report?.companyId || "default-company-id";
      
      let summary = {
        totalItems: 0,
        matchedItems: 0,
        mismatchedItems: 0,
        matchRate: 100,
        mismatchRate: 0,
        totalShortageValue: 0,
        totalExcessValue: 0,
        netVariance: 0,
        totalErpValue: 0,
        totalPhysicalValue: 0
      };

      let computedRows: any[] = [];
      if (parsedResult) {
        setApproveStatus("Running variance analysis...");
        computedRows = computeRowMetrics(parsedResult.parsedRows, companyId, id);
        summary = calculateInventorySummary(computedRows);
      }

      // Perform chunked batch write for inventoryItems
      if (computedRows.length > 0) {
        const CHUNK_SIZE = 1000;
        const itemsCol = collection(db, "reports", id, "inventoryItems");
        
        for (let i = 0; i < computedRows.length; i += CHUNK_SIZE) {
          const chunk = computedRows.slice(i, i + CHUNK_SIZE);
          const chunkDocRef = doc(itemsCol, `chunk_${Math.floor(i / CHUNK_SIZE)}`);
          
          setApproveStatus(`Saving ${computedRows.length} inventory items (${Math.min(i + CHUNK_SIZE, computedRows.length)} / ${computedRows.length})...`);
          await setDoc(chunkDocRef, {
            items: chunk,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // Perform chunked batch write for agingData
      const agingDataList = parsedResult?.agingData || [];
      if (agingDataList.length > 0) {
        const CHUNK_SIZE = 1000;
        const agingCol = collection(db, "reports", id, "agingData");
        
        for (let i = 0; i < agingDataList.length; i += CHUNK_SIZE) {
          const chunk = agingDataList.slice(i, i + CHUNK_SIZE);
          const chunkDocRef = doc(agingCol, `chunk_${Math.floor(i / CHUNK_SIZE)}`);
          
          setApproveStatus(`Saving ${agingDataList.length} aging records (${Math.min(i + CHUNK_SIZE, agingDataList.length)} / ${agingDataList.length})...`);
          await setDoc(chunkDocRef, {
            records: chunk,
            companyId,
            reportId: id,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      setApproveStatus("Finalizing validation report...");
      const docRef = doc(db, "reports", id);
      const currentHighest = getHighestStep(report);
      await updateDoc(docRef, {
        status: "Validated",
        updatedAt: new Date(),
        calculatedSummary: summary,
        highestStepReached: Math.max(currentHighest, 3)
      });

      router.push(`/reports/${id}/dashboard`);
    } catch (err) {
      console.error("Error approving validation:", err);
      setError("Failed to run calculations and save records. Try again.");
      setIsApproving(false);
      setApproveStatus("");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-[#08090d]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
        <span className="mt-4 text-sm text-slate-400 font-medium">Analyzing uploaded sheets...</span>
      </div>
    );
  }

  if (!parsedResult) {
    // If already validated with no in-memory data, the useEffect above will have
    // triggered router.replace('/reports'). Show a minimal redirect spinner.
    if (report?.status === "Validated") {
      return (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
          <span className="mt-4 text-sm text-slate-400 font-medium">Redirecting...</span>
        </div>
      );
    }

    // Otherwise, the data was never uploaded for this session
    return (
      <div className="space-y-6 max-w-xl mx-auto py-12 text-center animate-in fade-in duration-300">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">No Excel Data Found</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Excel data is parsed directly in browser memory and is not stored permanently. 
            Your session has expired or you have not uploaded files for this report cycle yet.
          </p>
        </div>
        <div className="pt-4">
          <Link
            href={`/reports/${id}/upload`}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Upload Workspace
          </Link>
        </div>
      </div>
    );
  }

  const {
    totalFiles,
    totalSheets,
    totalRows,
    parsedRows,
    ignoredRows,
    needsReviewRows,
    detectedColumns,
    ignoredColumns,
    missingRequiredColumns,
    sheetDiagnoses
  } = parsedResult;

  // Filter column detection categories
  const mappedColsUnique = Array.from(new Set(detectedColumns.map(c => `${c.sourceColumn} → ${c.mappedField}`)));
  const agingColsUnique = Array.from(new Set(ignoredColumns.filter(c => c.reason === "Aging Column").map(c => c.sourceColumn)));
  const otherIgnoredColsUnique = Array.from(new Set(ignoredColumns.filter(c => c.reason !== "Aging Column").map(c => c.sourceColumn)));

  // Generate file and sheet level breakdown dynamically
  interface SheetSummary {
    fileName: string;
    sheetName: string;
    scanned: number;
    parsed: number;
    ignored: number;
    needsReview: number;
    missingCols: string[];
    detectedCols: string[];
  }

  const sheetSummariesMap: Record<string, SheetSummary> = {};

  const addRowToSummary = (fileName: string, sheetName: string, type: "parsed" | "ignored" | "needsReview") => {
    const key = `${fileName}::${sheetName}`;
    if (!sheetSummariesMap[key]) {
      sheetSummariesMap[key] = {
        fileName,
        sheetName,
        scanned: 0,
        parsed: 0,
        ignored: 0,
        needsReview: 0,
        missingCols: [],
        detectedCols: []
      };
    }
    sheetSummariesMap[key].scanned++;
    sheetSummariesMap[key][type]++;
  };

  parsedRows?.forEach(r => addRowToSummary(r.sourceFileName, r.sheetName, "parsed"));
  ignoredRows?.forEach(r => addRowToSummary(r.sourceFileName, r.sheetName, "ignored"));
  needsReviewRows?.forEach(r => addRowToSummary(r.sourceFileName, r.sheetName, "needsReview"));

  Object.values(sheetSummariesMap).forEach(summary => {
    const cols = detectedColumns
      .filter(c => c.sheetName === summary.sheetName)
      .map(c => `${c.sourceColumn} → ${c.mappedField}`);
    summary.detectedCols = Array.from(new Set(cols));
    
    const required = ["item", "description"];
    const found = detectedColumns
      .filter(c => c.sheetName === summary.sheetName)
      .map(c => c.mappedField);
    summary.missingCols = required.filter(r => !found.includes(r));
  });

  const parsedPreviewRows = parsedRows.slice(0, 50);

  // Fallback compute dataProfile if it was not pre-calculated
  const dataProfile = parsedResult.dataProfile || profileInventoryData(
    parsedRows,
    ignoredRows,
    needsReviewRows,
    sheetDiagnoses || [],
    (parsedResult as any).agingData || []
  );

  const getMethodBadgeStyle = (method?: string) => {
    switch (method) {
      case "direct_supplier_name":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "source_file_name":
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      case "description_match":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "unmatched_others":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/reports/${id}/upload`}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              {report?.quarter} {report?.year} Cycle
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
              Validation Workspace: {report?.title}
            </h1>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-2 text-xs font-semibold text-emerald-400 self-start sm:self-center">
          <CheckCircle2 className="h-4.5 w-4.5" />
          <span>Ingested Rows Accounted For: 100%</span>
        </div>
      </div>

      {/* Progress Steps Component */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-3xl mx-auto border-b border-slate-800/80 pb-4 w-full">
        {[
          { number: 1, label: "Upload Excel", path: "upload" },
          { number: 2, label: "Validate Data", path: "validate" },
          { number: 3, label: "Dashboard", path: "dashboard" },
          { number: 4, label: "Report PDF", path: "builder" }
        ].map((step) => {
          const isCurrent = step.number === 2;
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
            <div key={step.number} className="border-b-2 border-transparent pb-2 opacity-30 flex items-center justify-center gap-2">
              <span className="h-4.5 w-4.5 rounded-full bg-slate-800/80 text-[10px] font-bold flex items-center justify-center text-slate-500 flex-shrink-0">{step.number}</span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-400 max-w-5xl">
          {error}
        </div>
      )}

      {/* Data Profile Section */}
      <div className="space-y-6 max-w-[1600px]">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-indigo-450" />
            <span>Data Profile Summary</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Profiled in-memory</span>
        </div>

        {/* 4-column responsive grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Row Accountability */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e14]/50 p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Row Accountability</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                dataProfile.rowAccountability.integrityCheckPassed 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-455" 
                  : "bg-rose-500/10 border-rose-500/20 text-rose-450"
              }`}>
                {dataProfile.rowAccountability.integrityCheckPassed ? "Passed" : "Discrepancy"}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[9px] text-slate-500 block">Total Rows</span>
                <span className="font-mono font-bold text-sm text-white">{dataProfile.rowAccountability.totalWorksheetRows.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Imported</span>
                <span className="font-mono font-bold text-sm text-emerald-400">{dataProfile.rowAccountability.importedInventoryRows.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Ignored</span>
                <span className="font-mono font-bold text-sm text-slate-400">{dataProfile.rowAccountability.ignoredTechnicalRows.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Needs Review</span>
                <span className="font-mono font-bold text-sm text-slate-400">{dataProfile.rowAccountability.needsReviewRows.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Item Profile */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e14]/50 p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Profile</span>
              </div>
              {dataProfile.itemProfile.duplicateItemCodes.length > 0 && (
                <span className="text-[8px] bg-amber-500/10 border border-amber-500/25 rounded px-1 text-amber-400 font-mono">
                  DUPLICATES
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-slate-500 block">Unique Codes</span>
                <span className="font-mono font-bold text-sm text-white">{dataProfile.itemProfile.uniqueItemCodes.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Duplicates</span>
                <span className={`font-mono font-bold text-sm ${dataProfile.itemProfile.duplicateItemCodesCount > 0 ? "text-amber-400" : "text-slate-400"}`}>
                  {dataProfile.itemProfile.duplicateItemCodesCount.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Blank Codes</span>
                <span className={`font-mono font-bold text-xs ${dataProfile.itemProfile.blankItemCodesCount > 0 ? "text-rose-450" : "text-slate-400"}`}>
                  {dataProfile.itemProfile.blankItemCodesCount.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Blank Desc</span>
                <span className={`font-mono font-bold text-xs ${dataProfile.itemProfile.blankDescriptionsCount > 0 ? "text-rose-450" : "text-slate-400"}`}>
                  {dataProfile.itemProfile.blankDescriptionsCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Organization Profile */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e14]/50 p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organizations</span>
              </div>
              <span className="text-[9px] text-slate-350 font-mono font-bold">
                {dataProfile.orgProfile.uniqueOrgs.toLocaleString()} Orgs
              </span>
            </div>
            
            <div className="space-y-1.5 pt-0.5">
              <div>
                <span className="text-[9px] text-slate-500 block">Top Org by Rows</span>
                <span className="text-[10px] font-semibold text-slate-200 block truncate" title={dataProfile.orgProfile.topOrgByRows || "N/A"}>
                  {dataProfile.orgProfile.topOrgByRows || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Top Org by Value</span>
                <span className="text-[10px] font-semibold text-slate-200 block truncate" title={dataProfile.orgProfile.topOrgByValue || "N/A"}>
                  {dataProfile.orgProfile.topOrgByValue || "N/A"}
                </span>
              </div>
              {dataProfile.orgProfile.blankOrgsCount > 0 && (
                <div className="flex justify-between items-center text-[9px] text-amber-400">
                  <span>Blank Orgs:</span>
                  <span className="font-mono font-bold">{dataProfile.orgProfile.blankOrgsCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Supplier Profile */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e14]/50 p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suppliers</span>
              </div>
              <span className="text-[9px] text-slate-350 font-mono font-bold">
                {dataProfile.supplierProfile.uniqueSuppliers.toLocaleString()} Sups
              </span>
            </div>
            
            <div className="space-y-1.5 pt-0.5">
              <div>
                <span className="text-[9px] text-slate-500 block">Top Supplier by Rows</span>
                <span className="text-[10px] font-semibold text-slate-200 block truncate" title={dataProfile.supplierProfile.topSupplierByRows || "N/A"}>
                  {dataProfile.supplierProfile.topSupplierByRows || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Top Supplier by Value</span>
                <span className="text-[10px] font-semibold text-slate-200 block truncate" title={dataProfile.supplierProfile.topSupplierByValue || "N/A"}>
                  {dataProfile.supplierProfile.topSupplierByValue || "N/A"}
                </span>
              </div>
              {dataProfile.supplierProfile.blankSuppliersCount > 0 && (
                <div className="flex justify-between items-center text-[9px] text-amber-400">
                  <span>Blank Suppliers:</span>
                  <span className="font-mono font-bold">{dataProfile.supplierProfile.blankSuppliersCount}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Card 5: Value Profile */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e14]/50 p-4.5 space-y-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-450" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Value Profile (SAR)</span>
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="text-[9px] text-slate-500 block">Total Inventory Value</span>
                {dataProfile.valueProfile.financialValueStatus === "not_found" ? (
                  <span className="font-sans font-bold text-xs text-rose-450 block mt-0.5">
                    Financial value column not detected
                  </span>
                ) : dataProfile.valueProfile.financialValueStatus === "all_blank" ? (
                  <span className="font-sans font-bold text-xs text-amber-500 block mt-0.5">
                    Financial values are blank
                  </span>
                ) : dataProfile.valueProfile.financialValueStatus === "all_zero" ? (
                  <span className="font-mono font-black text-sm text-amber-400 block mt-0.5">
                    0.00 SAR (All zeroes)
                  </span>
                ) : (
                  <span className="font-mono font-black text-sm text-emerald-400 block mt-0.5">
                    {dataProfile.valueProfile.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-1 pt-1 text-[9px]">
                <div>
                  <span className="text-slate-500 block">Zero Value</span>
                  <span className="font-mono text-slate-350">{dataProfile.valueProfile.zeroValueCount}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Negative</span>
                  <span className={`font-mono ${dataProfile.valueProfile.negativeValueCount > 0 ? "text-rose-400 font-bold" : "text-slate-350"}`}>
                    {dataProfile.valueProfile.negativeValueCount}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Blank/Invalid</span>
                  <span className={`font-mono ${dataProfile.valueProfile.blankOrInvalidValueCount > 0 ? "text-amber-400" : "text-slate-350"}`}>
                    {dataProfile.valueProfile.blankOrInvalidValueCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 6: Quantity Profile */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e14]/50 p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity Profile</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                dataProfile.quantityProfile.hasQuantityData 
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
                  : "bg-slate-800 text-slate-500 border-slate-850"
              }`}>
                {dataProfile.quantityProfile.hasQuantityData ? "Available" : "Not Provided"}
              </span>
            </div>

            {dataProfile.quantityProfile.hasQuantityData ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-500 block text-[9px]">System On Hand</span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {dataProfile.quantityProfile.totalSystemOnHand.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Physical Count</span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {dataProfile.quantityProfile.totalPhysicalCount.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-1 pt-1 text-[9px] border-t border-slate-900/60 mt-1">
                  <div>
                    <span className="text-slate-500 block">Mismatch</span>
                    <span className={`font-mono ${dataProfile.quantityProfile.variationMismatchCount > 0 ? "text-amber-400 font-bold" : "text-slate-350"}`}>
                      {dataProfile.quantityProfile.variationMismatchCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Negative</span>
                    <span className={`font-mono ${dataProfile.quantityProfile.negativeQuantitiesCount > 0 ? "text-rose-400 font-bold" : "text-slate-350"}`}>
                      {dataProfile.quantityProfile.negativeQuantitiesCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Missing physical</span>
                    <span className={`font-mono ${dataProfile.quantityProfile.missingPhysicalCountCount > 0 ? "text-amber-400" : "text-slate-350"}`}>
                      {dataProfile.quantityProfile.missingPhysicalCountCount}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-12">
                <span className="text-[10px] text-slate-500 italic">No inventory count columns detected.</span>
              </div>
            )}
          </div>

          {/* Card 7: Business Concentration */}
          {(() => {
            const hasValues = dataProfile.valueProfile.financialValueStatus === "parsed_successfully";
            
            // Top Supplier
            const topSupplierValue = dataProfile.supplierProfile.topSuppliersByTotalValue?.[0];
            const topSupplierRow = dataProfile.supplierProfile.topSuppliersByRowCount?.[0];
            const topSupplierName = hasValues ? (topSupplierValue?.supplier || "N/A") : (topSupplierRow?.supplier || "N/A");
            const topSupplierMetric = hasValues && topSupplierValue
              ? `${topSupplierValue.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR`
              : `${topSupplierRow?.count || 0} Rows`;

            // Top Org
            const topOrgValue = dataProfile.orgProfile.topOrgsByTotalValue?.[0];
            const topOrgRow = dataProfile.orgProfile.topOrgsByRowCount?.[0];
            const topOrgName = hasValues ? (topOrgValue?.org || "N/A") : (topOrgRow?.org || "N/A");
            const topOrgMetric = hasValues && topOrgValue
              ? `${topOrgValue.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR`
              : `${topOrgRow?.count || 0} Rows`;

            // Top Items
            const topItems = hasValues 
              ? (dataProfile.valueProfile.topHighestValueItems || []).slice(0, 2)
              : [...parsedRows].sort((a, b) => b.systemOnHand - a.systemOnHand).slice(0, 2).map(r => ({
                  item: r.item,
                  description: r.description,
                  value: r.systemOnHand
                }));

            return (
              <div className="rounded-xl border border-slate-800 bg-[#0c0e14]/50 p-4.5 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-indigo-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Business Concentration</span>
                    </div>
                    <span className="text-[8px] bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 text-indigo-400 font-mono font-bold uppercase tracking-wider">
                      {hasValues ? "By Value" : "By Volume"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pb-2 border-b border-slate-900/60">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Top Supplier</span>
                      <span className="text-slate-200 font-bold block truncate mt-0.5" title={topSupplierName}>
                        {topSupplierName}
                      </span>
                      <span className="text-indigo-400 font-mono text-[9px] block font-semibold">
                        {topSupplierMetric}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Top Org/Division</span>
                      <span className="text-slate-200 font-bold block truncate mt-0.5" title={topOrgName}>
                        {topOrgName}
                      </span>
                      <span className="text-indigo-400 font-mono text-[9px] block font-semibold">
                        {topOrgMetric}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">
                      {hasValues ? "Highest Value Assets" : "Highest Quantity Assets"}
                    </span>
                    {topItems.length > 0 ? (
                      <div className="space-y-1.5">
                        {topItems.map((item, index) => (
                          <div key={index} className="flex justify-between items-center text-[10px] bg-slate-900/20 rounded p-1 border border-slate-800/40">
                            <div className="truncate max-w-[140px] pr-1.5">
                              <span className="font-mono text-indigo-400 font-bold mr-1">{item.item}</span>
                              <span className="text-slate-300 italic truncate" title={item.description}>
                                {item.description || "No Description"}
                              </span>
                            </div>
                            <span className="font-mono font-semibold text-slate-200 flex-shrink-0">
                              {hasValues 
                                ? `${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR` 
                                : `${item.value.toLocaleString()} Qty`
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic block">No items to analyze.</span>
                    )}
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 leading-normal border-t border-slate-900/60 pt-2 flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 text-indigo-400/80 flex-shrink-0 mt-0.5" />
                  <span>
                    These highlights represent the largest concentrations in the uploaded workbook, useful for business analysis and client reporting.
                  </span>
                </div>
              </div>
            );
          })()}

        </div>

        {/* Data Quality Warnings */}
        {dataProfile.warnings.length > 0 && (
          <div className="rounded-xl border border-slate-800/80 bg-[#0c0e14]/50 p-4.5 space-y-3">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
              <span>Data Quality Warnings ({dataProfile.warnings.length})</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dataProfile.warnings.map((w, idx) => {
                const colors: Record<string, { border: string; bg: string; text: string; iconColor: string }> = {
                  error: { border: "border-rose-500/20", bg: "bg-rose-500/5", text: "text-rose-450", iconColor: "text-rose-455" },
                  warning: { border: "border-amber-500/20", bg: "bg-amber-500/5", text: "text-amber-400", iconColor: "text-amber-405" },
                  info: { border: "border-cyan-500/20", bg: "bg-cyan-500/5", text: "text-cyan-400", iconColor: "text-cyan-400" },
                };
                const c = colors[w.severity] || colors.warning;
                return (
                  <div key={idx} className={`rounded-lg border ${c.border} ${c.bg} p-3 flex gap-2.5 items-start`}>
                    <AlertCircle className={`h-4 w-4 ${c.iconColor} flex-shrink-0 mt-0.5`} />
                    <div className="text-[11px] space-y-0.5">
                      <span className={`font-bold uppercase text-[9px] block ${c.iconColor}`}>{w.severity}</span>
                      <p className="text-slate-350 leading-normal">{w.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Review Dashboard Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px]">
        
        {/* Left Area: Previews & Rejection Review */}
        <div className="lg:col-span-9 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md overflow-hidden">
            
            {/* Tabs */}
            <div className="border-b border-slate-800 bg-slate-950/30 px-6 py-2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("parsed")}
                  className={`px-4 py-3 text-xs font-bold border-b-2 tracking-wide uppercase transition-all ${
                    activeTab === "parsed"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Imported Rows ({parsedRows.length})
                </button>
                <button
                  onClick={() => setActiveTab("ignored")}
                  className={`px-4 py-3 text-xs font-bold border-b-2 tracking-wide uppercase transition-all ${
                    activeTab === "ignored"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Ignored Technical Rows ({ignoredRows.length})
                </button>
                <button
                  onClick={() => setActiveTab("needsReview")}
                  className={`px-4 py-3 text-xs font-bold border-b-2 tracking-wide uppercase transition-all ${
                    activeTab === "needsReview"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Needs Review Rows ({needsReviewRows.length})
                </button>
                <button
                  onClick={() => setActiveTab("sheetDiagnosis")}
                  className={`px-4 py-3 text-xs font-bold border-b-2 tracking-wide uppercase transition-all ${
                    activeTab === "sheetDiagnosis"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Sheet Diagnosis ({sheetDiagnoses?.length || 0})
                </button>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {activeTab === "parsed" && `Showing 1 - ${Math.min(50, parsedRows.length)} of ${parsedRows.length} rows`}
                {activeTab === "ignored" && `Showing ${ignoredRows.length} ignored technical rows`}
                {activeTab === "needsReview" && `Showing ${needsReviewRows.length} potential review rows`}
                {activeTab === "sheetDiagnosis" && `Showing ${sheetDiagnoses?.length || 0} worksheets`}
              </span>
            </div>

            {/* Tab: Parsed rows preview */}
            {activeTab === "parsed" && (
              <div className="overflow-x-auto">
                {parsedRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <FileQuestion className="h-12 w-12 opacity-30 mb-2" />
                    <span className="text-sm font-semibold">No valid rows parsed</span>
                    <span className="text-xs text-slate-650 mt-1">Check needs review list to troubleshoot.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase tracking-wider font-bold">
                        <th className="p-3">Item Code</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Org</th>
                        <th className="p-3">Supplier Name (Detection)</th>
                        <th className="p-3 text-right">ERP Stock</th>
                        <th className="p-3 text-right">Physical Count</th>
                        <th className="p-3 text-right">Variance</th>
                        <th className="p-3 text-right">Valuation (SAR)</th>
                        <th className="p-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-350">
                      {parsedPreviewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/10">
                          <td className="p-3 font-mono text-slate-200 font-bold">{row.item}</td>
                          <td className="p-3 font-medium max-w-[200px] truncate" title={row.description}>{row.description}</td>
                          <td className="p-3 text-slate-400 font-medium">{row.org || "—"}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-200">{row.supplier}</span>
                            <div className="mt-0.5">
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[8px] font-medium tracking-wide ${getMethodBadgeStyle((row as any).supplierDetectionMethod)}`}>
                                {(row as any).supplierDetectionMethod?.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-slate-400">{row.systemOnHand.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-100">{row.physicalCount.toLocaleString()}</td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            row.variation < 0 ? "text-rose-400" : row.variation > 0 ? "text-emerald-400" : "text-slate-500"
                          }`}>
                            {row.variation > 0 ? `+${row.variation}` : row.variation}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-200">
                            {row.totalValueSar !== null ? row.totalValueSar.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                          </td>
                          <td className="p-3 italic text-slate-500 text-[10px] truncate max-w-[120px]" title={row.remarks}>{row.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab: Ignored Rows */}
            {activeTab === "ignored" && (
              <div className="overflow-x-auto">
                {ignoredRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500/30 mb-2" />
                    <span className="text-sm font-semibold">No ignored rows</span>
                    <span className="text-xs text-slate-650 mt-1">Every row was parsed or needs review.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase tracking-wider font-bold">
                        <th className="p-3 w-16 text-center">Row #</th>
                        <th className="p-3">Sheet Name</th>
                        <th className="p-3">Source File</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3">Raw Data Cell Preview (First 4 columns)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-400">
                      {ignoredRows.map((row, idx) => {
                        const cellPreviews = Object.entries(row.rawRowData)
                          .slice(0, 4)
                          .map(([k, v]) => `${k}: "${v}"`)
                          .join(" | ");

                        return (
                          <tr key={idx} className="hover:bg-slate-900/10">
                            <td className="p-3 text-center font-mono text-slate-500">{row.originalRowNumber}</td>
                            <td className="p-3 font-semibold text-slate-350">{row.sheetName}</td>
                            <td className="p-3 text-slate-500 truncate max-w-[180px]" title={row.sourceFileName}>{row.sourceFileName}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${
                                row.category === "ignored_header_row" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                                row.category === "ignored_empty_row" ? "bg-slate-800 text-slate-400 border border-slate-700/50" :
                                row.category === "ignored_total_row" ? "bg-amber-500/10 text-amber-450 border border-amber-500/20" :
                                "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              }`}>
                                {row.category.replace("ignored_", "").replace("_row", "")}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400 font-medium">{row.reason}</td>
                            <td className="p-3 font-mono text-[10px] text-slate-500 truncate max-w-[350px]" title={cellPreviews}>
                              {cellPreviews || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab: Needs Review Rows (Phase 4B Enhanced) */}
            {activeTab === "needsReview" && (
              <div className="overflow-x-auto">
                {needsReviewRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500/30 mb-2" />
                    <span className="text-sm font-semibold">No items need review</span>
                    <span className="text-xs text-slate-650 mt-1">100% of candidate data rows parsed successfully!</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse min-w-[1100px]">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase tracking-wider font-bold">
                        <th className="p-3 w-14 text-center">Row #</th>
                        <th className="p-3">Sheet</th>
                        <th className="p-3">Dataset Type</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3">Validation Issues</th>
                        <th className="p-3">Fields Found / Missing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-400">
                      {needsReviewRows.slice(0, 100).map((row, idx) => {
                        const dtLabel: Record<string, string> = { inventory_count_sheet: "Count", inventory_aging_sheet: "Aging", mixed_inventory_sheet: "Mixed", summary_sheet: "Summary", unknown_sheet: "Unknown" };
                        const dtColor: Record<string, string> = { inventory_count_sheet: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", inventory_aging_sheet: "text-violet-400 bg-violet-500/10 border-violet-500/20", mixed_inventory_sheet: "text-sky-400 bg-sky-500/10 border-sky-500/20", summary_sheet: "text-slate-400 bg-slate-500/10 border-slate-500/20", unknown_sheet: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
                        return (
                          <tr key={idx} className="hover:bg-slate-900/10 border-l-2 border-rose-500/40">
                            <td className="p-3 text-center font-mono text-slate-500">{row.originalRowNumber}</td>
                            <td className="p-3 font-semibold text-slate-350 truncate max-w-[120px]" title={`${row.sourceFileName} → ${row.sheetName}`}>{row.sheetName}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold border ${dtColor[row.datasetType || ""] || dtColor.unknown_sheet}`}>
                                {dtLabel[row.datasetType || ""] || "—"}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-rose-500/10 text-rose-450 border border-rose-500/20">{row.reason}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {(row.validationCodes || []).map((code, ci) => (<span key={ci} className="text-[8px] bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-slate-400 font-mono">{code}</span>))}
                              </div>
                            </td>
                            <td className="p-3 text-[10px]">
                              {row.mappedFieldsFound && row.mappedFieldsFound.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mb-0.5">{row.mappedFieldsFound.map((f, fi) => (<span key={fi} className="text-[8px] bg-emerald-500/5 border border-emerald-500/15 rounded px-1 py-0.5 text-emerald-400">{f}</span>))}</div>
                              )}
                              {row.missingFields && row.missingFields.length > 0 && (
                                <div className="flex flex-wrap gap-0.5">{row.missingFields.map((f, fi) => (<span key={fi} className="text-[8px] bg-rose-500/5 border border-rose-500/15 rounded px-1 py-0.5 text-rose-400">✗ {f}</span>))}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {needsReviewRows.length > 100 && (
                  <div className="text-center py-3 text-xs text-slate-500">Showing 100 of {needsReviewRows.length.toLocaleString()} rows</div>
                )}
              </div>
            )}

            {/* Tab: Sheet Diagnosis (Phase 4D) */}
            {activeTab === "sheetDiagnosis" && (
              <div className="p-6 space-y-6">
                {/* Upper Worksheet Selector Grid */}
                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">Worksheets Scanned ({sheetDiagnoses?.length || 0})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(sheetDiagnoses || []).map((diag, index) => {
                      const isSelected = selectedDiagIndex === index;
                      const confidenceColors = {
                        high: "border-emerald-500 bg-emerald-500/5 text-emerald-400",
                        medium: "border-amber-500 bg-amber-500/5 text-amber-400",
                        low: "border-rose-500/20 bg-rose-500/5 text-rose-455",
                        none: "border-slate-800 bg-[#0c0e14]/50 text-slate-500"
                      };
                      const fdConf = diag.financialDiscovery?.confidence || "none";
                      const statusColor = confidenceColors[fdConf] || confidenceColors.none;

                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedDiagIndex(index)}
                          className={`w-full text-left rounded-xl p-4 border transition-all flex flex-col justify-between h-32 cursor-pointer ${
                            isSelected 
                              ? "ring-2 ring-indigo-500 border-indigo-400 bg-slate-900/40" 
                              : "border-slate-800 bg-slate-900/10 hover:border-slate-700"
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 font-mono block truncate" title={diag.sourceFileName}>
                              {diag.sourceFileName}
                            </span>
                            <h5 className="text-sm font-bold text-slate-200 truncate" title={diag.sheetName}>
                              {diag.sheetName}
                            </h5>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${statusColor}`}>
                              Value Map: {fdConf.toUpperCase()}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {diag.importedRows} / {diag.totalRowsScanned} rows
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Worksheet Inspection Details Panel */}
                {sheetDiagnoses && sheetDiagnoses[selectedDiagIndex] && (() => {
                  const diag = sheetDiagnoses[selectedDiagIndex];
                  const fd = diag.financialDiscovery;
                  
                  return (
                    <div className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-5 space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-3 flex-wrap gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-white">Worksheet Analysis: {diag.sheetName}</h4>
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{diag.sourceFileName}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold bg-slate-850 border border-slate-800 text-slate-400">
                            Type: {diag.datasetType.replace(/_/g, " ").toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold border ${
                            diag.confidenceLevel === "high" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                            diag.confidenceLevel === "medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                            "bg-rose-500/10 border-rose-500/20 text-rose-455"
                          }`}>
                            Overall Confidence: {diag.confidenceLevel.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Row accounting summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div className="bg-[#0c0e15]/60 border border-slate-900 rounded-lg p-3">
                          <span className="text-[10px] text-slate-500 block">Total Rows Scanned</span>
                          <span className="font-mono text-base font-bold text-slate-200">{diag.totalRowsScanned}</span>
                        </div>
                        <div className="bg-[#0c0e15]/60 border border-slate-900 rounded-lg p-3">
                          <span className="text-[10px] text-slate-500 block">Imported Items</span>
                          <span className="font-mono text-base font-bold text-emerald-450">{diag.importedRows}</span>
                        </div>
                        <div className="bg-[#0c0e15]/60 border border-slate-900 rounded-lg p-3">
                          <span className="text-[10px] text-slate-500 block">Ignored Rows</span>
                          <span className="font-mono text-base font-bold text-slate-450">{diag.ignoredTechnicalRows}</span>
                        </div>
                        <div className="bg-[#0c0e15]/60 border border-slate-900 rounded-lg p-3">
                          <span className="text-[10px] text-slate-500 block">Needs Review</span>
                          <span className="font-mono text-base font-bold text-rose-450">{diag.needsReviewRows}</span>
                        </div>
                      </div>

                      {/* Columns Detected */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Detected Standard Fields</h5>
                          {diag.detectedStandardColumns.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic">None detected</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {diag.detectedStandardColumns.map((col, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
                                  {col}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Missing Expected Fields</h5>
                          {diag.missingExpectedColumns.length === 0 ? (
                            <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                              ✓ All expected columns mapped
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {diag.missingExpectedColumns.map((col, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  {col}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Financial Value Mapping Diagnosis Section */}
                      <div className="border-t border-slate-850 pt-5 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                              <TrendingUp className="h-4 w-4" />
                              Financial Column Discovery Details
                            </h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">Scanned candidates to identify total value or unit price fields.</p>
                          </div>
                          
                          {fd && (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                              fd.confidence === "high" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-455" :
                              fd.confidence === "medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                              fd.confidence === "low" ? "bg-rose-500/10 border-rose-500/20 text-rose-455" :
                              "bg-slate-800 text-slate-500 border-slate-700"
                            }`}>
                              Mapping Status: {fd.confidence === "none" ? "NOT DETECTED" : fd.confidence.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {fd ? (
                          <div className="space-y-4">
                            {/* Discovery Summary Alert */}
                            <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                              fd.selectedValueColumn 
                                ? "bg-emerald-500/5 border-emerald-500/15 text-slate-300"
                                : "bg-rose-500/5 border-rose-500/15 text-rose-350"
                            }`}>
                              <span className="font-bold uppercase text-[9px] block mb-1">Diagnosis Result</span>
                              {fd.reason}
                            </div>

                            {/* Candidate Columns List */}
                            <div className="space-y-2">
                              <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidate Columns Searched</h6>
                              {fd.candidateColumns.length === 0 ? (
                                <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-850 text-center text-[11px] text-slate-500 italic">
                                  No column headers matching financial aliases or keywords (value, cost, price, amount, sar) were found.
                                </div>
                              ) : (
                                <div className="border border-slate-855 rounded-lg overflow-hidden">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="bg-slate-900/60 border-b border-slate-850 text-slate-400 font-bold">
                                        <th className="p-2.5">Column Header</th>
                                        <th className="p-2.5 text-center">Col Index</th>
                                        <th className="p-2.5 text-right">Numeric Cells</th>
                                        <th className="p-2.5 text-right">Blank/Empty Cells</th>
                                        <th className="p-2.5">Sample Values</th>
                                        <th className="p-2.5">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-850 text-slate-350 bg-[#0c0e15]/20">
                                      {fd.candidateColumns.map((cand, cidx) => {
                                        const isSelectedCol = fd.selectedValueColumnName === cand.columnName;
                                        return (
                                          <tr key={cidx} className={`hover:bg-slate-900/5 ${isSelectedCol ? "bg-indigo-500/5 border-l-2 border-l-indigo-500" : ""}`}>
                                            <td className="p-2.5 font-semibold text-slate-200">{cand.columnName}</td>
                                            <td className="p-2.5 text-center font-mono text-slate-550">{cand.columnIndex}</td>
                                            <td className="p-2.5 text-right font-mono font-medium text-emerald-400">{cand.numericCellCount}</td>
                                            <td className="p-2.5 text-right font-mono text-slate-500">{cand.blankCellCount}</td>
                                            <td className="p-2.5 font-mono text-[10px] text-slate-400">
                                              {cand.sampleValues.length > 0 
                                                ? cand.sampleValues.map(v => `"${v}"`).join(", ") 
                                                : "—"
                                              }
                                            </td>
                                            <td className="p-2.5">
                                              {cand.isRejected ? (
                                                <span className="inline-flex items-center text-rose-400 text-[10px]" title={cand.rejectionReason}>
                                                  ✗ Rejected
                                                  {cand.rejectionReason && (
                                                    <span className="text-[9px] text-slate-500 block font-normal ml-1">({cand.rejectionReason})</span>
                                                  )}
                                                </span>
                                              ) : isSelectedCol ? (
                                                <span className="inline-flex items-center text-emerald-455 text-[10px] font-bold">
                                                  ✓ Selected
                                                </span>
                                              ) : (
                                                <span className="text-slate-550 text-[10px]">
                                                  Candidate Not Mapped
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                            
                            {/* Helper warning */}
                            {!fd.selectedValueColumn && (
                              <div className="flex gap-2 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg text-[11px] text-slate-400 leading-normal">
                                <Info className="h-4.5 w-4.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-slate-350 block mb-0.5">Missing Cost Basis Data Warning</span>
                                  Proceeding with calculations will default total values to <span className="font-bold text-amber-400">null / blank</span>. 
                                  If your Excel files contain prices but they are not listed in standard headers, verify if any column matches the alias registry or contact support to add custom column aliases.
                                </div>
                              </div>
                            )}

                          </div>
                        ) : (
                          <div className="p-4 rounded-lg bg-slate-900/20 border border-slate-850 text-center text-xs text-slate-500 italic">
                            Financial discovery information is not available for this sheet. Make sure the workbook was processed by the latest parsing engine.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        </div>

        {/* Right Area: Control Panel & Warnings */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Row Classification Breakdown Card */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/50 p-6 space-y-4">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-slate-850 pb-2 flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-indigo-400" />
              <span>Classification Stats</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-900/60">
                <span className="text-slate-400">Valid Items:</span>
                <span className="font-mono font-bold text-emerald-450">{parsedRows.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900/60">
                <span className="text-slate-400">Header Rows:</span>
                <span className="font-mono font-semibold text-slate-300">{ignoredRows.filter(r => r.category === "ignored_header_row").length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900/60">
                <span className="text-slate-400">Empty Rows:</span>
                <span className="font-mono font-semibold text-slate-500">{ignoredRows.filter(r => r.category === "ignored_empty_row").length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900/60">
                <span className="text-slate-400">Total/Subtotal Rows:</span>
                <span className="font-mono font-semibold text-amber-400">{ignoredRows.filter(r => r.category === "ignored_total_row").length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-900/60">
                <span className="text-slate-400">Summary Sheets:</span>
                <span className="font-mono font-semibold text-purple-400">{ignoredRows.filter(r => r.category === "ignored_summary_row").length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Needs Review:</span>
                <span className="font-mono font-bold text-rose-400">{needsReviewRows.length.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Warnings card if any */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/50 p-6 space-y-4">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-slate-850 pb-2 flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
              <span>Validation Diagnostics</span>
            </h3>

            <div className="space-y-3.5 text-xs text-slate-400">
              <div className="flex gap-2.5">
                <Layers className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-slate-200">Supplier Mapping</h5>
                  <p className="mt-0.5 text-[11px] leading-normal">
                    Fallbacks mapped {parsedRows.filter(r => (r as any).supplierDetectionMethod === "description_match").length} item descriptions and {parsedRows.filter(r => (r as any).supplierDetectionMethod === "source_file_name").length} source file names to standard suppliers.
                  </p>
                </div>
              </div>

              {needsReviewRows.filter(r => r.reason.toLowerCase().includes("qty") || r.reason.toLowerCase().includes("quantities")).length > 0 && (
                <div className="flex gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-550 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-amber-405">Invalid/Missing Quantities</h5>
                    <p className="mt-0.5 text-[11px] leading-normal">
                      {needsReviewRows.filter(r => r.reason.toLowerCase().includes("qty") || r.reason.toLowerCase().includes("quantities")).length} rows have missing or malformed quantities.
                    </p>
                  </div>
                </div>
              )}

              {needsReviewRows.filter(r => r.reason.toLowerCase().includes("item")).length > 0 && (
                <div className="flex gap-2.5">
                  <XCircle className="h-4 w-4 text-rose-450 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-rose-450">Missing Item Codes</h5>
                    <p className="mt-0.5 text-[11px] leading-normal">
                      {needsReviewRows.filter(r => r.reason.toLowerCase().includes("item")).length} rows are missing a valid item code.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Trigger Card */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/50 p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <CheckCircle2 className="h-4.5 w-4.5 text-indigo-400" />
              <span>Workspace Confirmed</span>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Verify detected columns and ignored rows. When ready, approve the workspace to calculate audit summaries and view discrepancies in the dashboard.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleApprove}
                disabled={isApproving || missingRequiredColumns.length > 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-650 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-indigo-500/10"
              >
                {isApproving ? (approveStatus || "Locking & Calculating...") : "Approve & Run Calculations"}
                <ArrowRight className="h-4 w-4" />
              </button>

              <Link
                href={`/reports/${id}/upload`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-850 hover:bg-slate-900/60 px-4 py-2 text-xs font-bold text-slate-400 transition-colors"
              >
                Back to Upload Workspace
              </Link>
            </div>
          </div>

        </div>

      </div>

      {/* Premium Loader Modal */}
      {isApproving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md transition-all duration-300">
          <div className="relative w-full max-w-md mx-4 rounded-2xl border border-slate-800 bg-[#0c0e15]/95 p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Background glowing circle */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-indigo-500/10 blur-xl"></div>
            
            {/* Spinning/pulsing logo */}
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
              <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
              <ShieldCheck className="h-4 w-4 text-indigo-300 absolute" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white tracking-wide">
                Finalizing Audit Workspace
              </h3>
              <p className="text-[11px] text-slate-500 max-w-[280px] mx-auto">
                Running high-precision variance computations and synchronizing records with the database.
              </p>
            </div>

            {/* Checklist of steps */}
            <div className="w-full bg-slate-950/40 rounded-xl border border-slate-900 p-4.5 space-y-3.5 text-left">
              {/* Step 1: Computations */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  {approveStatus.includes("Initializing") || approveStatus.includes("Running") ? (
                    <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span className={(approveStatus.includes("Initializing") || approveStatus.includes("Running")) ? "text-slate-200 font-medium" : "text-slate-400"}>
                    Variance Engine Calculations
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {approveStatus.includes("Initializing") || approveStatus.includes("Running") ? "Running" : "Done"}
                </span>
              </div>

              {/* Step 2: Inventory Items */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  {approveStatus.includes("Saving") && approveStatus.includes("items") ? (
                    <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                  ) : approveStatus.includes("Initializing") || approveStatus.includes("Running") ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-900" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span className={(approveStatus.includes("Saving") && approveStatus.includes("items")) ? "text-slate-200 font-medium" : (approveStatus.includes("Initializing") || approveStatus.includes("Running")) ? "text-slate-650" : "text-slate-400"}>
                    Syncing Inventory Items
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {approveStatus.includes("Saving") && approveStatus.includes("items") ? "Syncing..." : approveStatus.includes("Initializing") || approveStatus.includes("Running") ? "Pending" : "Done"}
                </span>
              </div>

              {/* Step 3: Aging Records */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  {approveStatus.includes("Saving") && approveStatus.includes("aging") ? (
                    <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                  ) : approveStatus.includes("Initializing") || approveStatus.includes("Running") || (approveStatus.includes("Saving") && approveStatus.includes("items")) ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-900" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span className={(approveStatus.includes("Saving") && approveStatus.includes("aging")) ? "text-slate-200 font-medium" : (approveStatus.includes("Initializing") || approveStatus.includes("Running") || (approveStatus.includes("Saving") && approveStatus.includes("items"))) ? "text-slate-650" : "text-slate-400"}>
                    Syncing Aging Analysis
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {approveStatus.includes("Saving") && approveStatus.includes("aging") ? "Syncing..." : approveStatus.includes("Initializing") || approveStatus.includes("Running") || (approveStatus.includes("Saving") && approveStatus.includes("items")) ? "Pending" : "Done"}
                </span>
              </div>

              {/* Step 4: Finalizing */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  {approveStatus.includes("Finalizing") ? (
                    <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                  ) : !approveStatus.includes("Finalizing") && !isApproving ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-900" />
                  )}
                  <span className={approveStatus.includes("Finalizing") ? "text-slate-200 font-medium" : "text-slate-650"}>
                    Finalizing Report Period
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {approveStatus.includes("Finalizing") ? "Writing..." : "Pending"}
                </span>
              </div>
            </div>

            {/* Glowing progress/status text */}
            <div className="w-full text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-900 text-[10px] font-mono font-semibold text-slate-400 tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                {approveStatus}
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
