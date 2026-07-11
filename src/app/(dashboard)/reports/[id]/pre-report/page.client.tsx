"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { db, doc, getDoc, updateDoc, collection, getDocs } from "@/lib/firebase";
import { getHighestStep } from "@/lib/workflow";
import {
  ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2,
  Calendar, Eye, ZoomIn, ZoomOut, Save, Sparkles, Building
} from "lucide-react";
import { computeDashboardMetrics } from "@/lib/inventory/dashboardCalculations";
import {
  ReportSection, CoverPageData, EditableContent, UploadedImage, ApprovalState,
  DEFAULT_SECTIONS, DEFAULT_COVER, DEFAULT_CONTENT, DEFAULT_APPROVAL
} from "@/types/preReport";
import { SectionManager } from "@/components/pre-report/SectionManager";
import { CoverPageEditor } from "@/components/pre-report/CoverPageEditor";
import { ContentEditor } from "@/components/pre-report/ContentEditor";
import { ImageManager } from "@/components/pre-report/ImageManager";
import { ApprovalGatedChecklist } from "@/components/pre-report/ApprovalGatedChecklist";

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
  preReportConfig?: {
    sections: ReportSection[];
    cover: CoverPageData;
    content: EditableContent;
    images: UploadedImage[];
    approval: ApprovalState;
  };
}

