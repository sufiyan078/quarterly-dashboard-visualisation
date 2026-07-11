"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { db, doc, getDoc, updateDoc, collection, getDocs } from "@/lib/firebase";
import { getHighestStep } from "@/lib/workflow";
import { 
  ArrowLeft, 
  CheckSquare, 
  Signature, 
  Printer, 
  Lock, 
  Sparkles,
  Award,
  Users,
  ShieldCheck,
  Building
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { EvidencePersonnel } from "@/components/report-builder/EvidencePersonnel";
import { PersonnelEntry } from "@/types/personnel";
import { computeDashboardMetrics } from "@/lib/inventory/dashboardCalculations";

interface Report {
  title: string;
  quarter: string;
  year: number;
  location: string;
  status: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  warehouseName?: string;
  highestStepReached?: number;
  calculatedSummary?: {
    totalItems: number;
    matchedItems: number;
    mismatchedItems: number;
    shortageItemsCount?: number;
    excessItemsCount?: number;
    matchRate: number;
    mismatchRate: number;
    shortagePercentage?: number;
    excessPercentage?: number;
    totalShortageValue: number;
    totalExcessValue: number;
    netVariance: number;
    totalErpValue?: number;
    totalPhysicalValue?: number;
  };
}

export default function ReportBuilder() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [agingRecords, setAgingRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Evidence & Personnel state
  const [personnelList, setPersonnelList] = useState<PersonnelEntry[]>([]);

  useEffect(() => {
    const fetchReportAndItems = async () => {
      try {
        const docRef = doc(db, "reports", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const reportData = docSnap.data() as Report;
          setReport(reportData);

          // Update highest step reached on database if it's less than 4
          const currentHighest = getHighestStep(reportData);
          if (currentHighest < 4) {
            await updateDoc(docRef, {
              highestStepReached: 4,
              updatedAt: new Date()
            });
          }

          // Fetch items for discrepancy breakdown table
          const itemsCol = collection(db, "reports", id, "inventoryItems");
          const querySnap = await getDocs(itemsCol);
          const loadedItems: any[] = [];
          querySnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.items && Array.isArray(data.items)) {
              data.items.forEach((item: any) => {
                loadedItems.push({
                  id: item.id || docSnap.id,
                  ...item,
                  // Fallback mapping for compatibility
                  erpQty: item.systemOnHand !== undefined ? item.systemOnHand : (item.erpQty || 0),
                  physicalQty: item.physicalCount !== undefined ? item.physicalCount : (item.physicalQty || 0),
                });
              });
            } else {
              loadedItems.push({
                id: docSnap.id,
                ...data,
                // Fallback mapping for compatibility
                erpQty: data.systemOnHand !== undefined ? data.systemOnHand : (data.erpQty || 0),
                physicalQty: data.physicalCount !== undefined ? data.physicalCount : (data.physicalQty || 0),
              });
            }
          });
          setItems(loadedItems);

          // Fetch aging data records
          const agingCol = collection(db, "reports", id, "agingData");
          const agingSnap = await getDocs(agingCol);
          const loadedAging: any[] = [];
          agingSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.records && Array.isArray(data.records)) {
              data.records.forEach((record: any) => {
                loadedAging.push({
                  id: record.id || docSnap.id,
                  ...record
                });
              });
            } else {
              loadedAging.push({
                id: docSnap.id,
                ...data
              });
            }
          });
          setAgingRecords(loadedAging);
        } else {
          setError("Report session not found.");
        }
      } catch (err: any) {
        console.error("Error fetching report data:", err);
        setError("Could not retrieve report metadata.");
      } finally {
        setLoading(false);
      }
    };

    fetchReportAndItems();
  }, [id]);

  const handleGeneratePdf = async () => {
    if (!report) {
      setError("No report metadata loaded.");
      return;
    }
    setIsGenerating(true);
    setMessage(null);
    setError(null);

    try {
      const element = document.getElementById("pdf-report-template");
      if (!element) {
        throw new Error("PDF template container not found.");
      }

      // Temporarily show the template off-screen
      element.style.display = "block";

      const pdf = new jsPDF("p", "mm", "a4");
      const pages = element.children;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const canvas = await html2canvas(page, {
          scale: 2, // Retain high resolution for typography
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        
        if (i > 0) {
          pdf.addPage();
        }
        // A4 size is 210mm x 297mm
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }

      // Hide the template block again
      element.style.display = "none";

      const safeTitle = (report.title || "Inventory_Report").replace(/[^a-z0-9]/gi, "_").toLowerCase();
      pdf.save(`${safeTitle}_${report.quarter}_${report.year}.pdf`);
      setMessage("PDF package compiled and downloaded successfully!");
      setTimeout(() => {
        setMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error("Error compiling PDF:", err);
      setError("Failed to compile PDF: " + (err.message || err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCloseAudit = async () => {
    setIsClosing(true);
    try {
      const docRef = doc(db, "reports", id);
      await updateDoc(docRef, {
        status: "closed",
        updatedAt: new Date(),
      });
      router.push("/reports");
    } catch (err) {
      console.error("Error closing audit session:", err);
      setError("Could not close audit. Make sure you are logged in.");
      setIsClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#090b11]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
        <span className="mt-4 text-sm text-slate-400">Loading compilation engine...</span>
      </div>
    );
  }

  // Run dynamic metrics calculation
  const metrics = (() => {
    const formattedRows = items.map(item => {
      const erpQty = item.erpQty !== undefined ? item.erpQty : 0;
      const physicalQty = item.physicalQty !== undefined ? item.physicalQty : 0;
      const differenceQty = physicalQty - erpQty;
      const unitCost = item.unitCost || 0;
      const erpValue = erpQty * unitCost;
      const physicalValue = physicalQty * unitCost;
      const varianceValue = differenceQty * unitCost;
      const absoluteVarianceValue = Math.abs(varianceValue);
      
      return {
        ...item,
        itemCode: item.itemCode || "",
        erpQty,
        physicalQty,
        differenceQty,
        absoluteDifferenceQty: Math.abs(differenceQty),
        unitCost,
        erpValue,
        physicalValue,
        varianceValue,
        absoluteVarianceValue,
        sheetName: item.sheetName || "Sheet 1",
        supplier: item.supplierName || item.detectedSupplierName || item.supplier || "Others",
        reported: item.reported || "",
        status: (item.status as any) || "open",
        validationWarnings: item.validationWarnings || []
      };
    });
    return computeDashboardMetrics(formattedRows, agingRecords);
  })();

  const matchRateVal = items.length > 0
    ? (items.filter(item => {
        const erpQty = item.erpQty !== undefined ? item.erpQty : 0;
        const physicalQty = item.physicalQty !== undefined ? item.physicalQty : 0;
        return erpQty === physicalQty;
      }).length / items.length) * 100
    : 100;

  const totalPdfPages = personnelList.length > 0 ? 5 : 4;

  // Render SVG elements for PDF templates
  const renderPdfHealthScoreGauge = (score: number) => {
    const r = 35;
    const circ = Math.PI * r;
    const strokeDashoffset = circ - (Math.min(100, Math.max(0, score)) / 100) * circ;
    let strokeColor = "#ef4444";
    if (score >= 95) strokeColor = "#10b981";
    else if (score >= 85) strokeColor = "#6366f1";
    else if (score >= 70) strokeColor = "#f59e0b";

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", backgroundColor: "#f8fafc" }}>
        <div style={{ position: "relative", width: "100px", height: "55px", display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" }}>
          <svg style={{ width: "100px", height: "100px", position: "absolute", bottom: "-45px" }} viewBox="0 0 100 100">
            <path d="M 15 65 A 35 35 0 0 1 85 65" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
            <path d="M 15 65 A 35 35 0 0 1 85 65" fill="none" stroke={strokeColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={strokeDashoffset} />
          </svg>
          <span style={{ fontSize: "18px", fontWeight: "bold", color: "#1e293b", zIndex: 10 }}>{score}</span>
        </div>
        <span style={{ fontSize: "8px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b", marginTop: "4px" }}>Inventory Health Index</span>
      </div>
    );
  };

  const renderPdfAccuracyDonut = (matchRate: number) => {
    const radius = 22;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (matchRate / 100) * circ;

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", backgroundColor: "#f8fafc" }}>
        <div style={{ position: "relative", width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg style={{ width: "60px", height: "60px", transform: "rotate(-90deg)" }}>
            <circle cx="30" cy="30" r={radius} stroke="#e2e8f0" strokeWidth="4.5" fill="transparent" />
            <circle cx="30" cy="30" r={radius} stroke="#6366f1" strokeWidth="4.5" fill="transparent" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <span style={{ position: "absolute", fontSize: "11px", fontWeight: "bold", color: "#1e293b" }}>{matchRate.toFixed(1)}%</span>
        </div>
        <span style={{ fontSize: "8px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b", marginTop: "4px" }}>Accuracy Match Rate</span>
      </div>
    );
  };



  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/reports/${id}/dashboard`}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
            {report?.quarter} {report?.year} Cycle
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Report Builder: {report?.title}
          </h1>
        </div>
      </div>

      {/* Progress Steps Component */}
      <div className="grid grid-cols-5 gap-2 sm:gap-4 max-w-3xl mx-auto border-b border-slate-800 pb-4 w-full">
        {[
          { number: 1, label: "Upload Excel", path: "upload" },
          { number: 2, label: "Validate Data", path: "validate" },
          { number: 3, label: "Dashboard", path: "dashboard" },
          { number: 4, label: "Pre-Report", path: "pre-report" },
          { number: 5, label: "Report PDF", path: "builder" }
        ].map((step) => {
          const isCurrent = step.number === 5;
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

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-400 animate-in shake duration-300">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4 text-xs text-indigo-300 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p>{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Side: Summary & Options */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Section: PDF Composition */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-6 space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Document Export Package
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/80 border border-slate-900 text-xs">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-4 w-4 text-indigo-400" />
                  <div>
                    <p className="font-semibold text-slate-200">Cover Page & Metadata</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Title, Location: {report?.location || "Not configured"}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Included (Page 1)</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/80 border border-slate-900 text-xs">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-4 w-4 text-indigo-400" />
                  <div>
                    <p className="font-semibold text-slate-200">Executive Summary & Audit Opinion</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Financial KPIs, Health & Accuracy Rings, Auditor Verdict</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Included (Page 2)</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/80 border border-slate-900 text-xs">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-4 w-4 text-indigo-400" />
                  <div>
                    <p className="font-semibold text-slate-200">Operational Divisions Breakdown</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Variance breakdown and reconciliation statistics by business division</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Included (Page 3)</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/80 border border-slate-900 text-xs">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-4 w-4 text-indigo-400" />
                  <div>
                    <p className="font-semibold text-slate-200">Top 10 High-Risk Items & Sign-Offs</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Variance values ledger sheet and auditor sign-off lines</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Included (Page 4)</span>
              </div>

              {personnelList.length > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-xs animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-4 w-4 text-indigo-400" />
                    <div>
                      <p className="font-semibold text-indigo-300">Evidence & On-Site Personnel Ledger</p>
                      <p className="text-[10px] text-indigo-400/80 mt-0.5">{personnelList.length} field workers listed with details & remarks</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase">Appended (Page 5)</span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Signature Audit Blocks */}
          <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Signature className="h-4 w-4 text-indigo-400" />
              Signature Audit Blocks
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              These signatories will receive physical sign-off lines on the generated PDF document.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="rounded-lg bg-slate-950/50 p-4 border border-slate-900 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Prepared By</span>
                <p className="mt-1 text-xs font-semibold text-slate-250">{report?.preparedBy || "Not Configured"}</p>
              </div>

              <div className="rounded-lg bg-slate-950/50 p-4 border border-slate-900 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Checked By</span>
                <p className="mt-1 text-xs font-semibold text-slate-250">{report?.checkedBy || "Not Configured"}</p>
              </div>

              <div className="rounded-lg bg-slate-950/50 p-4 border border-slate-900 text-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Approved By</span>
                <p className="mt-1 text-xs font-semibold text-slate-250">{report?.approvedBy || "Not Configured"}</p>
              </div>
            </div>
          </div>

          {/* Section: Evidence & Personnel Form */}
          <EvidencePersonnel
            personnelList={personnelList}
            setPersonnelList={setPersonnelList}
          />

        </div>

        {/* Right Side: Actions Card */}
        <div>
          <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/50 p-6 space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest">
              <Award className="h-4 w-4 text-indigo-400" />
              <span>Publish Cycle</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Compile the physical verification package. Marking this cycle as closed will archive records and restrict further file updates.
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleGeneratePdf}
                disabled={isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-750 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-indigo-500/10"
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    Compiling PDF...
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    Generate PDF Package
                  </>
                )}
              </button>

              <button
                onClick={handleCloseAudit}
                disabled={isClosing}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800/80 disabled:bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {isClosing ? (
                  "Closing Audit..."
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Complete & Close Audit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden PDF Template Container for Export */}
      {report && (
        <div
          id="pdf-report-template"
          style={{
            display: "none",
            width: "794px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            backgroundColor: "#ffffff",
            color: "#0f172a",
          }}
        >
          {/* PAGE 1: COVER PAGE */}
          <div
            style={{
              width: "794px",
              height: "1123px",
              padding: "70px 80px 70px 80px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "#ffffff",
              position: "relative",
              border: "1px solid #e2e8f0"
            }}
          >
            {/* Top Bar Accent */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", backgroundColor: "#6366f1" }}></div>

            {/* Header Logos / Brand */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#ffffff", fontWeight: "bold", fontSize: "14px" }}>I</span>
                </div>
                <span style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "1px", color: "#475569" }}>INVENTORY PORTAL</span>
              </div>
              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#94a3b8" }}>OFFICIAL AUDIT REPORT</span>
            </div>

            {/* Title Area */}
            <div style={{ marginTop: "100px", marginBottom: "60px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#6366f1", textTransform: "uppercase", letterSpacing: "2px" }}>
                {report.quarter || "Q4"} {report.year || new Date().getFullYear()} RECONCILIATION CYCLE
              </span>
              <h1 style={{ fontSize: "36px", fontWeight: 850, lineHeight: 1.2, color: "#0f172a", marginTop: "15px", marginBottom: "25px" }}>
                {report.title || "Quarterly Inventory Reconciliation"}
              </h1>
              <div style={{ width: "60px", height: "4px", backgroundColor: "#6366f1" }}></div>
            </div>

            {/* Audit Information Table */}
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", marginBottom: "15px" }}>
                Audit Location & Metadata
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", borderTop: "1px solid #f1f5f9", paddingTop: "20px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#94a3b8", display: "block" }}>FACILITY LOCATION</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#334155", marginTop: "4px", display: "block" }}>{report.location || "Not available"}</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#94a3b8", display: "block" }}>WAREHOUSE NAME</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#334155", marginTop: "4px", display: "block" }}>{report.warehouseName || "Not available"}</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#94a3b8", display: "block" }}>COMPILATION DATE</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#334155", marginTop: "4px", display: "block" }}>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#94a3b8", display: "block" }}>CYCLE STATUS</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#6366f1", marginTop: "4px", display: "block", textTransform: "uppercase" }}>{report.status || "Not available"}</span>
                </div>
              </div>
            </div>

            {/* Cover Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>CONFIDENTIAL — INVENTORY SYSTEM</span>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>Page 1 of {totalPdfPages}</span>
            </div>
          </div>

          {/* PAGE 2: EXECUTIVE SUMMARY & AUDIT OPINIONS */}
          <div
            style={{
              width: "794px",
              height: "1123px",
              padding: "70px 80px 70px 80px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "#ffffff",
              position: "relative",
              border: "1px solid #e2e8f0"
            }}
          >
            {/* Top Accent */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", backgroundColor: "#6366f1" }}></div>

            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "15px" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b" }}>INVENTORY RECONCILIATION REPORT</span>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{report.quarter} {report.year} Cycle</span>
              </div>

              {/* Title */}
              <div style={{ marginTop: "30px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a" }}>1. Executive Summary & KPIs</h2>
                <p style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                  Physical counts asset values summary, coverage statistics, and compliance indices.
                </p>
              </div>

              {/* KPI Cards Grid (3x2 layout for better space utilization) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "20px" }}>
                
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", backgroundColor: "#f8fafc" }}>
                  <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Total Inventory Value</span>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#0f172a", display: "block", marginTop: "4px" }}>
                    SAR {metrics.totalInventoryValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", backgroundColor: "#f8fafc" }}>
                  <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Verified Asset Value</span>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#10b981", display: "block", marginTop: "4px" }}>
                    SAR {metrics.verifiedValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", backgroundColor: "#f8fafc" }}>
                  <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Total Financial Risk</span>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#ef4444", display: "block", marginTop: "4px" }}>
                    SAR {metrics.totalFinancialRisk.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", backgroundColor: "#f8fafc" }}>
                  <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Total Count Lines</span>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#334155", display: "block", marginTop: "4px" }}>
                    {metrics.totalLines.toLocaleString()} Lines
                  </span>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", backgroundColor: "#f8fafc" }}>
                  <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Total Quantity Verified</span>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#334155", display: "block", marginTop: "4px" }}>
                    {metrics.verifiedQuantity.toLocaleString()} Units
                  </span>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", backgroundColor: "#f8fafc" }}>
                  <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Accuracy Match Rate</span>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#7c3aed", display: "block", marginTop: "4px" }}>
                    {matchRateVal.toFixed(1)}%
                  </span>
                </div>

              </div>

              {/* Net Variance & Gauges Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "15px", marginTop: "20px" }}>
                {/* Net Variance */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "15px", backgroundColor: "#f1f5f9", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span style={{ fontSize: "9px", color: "#475569", fontWeight: "bold", textTransform: "uppercase" }}>Net Reconciliation Variance</span>
                  <span style={{ fontSize: "18px", fontWeight: "bold", color: metrics.varianceValue < 0 ? "#ef4444" : "#10b981", marginTop: "5px" }}>
                    {metrics.varianceValue < 0 ? "-" : metrics.varianceValue > 0 ? "+" : ""}SAR {Math.abs(metrics.varianceValue).toLocaleString()}
                  </span>
                  <span style={{ fontSize: "8px", color: "#64748b", marginTop: "4px" }}>
                    Total Shortages: SAR {metrics.totalShortageValue.toLocaleString()} | Excesses: SAR {metrics.totalExcessValue.toLocaleString()}
                  </span>
                </div>

                {renderPdfHealthScoreGauge(metrics.inventoryHealthScore)}
                {renderPdfAccuracyDonut(matchRateVal)}
              </div>

              {/* External Audit Opinion Card */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "15px", marginTop: "20px", backgroundColor: "#fdfdfd" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#6366f1/10", color: "#6366f1", fontWeight: "bold" }}>AUDIT COMPLIANCE</span>
                  <h4 style={{ fontSize: "11px", fontWeight: "bold", color: "#1e293b", margin: 0 }}>Framework Audit Conclusion Verdict</h4>
                </div>
                <p style={{ fontSize: "11px", color: "#475569", lineHeight: 1.5, marginTop: "8px" }}>
                  Based on count verification parameters, the inventory physical counts yield a status of: <strong>{metrics.auditConclusion}</strong>. 
                  Auditing sample reached <strong>{metrics.sampleCount}</strong> items with a verified coverage rate of <strong>{metrics.auditCoverageRate}%</strong>. 
                  The overall score of <strong>{metrics.inventoryHealthScore}</strong> signifies a <strong>{metrics.inventoryHealthStatus}</strong> grade.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>CONFIDENTIAL — INVENTORY SYSTEM</span>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>Page 2 of {totalPdfPages}</span>
            </div>
          </div>

          {/* PAGE 3: OPERATIONS BREAKDOWN */}
          <div
            style={{
              width: "794px",
              height: "1123px",
              padding: "70px 80px 70px 80px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "#ffffff",
              position: "relative",
              border: "1px solid #e2e8f0"
            }}
          >
            {/* Top Accent */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", backgroundColor: "#6366f1" }}></div>

            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "15px" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b" }}>INVENTORY RECONCILIATION REPORT</span>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{report.quarter} {report.year} Cycle</span>
              </div>

              {/* Title */}
              <div style={{ marginTop: "30px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a" }}>2. Operational Divisions Breakdown</h2>
                <p style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                  Variance breakdown and reconciliation statistics by business division.
                </p>
              </div>

              {/* Division Breakdown Table */}
              <div style={{ marginTop: "20px" }}>
                <h3 style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#475569", marginBottom: "8px" }}>Division Reconciliation Statistics</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#475569", fontWeight: "bold" }}>
                      <th style={{ padding: "6px", textAlign: "left" }}>DIVISION</th>
                      <th style={{ padding: "6px", textAlign: "center" }}>ITEMS</th>
                      <th style={{ padding: "6px", textAlign: "right" }}>ERP VALUE (SAR)</th>
                      <th style={{ padding: "6px", textAlign: "right" }}>VERIFIED VALUE (SAR)</th>
                      <th style={{ padding: "6px", textAlign: "right" }}>COVERAGE RATE</th>
                      <th style={{ padding: "6px", textAlign: "right" }}>NET VARIANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.divisions.map((div, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px", fontWeight: "bold" }}>{div.division}</td>
                        <td style={{ padding: "6px", textAlign: "center" }}>{div.itemCount}</td>
                        <td style={{ padding: "6px", textAlign: "right" }}>{div.erpValue.toLocaleString()}</td>
                        <td style={{ padding: "6px", textAlign: "right" }}>{div.verifiedValue.toLocaleString()}</td>
                        <td style={{ padding: "6px", textAlign: "right", fontWeight: "bold", color: div.coverageRate >= 95 ? "#10b981" : "#f59e0b" }}>{div.coverageRate}%</td>
                        <td style={{ padding: "6px", textAlign: "right", fontWeight: "bold", color: div.varianceValue < 0 ? "#ef4444" : "#10b981" }}>
                          {div.varianceValue < 0 ? "-" : div.varianceValue > 0 ? "+" : ""}SAR {Math.abs(div.varianceValue).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>CONFIDENTIAL — INVENTORY SYSTEM</span>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>Page 3 of {totalPdfPages}</span>
            </div>
          </div>

          {/* PAGE 4: DISCREPANCIES TABLE & SIGNATURES */}
          <div
            style={{
              width: "794px",
              height: "1123px",
              padding: "70px 80px 70px 80px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "#ffffff",
              position: "relative",
              border: "1px solid #e2e8f0"
            }}
          >
            {/* Top Accent */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", backgroundColor: "#6366f1" }}></div>

            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "15px" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b" }}>INVENTORY RECONCILIATION REPORT</span>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{report.quarter} {report.year} Cycle</span>
              </div>

              {/* Discrepancies Section */}
              <div style={{ marginTop: "30px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a" }}>3. Highest Risk Discrepancies Ledger</h2>
                <p style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                  Inventory items sorted by absolute variance value, requiring immediate operational audit.
                </p>
              </div>

              {/* Table */}
              <div style={{ marginTop: "20px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#475569", fontWeight: "bold" }}>
                      <th style={{ padding: "6px" }}>ITEM CODE</th>
                      <th style={{ padding: "6px" }}>DESCRIPTION</th>
                      <th style={{ padding: "6px" }}>SUPPLIER</th>
                      <th style={{ padding: "6px", textAlign: "right" }}>ERP QTY</th>
                      <th style={{ padding: "6px", textAlign: "right" }}>PHYS QTY</th>
                      <th style={{ padding: "6px", textAlign: "right" }}>DIFF</th>
                      <th style={{ padding: "6px", textAlign: "right" }}>VARIANCE VALUE</th>
                    </tr>
                  </thead>
                  <tbody style={{ color: "#334155" }}>
                    {metrics.highestRiskItems.length > 0 ? (
                      metrics.highestRiskItems
                        .slice(0, 10)
                        .map((item, idx) => {
                          const supplier = item.supplierName || item.detectedSupplierName || "Others";
                          return (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "6px", fontWeight: "bold", fontFamily: "monospace" }}>{item.itemCode || "N/A"}</td>
                              <td style={{ padding: "6px", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description || "N/A"}</td>
                              <td style={{ padding: "6px" }}>{supplier}</td>
                              <td style={{ padding: "6px", textAlign: "right", fontFamily: "monospace" }}>{(item.systemOnHand ?? 0).toLocaleString()}</td>
                              <td style={{ padding: "6px", textAlign: "right", fontFamily: "monospace" }}>{(item.physicalCount ?? 0).toLocaleString()}</td>
                              <td style={{ padding: "6px", textAlign: "right", fontFamily: "monospace", color: item.differenceQty < 0 ? "#ef4444" : "#10b981", fontWeight: "bold" }}>
                                {item.differenceQty > 0 ? "+" : ""}{item.differenceQty.toLocaleString()}
                              </td>
                              <td style={{ padding: "6px", textAlign: "right", fontFamily: "monospace", color: item.varianceValue < 0 ? "#ef4444" : "#10b981", fontWeight: "bold" }}>
                                {item.varianceValue < 0 ? "-" : item.varianceValue > 0 ? "+" : ""}SAR {Math.abs(item.varianceValue).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                          No discrepancy records available for this report period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures block */}
              <div style={{ marginTop: "50px" }}>
                <h3 style={{ fontSize: "11px", fontWeight: "bold", color: "#0f172a", borderBottom: "1px solid #cbd5e1", paddingBottom: "6px", textTransform: "uppercase" }}>
                  Reconciliation Sign-Off Signatories
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginTop: "20px" }}>
                  
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", backgroundColor: "#f8fafc" }}>
                    <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase", display: "block" }}>PREPARED BY</span>
                    <span style={{ fontSize: "10px", fontWeight: "bold", color: "#334155", display: "block", marginTop: "4px" }}>
                      {report.preparedBy || "Not available"}
                    </span>
                    <div style={{ borderBottom: "1px dashed #94a3b8", height: "35px", marginTop: "12px" }}></div>
                    <span style={{ fontSize: "7.5px", color: "#94a3b8", display: "block", marginTop: "4px" }}>Signature & Date</span>
                  </div>

                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", backgroundColor: "#f8fafc" }}>
                    <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase", display: "block" }}>CHECKED BY</span>
                    <span style={{ fontSize: "10px", fontWeight: "bold", color: "#334155", display: "block", marginTop: "4px" }}>
                      {report.checkedBy || "Not available"}
                    </span>
                    <div style={{ borderBottom: "1px dashed #94a3b8", height: "35px", marginTop: "12px" }}></div>
                    <span style={{ fontSize: "7.5px", color: "#94a3b8", display: "block", marginTop: "4px" }}>Signature & Date</span>
                  </div>

                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", backgroundColor: "#f8fafc" }}>
                    <span style={{ fontSize: "8px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase", display: "block" }}>APPROVED BY</span>
                    <span style={{ fontSize: "10px", fontWeight: "bold", color: "#334155", display: "block", marginTop: "4px" }}>
                      {report.approvedBy || "Not available"}
                    </span>
                    <div style={{ borderBottom: "1px dashed #94a3b8", height: "35px", marginTop: "12px" }}></div>
                    <span style={{ fontSize: "7.5px", color: "#94a3b8", display: "block", marginTop: "4px" }}>Signature & Date</span>
                  </div>

                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>CONFIDENTIAL — INVENTORY SYSTEM</span>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>Page 4 of {totalPdfPages}</span>
            </div>
          </div>

          {/* PAGE 5: EVIDENCE & ON-SITE PERSONNEL LEDGER (Rendered conditionally) */}
          {personnelList.length > 0 && (
            <div
              style={{
                width: "794px",
                height: "1123px",
                padding: "70px 80px 70px 80px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                backgroundColor: "#ffffff",
                position: "relative",
                border: "1px solid #e2e8f0"
              }}
            >
              {/* Top Accent */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", backgroundColor: "#6366f1" }}></div>

              <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "15px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b" }}>INVENTORY RECONCILIATION REPORT</span>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>{report.quarter} {report.year} Cycle</span>
                </div>

                {/* Title */}
                <div style={{ marginTop: "30px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a" }}>4. On-Site Audit Workers & Visual Evidence</h2>
                  <p style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                    Registered evidence catalog and on-site audit team execution details.
                  </p>
                </div>

                {/* Personnel Cards Grid in PDF */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "25px" }}>
                  {personnelList.slice(0, 4).map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "12px",
                        backgroundColor: "#fcfcfd",
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start"
                      }}
                    >
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          alt={p.name}
                          style={{
                            width: "55px",
                            height: "55px",
                            borderRadius: "6px",
                            objectFit: "cover",
                            border: "1px solid #cbd5e1"
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "55px",
                            height: "55px",
                            borderRadius: "6px",
                            backgroundColor: "#e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <span style={{ fontSize: "8px", fontWeight: "bold", color: "#64748b" }}>NO IMG</span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#0f172a", display: "block" }}>{p.name}</span>
                        <span style={{ fontSize: "8.5px", color: "#6366f1", fontWeight: "bold", display: "block", textTransform: "uppercase" }}>{p.role}</span>
                        <span style={{ fontSize: "8px", color: "#94a3b8", display: "block", marginTop: "2px" }}>Dept: {p.department || "General"}</span>
                        {p.remarks && (
                          <p style={{ fontSize: "8.5px", color: "#475569", fontStyle: "italic", margin: "4px 0 0 0", borderTop: "1px solid #f1f5f9", paddingTop: "3px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            &ldquo;{p.remarks}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {personnelList.length > 4 && (
                  <p style={{ fontSize: "9px", color: "#94a3b8", marginTop: "12px", fontStyle: "italic" }}>
                    * Additional {personnelList.length - 4} personnel records omitted from cover summary. See validation screen ledger for complete catalog.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>CONFIDENTIAL — INVENTORY SYSTEM</span>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>Page 5 of 5</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
