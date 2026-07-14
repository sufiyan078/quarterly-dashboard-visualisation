"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReportId } from "@/lib/useReportId";
import { db, doc, getDoc, updateDoc, setDoc, collection, getDocs } from "@/lib/firebase";
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
import { buildReportNarrative, PreReportMetrics } from "@/lib/report/insightEngine";
import {
  ReportSection, CoverPageData, EditableContent, UploadedImage, ApprovalState,
  DEFAULT_COVER, DEFAULT_CONTENT, mergeWithDefaultSections
} from "@/types/preReport";
import { ExecutiveReportDocument } from "@/components/pre-report/ExecutiveReportDocument";
import { C, TYPOGRAPHY, LAYOUT } from "@/lib/report/designTokens";

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
  preReportConfig?: {
    sections: ReportSection[];
    cover: CoverPageData;
    content: EditableContent;
    images: UploadedImage[];
    approval: ApprovalState;
  };
}

export default function ReportBuilder() {
  const router = useRouter();
  const id = useReportId();

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
    if (!id || id === "placeholder") return;
    const fetchReportAndItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const docRef = doc(db, "reports", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const reportData = docSnap.data() as Report;
          setReport(reportData);

          // Update highest step reached on database if it's less than 4
          const currentHighest = getHighestStep(reportData);
          if (currentHighest < 4) {
            await setDoc(docRef, {
              highestStepReached: 4,
              updatedAt: new Date()
            }, { merge: true });
          }

          // Fetch inventoryItems and agingData concurrently for faster loading
          const itemsCol = collection(db, "reports", id, "inventoryItems");
          const agingCol = collection(db, "reports", id, "agingData");
          const [querySnap, agingSnap] = await Promise.all([
            getDocs(itemsCol),
            getDocs(agingCol)
          ]);

          // Process inventory items
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

          // Process aging data records
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
    if (isGenerating) return;
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
      await setDoc(docRef, {
        status: "closed",
        updatedAt: new Date(),
      }, { merge: true });
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

  // Format raw items once; reused by metrics and the narrative engine
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

  // Run dynamic metrics calculation
  const metrics = computeDashboardMetrics(formattedRows, agingRecords);

  const matchedItemsCount = items.filter(item => {
    const erpQty = item.erpQty !== undefined ? item.erpQty : 0;
    const physicalQty = item.physicalQty !== undefined ? item.physicalQty : 0;
    return erpQty === physicalQty;
  }).length;

  const matchRateVal = items.length > 0 ? (matchedItemsCount / items.length) * 100 : 100;

  // Extended metrics shape shared with the pre-report preview
  const extendedMetrics: PreReportMetrics = {
    ...metrics,
    totalItems: metrics.totalLines,
    matchRate: matchRateVal,
    matchedItems: matchedItemsCount,
    mismatchedItems: items.length - matchedItemsCount,
    totalRiskValue: metrics.totalFinancialRisk,
    healthScore: metrics.inventoryHealthScore,
    netVariance: metrics.varianceValue,
  };

  // Resolve the pre-report configuration saved at step 4 (with fallbacks
  // for reports that never visited the pre-report stage).
  const preConfig = report?.preReportConfig;
  const pdfSections = mergeWithDefaultSections(preConfig?.sections);
  const pdfCover: CoverPageData = preConfig?.cover ?? {
    ...DEFAULT_COVER,
    reportTitle: report?.title || "Inventory Report",
    clientName: report?.warehouseName || report?.location || "",
    reportingPeriod: `${report?.quarter || ""} ${report?.year || ""}`.trim(),
    preparedBy: report?.preparedBy || "",
    checkedBy: report?.checkedBy || "",
    approvedBy: report?.approvedBy || "",
  };
  const pdfContent: EditableContent = preConfig?.content ?? DEFAULT_CONTENT;
  const pdfImages: UploadedImage[] = preConfig?.images ?? [];

  // Generated narrative (insights, risks, recommendations) — presentation only
  const narrative = buildReportNarrative({
    quarter: report?.quarter || "",
    year: report?.year || "",
    clientName: pdfCover.clientName || "",
    location: report?.location || "",
    metrics: extendedMetrics,
    rows: formattedRows,
  });

  const enabledSectionCount = pdfSections.filter(s => s.enabled).length;
  const totalPdfPages = enabledSectionCount + (personnelList.length > 0 ? 1 : 0);




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
                    <p className="font-semibold text-slate-200">Executive Narrative Report</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {enabledSectionCount} sections configured in the Pre-Report stage — cover, executive summary, financial and organizational analysis, risks, opportunities, recommendations, and conclusion
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Pages 1–{enabledSectionCount}</span>
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
                  <span className="text-[10px] font-bold text-indigo-400 uppercase">Appended (Page {totalPdfPages})</span>
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
          {/* Executive narrative report pages (shared with Pre-Report preview) */}
          <ExecutiveReportDocument
            sections={pdfSections}
            cover={pdfCover}
            content={pdfContent}
            images={pdfImages}
            metrics={extendedMetrics}
            narrative={narrative}
            reportMeta={{ quarter: report.quarter, year: report.year, location: report.location }}
            totalPagesOverride={totalPdfPages}
          />

          {/* PAGE 5: EVIDENCE & ON-SITE PERSONNEL LEDGER (Rendered conditionally) */}
          {personnelList.length > 0 && (
            <div
              style={{
                width: LAYOUT.width,
                height: LAYOUT.height,
                padding: `${LAYOUT.padding.top} ${LAYOUT.padding.right} ${LAYOUT.padding.bottom} ${LAYOUT.padding.left}`,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                backgroundColor: C.brand.white,
                position: "relative",
                border: `1px solid ${C.border}`,
                overflow: "hidden",
                fontFamily: TYPOGRAPHY.fontFamily,
              }}
            >
              {/* Top Gold Accent Bar */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", backgroundColor: C.brand.accent }} />

              {/* Bottom Navy Accent Bar */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", backgroundColor: C.brand.primary }} />

              <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, paddingBottom: "10px" }}>
                  <span style={{ fontSize: TYPOGRAPHY.sizes.label, fontWeight: TYPOGRAPHY.weights.bold, letterSpacing: "0.12em", textTransform: "uppercase", color: C.brand.primary }}>
                    GAS ARABIAN SERVICES — INVENTORY RECONCILIATION
                  </span>
                  <span style={{ fontSize: TYPOGRAPHY.sizes.label, fontWeight: TYPOGRAPHY.weights.bold, letterSpacing: "0.12em", textTransform: "uppercase", color: C.brand.accent }}>
                    {report.quarter} {report.year} Cycle
                  </span>
                </div>

                {/* Title */}
                <div style={{ marginTop: "20px", marginBottom: "14px" }}>
                  <span style={{ fontSize: TYPOGRAPHY.sizes.label, fontWeight: TYPOGRAPHY.weights.bold, letterSpacing: "0.12em", textTransform: "uppercase", color: C.brand.accent }}>
                    PAGE {String(totalPdfPages).padStart(2, "0")} — SECTION DETAIL
                  </span>
                  <h2 style={{
                    fontSize: TYPOGRAPHY.sizes.sectionTitle,
                    fontWeight: TYPOGRAPHY.weights.bold,
                    color: C.brand.primary,
                    letterSpacing: "-0.02em",
                    margin: "4px 0 0",
                    display: "inline-block",
                  }}>
                    Appendix — On-Site Audit Workers &amp; Evidence
                  </h2>
                  <div style={{ height: "2px", width: "40px", backgroundColor: C.brand.accent, marginTop: "4px" }} />
                  <p style={{ fontSize: "10.5px", color: C.text.muted, fontStyle: "italic", margin: "5px 0 0" }}>
                    Registered evidence catalog and on-site audit team execution details.
                  </p>
                </div>

                {/* Personnel Cards Grid in PDF */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "20px" }}>
                  {personnelList.slice(0, 4).map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: "6px",
                        padding: "12px",
                        backgroundColor: C.panel,
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
                      }}
                    >
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          alt={p.name}
                          style={{
                            width: "55px",
                            height: "55px",
                            borderRadius: "4px",
                            objectFit: "cover",
                            border: `1px solid ${C.border}`
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "55px",
                            height: "55px",
                            borderRadius: "4px",
                            backgroundColor: C.border,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <span style={{ fontSize: "8px", fontWeight: "bold", color: C.text.muted }}>NO IMG</span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "11px", fontWeight: TYPOGRAPHY.weights.bold, color: C.text.primary, display: "block" }}>{p.name}</span>
                        <span style={{ fontSize: "8.5px", color: C.brand.accent, fontWeight: TYPOGRAPHY.weights.extrabold, display: "block", textTransform: "uppercase", letterSpacing: "0.08em" }}>{p.role}</span>
                        <span style={{ fontSize: "8.5px", color: C.text.muted, display: "block", marginTop: "2px" }}>Dept: {p.department || "General"}</span>
                        {p.remarks && (
                          <p style={{ fontSize: "8.5px", color: C.text.primary, fontStyle: "italic", margin: "4px 0 0 0", borderTop: `1px solid ${C.borderSoft}`, paddingTop: "3px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            &ldquo;{p.remarks}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {personnelList.length > 4 && (
                  <p style={{ fontSize: "9px", color: C.text.muted, marginTop: "12px", fontStyle: "italic" }}>
                    * Additional {personnelList.length - 4} personnel records omitted from cover summary. See validation screen ledger for complete catalog.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: "10px", marginTop: "12px" }}>
                <span style={{ fontSize: TYPOGRAPHY.sizes.label, fontWeight: TYPOGRAPHY.weights.bold, letterSpacing: "0.12em", textTransform: "uppercase", color: C.text.muted }}>
                  CONFIDENTIAL — INTERNAL MANAGEMENT USE ONLY
                </span>
                <span style={{ fontSize: TYPOGRAPHY.sizes.label, fontWeight: TYPOGRAPHY.weights.bold, letterSpacing: "0.12em", textTransform: "uppercase", color: C.brand.primary }}>
                  Page {totalPdfPages} of {totalPdfPages}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