export default function PreReportPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  // Data State
  const [report, setReport] = useState<Report | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [agingRecords, setAgingRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active custom tab in Left Panel
  const [activeTab, setActiveTab] = useState<'sections' | 'cover' | 'content' | 'images' | 'approve'>('sections');

  // Preview zoom level
  const [zoom, setZoom] = useState<number>(0.75);

  // Configuration States
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [cover, setCover] = useState<CoverPageData>(DEFAULT_COVER);
  const [content, setContent] = useState<EditableContent>(DEFAULT_CONTENT);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [approval, setApproval] = useState<ApprovalState>(DEFAULT_APPROVAL);

  useEffect(() => {
    const fetchReportAndData = async () => {
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

          // Initialize configs if stored in Firestore
          if (reportData.preReportConfig) {
            const config = reportData.preReportConfig;
            if (config.sections) setSections(config.sections);
            if (config.cover) setCover(config.cover);
            if (config.content) setContent(config.content);
            if (config.images) setImages(config.images);
            if (config.approval) setApproval(config.approval);
          } else {
            // Prefill cover values from report base data
            setCover({
              ...DEFAULT_COVER,
              reportTitle: reportData.title || `Q${reportData.quarter} Inventory Report`,
              clientName: reportData.warehouseName || reportData.location || "Default Client",
              reportingPeriod: `${reportData.quarter} ${reportData.year}`,
              preparedBy: reportData.preparedBy || "",
              checkedBy: reportData.checkedBy || "",
              approvedBy: reportData.approvedBy || "",
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
                  erpQty: item.systemOnHand !== undefined ? item.systemOnHand : (item.erpQty || 0),
                  physicalQty: item.physicalCount !== undefined ? item.physicalCount : (item.physicalQty || 0),
                });
              });
            } else {
              loadedItems.push({
                id: docSnap.id,
                ...data,
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
        setError("Could not retrieve report data.");
      } finally {
        setLoading(false);
      }
    };

    fetchReportAndData();
  }, [id]);

  // Run dynamic metrics calculation
  const metrics = useMemo(() => {
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
        status: item.status || "open",
        validationWarnings: item.validationWarnings || []
      };
    });
    const baseMetrics = computeDashboardMetrics(formattedRows, agingRecords);

    const matchedItems = formattedRows.filter(item => item.erpQty === item.physicalQty).length;
    const mismatchedItems = formattedRows.length - matchedItems;
    const matchRate = formattedRows.length > 0 ? (matchedItems / formattedRows.length) * 100 : 100;

    return {
      ...baseMetrics,
      totalItems: baseMetrics.totalLines,
      matchRate,
      matchedItems,
      mismatchedItems,
      totalRiskValue: baseMetrics.totalFinancialRisk,
      healthScore: baseMetrics.inventoryHealthScore,
      netVariance: baseMetrics.varianceValue
    };
  }, [items, agingRecords]);

  // Auto-fill executive summary when metrics load if it's empty
  useEffect(() => {
    if (metrics && !content.executiveSummary) {
      setContent(prev => ({
        ...prev,
        executiveSummary: `During the ${report?.quarter || ""} ${report?.year || ""} inventory verification audit, a total of ${metrics.totalItems.toLocaleString()} items were verified. The physical count accuracy stands at ${metrics.matchRate.toFixed(1)}%, representing ${metrics.matchedItems.toLocaleString()} matching items and ${metrics.mismatchedItems.toLocaleString()} discrepancies. The cumulative financial variance computed absolute value is SAR ${metrics.totalRiskValue.toLocaleString()}, requiring operational correction.`,
        recommendations: "1. Perform a reconciliation review of high-risk items identified in Section 3.\n2. Strengthen verification checks for suppliers with >10% variance.\n3. Establish weekly physical recounts in high-variance divisions.",
        observations: "Discrepancy rates are concentrated within specific warehouse divisions. ERP system records were outdated for select high-value items, contributing to higher variances.",
        auditorRemarks: "Data verification is complete with standard tolerances. The results present a true and fair view of physical stock levels at the time of the audit."
      }));
    }
  }, [metrics, report]);

  const handleSave = async (showNotification = true) => {
    setSaving(true);
    setError(null);
    if (showNotification) setSuccessMsg(null);

    try {
      const docRef = doc(db, "reports", id);
      await updateDoc(docRef, {
        preReportConfig: {
          sections,
          cover,
          content,
          images,
          approval
        },
        updatedAt: new Date()
      });
      if (showNotification) {
        setSuccessMsg("Pre-Report configuration saved successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error("Error saving pre-report config:", err);
      setError("Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveReport = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, "reports", id);
      await updateDoc(docRef, {
        preReportConfig: {
          sections,
          cover,
          content,
          images,
          approval: {
            ...approval,
            readyForExport: true
          }
        },
        // Promote highest step reached to 5 to unlock the final PDF builder stage
        highestStepReached: 5,
        updatedAt: new Date()
      });
      router.push(`/reports/${id}/builder`);
    } catch (err: any) {
      console.error("Error saving approval status:", err);
      setError("Failed to lock and approve pre-report config.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#090b11]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
        <span className="mt-4 text-sm text-slate-400">Loading Report Builder...</span>
      </div>
    );
  }

  // Sorted list of sections
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // SVG Gauges helper
  const renderPdfHealthScoreGauge = (score: number) => {
    const r = 35;
    const circ = Math.PI * r;
    const strokeDashoffset = circ - (Math.min(100, Math.max(0, score)) / 100) * circ;
    let strokeColor = "#ef4444";
    if (score >= 95) strokeColor = "#10b981";
    else if (score >= 85) strokeColor = "#6366f1";
    else if (score >= 70) strokeColor = "#f59e0b";

    return (
      <div className="flex flex-col items-center justify-center border border-slate-200 rounded-lg p-3 bg-slate-50 w-28">
        <div className="relative w-20 h-11 flex items-end justify-center overflow-hidden">
          <svg className="w-20 h-20 absolute -bottom-9" viewBox="0 0 100 100">
            <path d="M 15 65 A 35 35 0 0 1 85 65" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
            <path d="M 15 65 A 35 35 0 0 1 85 65" fill="none" stroke={strokeColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={strokeDashoffset} />
          </svg>
          <span className="text-[14px] font-bold text-slate-800 z-10">{score}</span>
        </div>
        <span className="text-[8px] font-bold uppercase text-slate-500 mt-1">Health Index</span>
      </div>
    );
  };

  const renderPdfAccuracyDonut = (matchRate: number) => {
    const radius = 22;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (matchRate / 100) * circ;

    return (
      <div className="flex flex-col items-center justify-center border border-slate-200 rounded-lg p-3 bg-slate-50 w-28">
        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="w-14 h-14 transform -rotate-90">
            <circle cx="28" cy="28" r={radius} stroke="#e2e8f0" strokeWidth="4.5" fill="transparent" />
            <circle cx="28" cy="28" r={radius} stroke="#6366f1" strokeWidth="4.5" fill="transparent" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <span className="absolute text-[9px] font-bold text-slate-800">{matchRate.toFixed(1)}%</span>
        </div>
        <span className="text-[8px] font-bold uppercase text-slate-500 mt-1">Accuracy Rate</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <h1 className="text-xl font-bold tracking-tight text-white mt-0.5">
              Pre-Report Builder & Preview
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/50 text-xs font-semibold text-slate-350 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Config"}
          </button>
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
          const isCurrent = step.number === 4;
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

      {successMsg && (
        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4 text-xs text-indigo-300 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Builder Controls (60% width on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Internal Navigation Tabs */}
          <div className="flex border-b border-slate-800/80 overflow-x-auto pb-px">
            {[
              { id: 'sections', label: 'Section Manager' },
              { id: 'cover', label: 'Cover Page' },
              { id: 'content', label: 'Report Content' },
              { id: 'images', label: 'Evidence & Images' },
              { id: 'approve', label: 'Sign-Off & Approve' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {activeTab === 'sections' && (
              <SectionManager
                sections={sections}
                onSectionsChange={setSections}
              />
            )}

            {activeTab === 'cover' && (
              <CoverPageEditor
                cover={cover}
                onCoverChange={setCover}
              />
            )}

            {activeTab === 'content' && (
              <ContentEditor
                content={content}
                onContentChange={setContent}
              />
            )}

            {activeTab === 'images' && (
              <ImageManager
                images={images}
                onImagesChange={setImages}
              />
            )}

            {activeTab === 'approve' && (
              <ApprovalGatedChecklist
                approval={approval}
                onApprovalChange={setApproval}
                onApproveReport={handleApproveReport}
                isSubmitting={saving}
              />
            )}
          </div>
        </div>

        {/* Right Side: Sticky Live Preview (40% width on desktop) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Report PDF Preview
              </h3>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.05))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] font-mono text-slate-400 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(prev => Math.min(1.2, prev + 0.05))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* Document Preview Box */}
          <div className="w-full flex justify-center bg-[#090b11] border border-slate-900 rounded-xl p-4 overflow-auto max-h-[85vh]">
            <div
              style={{
                width: `${794 * zoom}px`,
                height: `${(sortedSections.filter(s => s.enabled).length * 1123 + (sortedSections.filter(s => s.enabled).length - 1) * 24) * zoom}px`,
                position: "relative",
              }}
            >
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  width: "794px",
                  position: "absolute",
                  top: 0,
                  left: 0,
                }}
                className="flex flex-col gap-6"
              >
                {sortedSections
                  .filter(s => s.enabled)
                  .map((section, pageIndex, filteredArray) => {
                    return (
                      <div
                        key={section.id}
                        style={{
                          width: "794px",
                          height: "1123px",
                          padding: "70px 80px",
                          boxSizing: "border-box",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          backgroundColor: "#ffffff",
                          position: "relative",
                          border: "1px solid #e2e8f0"
                        }}
                        className="shadow-2xl relative text-slate-800 font-sans pdf-report-page"
                      >
                        {/* Top Accent Bar */}
                        <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-500"></div>

                        {/* Cover Page */}
                        {section.type === 'cover' && (
                          <div className="flex flex-col justify-between h-full">
                            {/* Logos & Headers */}
                            <div className="flex justify-between items-start">
                              {cover.companyLogoUrl ? (
                                <img src={cover.companyLogoUrl} alt="Logo" className="max-h-12 object-contain" />
                              ) : (
                                <div className="flex items-center gap-2 border border-slate-300 rounded px-2.5 py-1 text-slate-500 bg-slate-50">
                                  <Building className="h-4 w-4" />
                                  <span className="text-[10px] font-bold tracking-wider">COMPANY BRAND</span>
                                </div>
                              )}

                              {cover.clientLogoUrl ? (
                                <img src={cover.clientLogoUrl} alt="Client Logo" className="max-h-12 object-contain" />
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">OFFICIAL RECONCILIATION</span>
                              )}
                            </div>

                            {/* Title & Period */}
                            <div className="my-auto py-10">
                              <span className="text-xs font-bold text-indigo-600 tracking-widest uppercase block mb-3">
                                {cover.reportingPeriod} Audit Cycle
                              </span>
                              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                {cover.reportTitle}
                              </h1>
                              {cover.reportSubtitle && (
                                <p className="text-sm text-slate-500 mt-3 font-normal leading-relaxed">
                                  {cover.reportSubtitle}
                                </p>
                              )}
                              <div className="h-1.5 w-16 bg-indigo-500 rounded mt-6"></div>
                            </div>

                            {/* Metadata Details Grid */}
                            <div className="border-t border-slate-100 pt-6 grid grid-cols-2 gap-x-8 gap-y-4">
                              <div>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Target Facility / Region</span>
                                <span className="text-xs font-bold text-slate-800 block mt-1">{report?.location}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Audited Entity</span>
                                <span className="text-xs font-bold text-slate-800 block mt-1">{cover.clientName}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Report Prepared By</span>
                                <span className="text-xs font-semibold text-slate-700 block mt-1">{cover.preparedBy || "Not Configured"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Audit Generation Date</span>
                                <span className="text-xs font-semibold text-slate-700 block mt-1">
                                  {new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                              </div>
                            </div>

                            {/* Confidentiality Notice */}
                            {cover.confidentialityStatement && (
                              <div className="mt-8 p-3 rounded-lg bg-amber-50 border-l-4 border-amber-500">
                                <p className="text-[10px] text-amber-800 leading-normal font-medium">
                                  {cover.confidentialityStatement}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* General Section Layout */}
                        {section.type !== 'cover' && (
                          <div className="flex flex-col h-full justify-between">
                            <div>
                              {/* Page Header */}
                              <div className="flex justify-between items-center border-b border-slate-100 pb-3 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                <span>INVENTORY AUDIT & RECONCILIATION</span>
                                <span>{cover.reportingPeriod}</span>
                              </div>

                              {/* Section Title */}
                              <div className="mt-6 mb-4">
                                <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
                                {section.description && (
                                  <p className="text-xs text-slate-400 font-medium italic mt-1">{section.description}</p>
                                )}
                              </div>

                              {/* Section Body Contents */}
                              {section.type === 'kpi' && metrics && (
                                <div className="space-y-6">
                                  {/* Metric Cards Grid */}
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total Value (ERP)</span>
                                      <span className="text-base font-extrabold text-slate-900 block mt-1">
                                        SAR {metrics.totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Verified Value</span>
                                      <span className="text-base font-extrabold text-emerald-600 block mt-1">
                                        SAR {metrics.verifiedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Discrepancy Risk</span>
                                      <span className="text-base font-extrabold text-red-600 block mt-1">
                                        SAR {metrics.totalFinancialRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Lines Audited</span>
                                      <span className="text-base font-extrabold text-slate-800 block mt-1">
                                        {metrics.totalLines.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Verified Qty</span>
                                      <span className="text-base font-extrabold text-slate-800 block mt-1">
                                        {metrics.verifiedQuantity.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Accuracy Match</span>
                                      <span className="text-base font-extrabold text-indigo-600 block mt-1">
                                        {metrics.matchRate.toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>

                                  {/* Net Variance Detail Box */}
                                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 grid grid-cols-2 gap-4">
                                    <div>
                                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Net Reconciliation Variance</span>
                                      <span className={`text-xl font-black block mt-1 ${metrics.varianceValue < 0 ? "text-red-500" : "text-emerald-600"}`}>
                                        {metrics.varianceValue < 0 ? "-" : metrics.varianceValue > 0 ? "+" : ""}SAR {Math.abs(metrics.varianceValue).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="space-y-1 text-[10px] text-slate-500 font-medium self-center justify-self-end text-right">
                                      <div>Total Excess Value: <span className="text-emerald-600 font-bold">+{metrics.totalExcessValue.toLocaleString()}</span></div>
                                      <div>Total Shortage Value: <span className="text-red-500 font-bold">-{Math.abs(metrics.totalShortageValue).toLocaleString()}</span></div>
                                    </div>
                                  </div>

                                  {/* Operational Verdict Box */}
                                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-extrabold uppercase">Audit Conclusion</span>
                                      <h4 className="text-xs font-bold text-slate-800">Conclusion Status Verdict</h4>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed font-normal">
                                      Physical reconciliation shows a status of <strong className="text-slate-800">{metrics.auditConclusion}</strong>. 
                                      The verified audit sample covers <strong className="text-slate-800">{metrics.sampleCount}</strong> items with a coverage rate of <strong className="text-slate-800">{metrics.auditCoverageRate}%</strong>. 
                                      The overall inventory health score of <strong className="text-slate-850">{metrics.inventoryHealthScore}</strong> signifies a <strong className="text-slate-800">{metrics.inventoryHealthStatus}</strong> level of operational compliance.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {section.type === 'executive' && (
                                <div className="space-y-5">
                                  {content.executiveSummary && (
                                    <div className="space-y-1.5">
                                      <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Executive Summary</h3>
                                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-normal">{content.executiveSummary}</p>
                                    </div>
                                  )}
                                  {content.observations && (
                                    <div className="space-y-1.5">
                                      <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Auditor Observations</h3>
                                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-normal">{content.observations}</p>
                                    </div>
                                  )}
                                  {content.recommendations && (
                                    <div className="space-y-1.5">
                                      <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Operational Recommendations</h3>
                                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-normal">{content.recommendations}</p>
                                    </div>
                                  )}
                                  {content.auditorRemarks && (
                                    <div className="border-l-4 border-l-indigo-200 pl-4 py-1 italic">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-0.5">Auditor Verdict Remarks</span>
                                      <p className="text-xs text-slate-600 leading-relaxed font-normal">"{content.auditorRemarks}"</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {section.type === 'divisions' && metrics && (
                                <div className="my-auto">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                        <th className="p-3">DIVISION NAME</th>
                                        <th className="p-3 text-center">ITEMS</th>
                                        <th className="p-3 text-right">ERP VALUE (SAR)</th>
                                        <th className="p-3 text-right">VERIFIED VALUE (SAR)</th>
                                        <th className="p-3 text-right">COVERAGE</th>
                                        <th className="p-3 text-right">NET VARIANCE</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                      {metrics.divisions.map((div, idx) => (
                                        <tr key={idx}>
                                          <td className="p-3 font-semibold text-slate-800">{div.division}</td>
                                          <td className="p-3 text-center">{div.itemCount}</td>
                                          <td className="p-3 text-right">{div.erpValue.toLocaleString()}</td>
                                          <td className="p-3 text-right">{div.verifiedValue.toLocaleString()}</td>
                                          <td className="p-3 text-right font-bold text-emerald-600">{div.coverageRate}%</td>
                                          <td className={`p-3 text-right font-bold ${div.varianceValue < 0 ? "text-red-500" : "text-emerald-600"}`}>
                                            {div.varianceValue < 0 ? "-" : div.varianceValue > 0 ? "+" : ""}SAR {Math.abs(div.varianceValue).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {section.type === 'suppliers' && metrics && (
                                <div className="my-auto">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                        <th className="p-3">SUPPLIER</th>
                                        <th className="p-3 text-center">ITEMS</th>
                                        <th className="p-3 text-right">ERP VALUE (SAR)</th>
                                        <th className="p-3 text-right">VERIFIED VALUE (SAR)</th>
                                        <th className="p-3 text-right">MATCH RATE</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                      {metrics.suppliers.slice(0, 8).map((sup, idx) => (
                                        <tr key={idx}>
                                          <td className="p-3 font-semibold text-slate-800">{sup.supplier}</td>
                                          <td className="p-3 text-center">{sup.itemCount}</td>
                                          <td className="p-3 text-right">{sup.erpValue.toLocaleString()}</td>
                                          <td className="p-3 text-right">{sup.verifiedValue.toLocaleString()}</td>
                                          <td className="p-3 text-right font-bold text-indigo-600">{sup.matchingRate.toFixed(1)}%</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {section.type === 'risk' && metrics && (
                                <div className="my-auto space-y-6">
                                  <table className="w-full text-[10px] text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                        <th className="p-2.5">ITEM CODE</th>
                                        <th className="p-2.5">DESCRIPTION</th>
                                        <th className="p-2.5">SUPPLIER</th>
                                        <th className="p-2.5 text-right">ERP QTY</th>
                                        <th className="p-2.5 text-right">PHYS QTY</th>
                                        <th className="p-2.5 text-right">DIFF</th>
                                        <th className="p-2.5 text-right">VARIANCE VALUE</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                      {metrics.highestRiskItems.slice(0, 8).map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="p-2.5 font-bold font-mono text-slate-900">{item.itemCode || "N/A"}</td>
                                          <td className="p-2.5 truncate max-w-[140px]">{item.description || "N/A"}</td>
                                          <td className="p-2.5">{item.supplierName || item.detectedSupplierName || "Others"}</td>
                                          <td className="p-2.5 text-right font-mono">{item.systemOnHand ?? 0}</td>
                                          <td className="p-2.5 text-right font-mono">{item.physicalCount ?? 0}</td>
                                          <td className={`p-2.5 text-right font-mono font-bold ${item.differenceQty < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                            {item.differenceQty > 0 ? "+" : ""}{item.differenceQty.toLocaleString()}
                                          </td>
                                          <td className={`p-2.5 text-right font-mono font-bold ${item.varianceValue < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                            {item.varianceValue < 0 ? "-" : item.varianceValue > 0 ? "+" : ""}SAR {Math.abs(item.varianceValue).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {/* Signatures Panel */}
                                  <div className="border-t border-slate-200 pt-6">
                                    <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-4">
                                      Reconciliation Signatories Approval
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                      <div className="border border-slate-200 rounded p-3 bg-slate-50">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase block">Prepared By</span>
                                        <span className="text-[10px] font-semibold text-slate-700 block mt-1">{cover.preparedBy || "Not configured"}</span>
                                        <div className="border-b border-dashed border-slate-300 h-8 mt-2"></div>
                                      </div>
                                      <div className="border border-slate-200 rounded p-3 bg-slate-50">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase block">Checked By</span>
                                        <span className="text-[10px] font-semibold text-slate-700 block mt-1">{cover.checkedBy || "Not configured"}</span>
                                        <div className="border-b border-dashed border-slate-300 h-8 mt-2"></div>
                                      </div>
                                      <div className="border border-slate-200 rounded p-3 bg-slate-50">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase block">Approved By</span>
                                        <span className="text-[10px] font-semibold text-slate-700 block mt-1">{cover.approvedBy || "Not configured"}</span>
                                        <div className="border-b border-dashed border-slate-300 h-8 mt-2"></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {section.type === 'team' && (
                                <div className="my-auto space-y-6">
                                  <p className="text-xs text-slate-500 italic">
                                    Evidence and warehouse photos appended to this report for verification.
                                  </p>

                                  {/* Render Uploaded Images if any */}
                                  {images.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4">
                                      {images.slice(0, 4).map((img) => (
                                        <div key={img.id} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 space-y-2">
                                          <div className="h-28 w-full bg-slate-200 rounded overflow-hidden">
                                            <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                                          </div>
                                          <div>
                                            <span className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest block">
                                              {img.category.replace('_', ' ')}
                                            </span>
                                            <p className="text-[10px] text-slate-700 mt-0.5 leading-snug">
                                              {img.caption}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-400 text-xs">
                                      No evidence images or photos uploaded to this builder. Select the "Evidence & Images" tab to add them.
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Notes / Comments rendering at the bottom of the section */}
                              {section.notes && (
                                <div className="border-t border-slate-100 pt-4 mt-6">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Section Notes & Auditor Disclaimers</span>
                                  <p className="text-[10px] text-slate-500 italic leading-relaxed mt-1">
                                    {section.notes}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between items-center border-t border-slate-100 pt-4 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              <span>CONFIDENTIAL — INVENTORY PORTAL</span>
                              <span>Page {pageIndex + 1} of {filteredArray.length}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}
