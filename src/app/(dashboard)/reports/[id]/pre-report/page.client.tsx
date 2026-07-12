"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReportId } from "@/lib/useReportId";
import { db, doc, getDoc, updateDoc, setDoc, collection, getDocs } from "@/lib/firebase";
import { getHighestStep } from "@/lib/workflow";
import {
  ArrowLeft, ShieldCheck, CheckCircle2,
  Calendar, Eye, ZoomIn, ZoomOut, Save, Sparkles, Building, Maximize2, Minimize2
} from "lucide-react";
import { computeDashboardMetrics } from "@/lib/inventory/dashboardCalculations";
import { buildReportNarrative, PreReportMetrics } from "@/lib/report/insightEngine";
import {
  ReportSection, CoverPageData, EditableContent, UploadedImage, ApprovalState,
  DEFAULT_SECTIONS, DEFAULT_COVER, DEFAULT_CONTENT, DEFAULT_APPROVAL,
  mergeWithDefaultSections
} from "@/types/preReport";
import { SectionManager } from "@/components/pre-report/SectionManager";
import { CoverPageEditor } from "@/components/pre-report/CoverPageEditor";
import { ContentEditor } from "@/components/pre-report/ContentEditor";
import { ImageManager } from "@/components/pre-report/ImageManager";
import { ApprovalGatedChecklist } from "@/components/pre-report/ApprovalGatedChecklist";
import { ExecutiveReportDocument } from "@/components/pre-report/ExecutiveReportDocument";
import { runQA } from "@/lib/report/qaEngine";

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
  const id = useReportId();

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
  const [zoom, setZoom] = useState<number>(0.7);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Configuration States
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [cover, setCover] = useState<CoverPageData>(DEFAULT_COVER);
  const [content, setContent] = useState<EditableContent>(DEFAULT_CONTENT);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [approval, setApproval] = useState<ApprovalState>(DEFAULT_APPROVAL);

  useEffect(() => {
    if (!id || id === "placeholder") return;
    const fetchReportAndData = async () => {
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

          // Initialize configs if stored in Firestore
          if (reportData.preReportConfig) {
            const config = reportData.preReportConfig;
            if (config.sections) setSections(mergeWithDefaultSections(config.sections));
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
        setError("Could not retrieve report data.");
      } finally {
        setLoading(false);
      }
    };

    fetchReportAndData();
  }, [id]);

  // Format raw items once; reused by metrics and the narrative engine
  const formattedRows = useMemo(() => {
    return items.map(item => {
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
  }, [items]);

  // Run dynamic metrics calculation
  const metrics: PreReportMetrics = useMemo(() => {
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
  }, [formattedRows, agingRecords]);

  // Generate the executive narrative
  const narrative = useMemo(() => {
    return buildReportNarrative({
      quarter: report?.quarter || "",
      year: report?.year || "",
      clientName: cover.clientName || report?.warehouseName || "",
      location: report?.location || "",
      metrics,
      rows: formattedRows,
    });
  }, [metrics, formattedRows, report, cover.clientName]);

  const qaIssues = useMemo(() => {
    return runQA({
      sections,
      cover,
      content,
      images,
      metrics,
      narrative,
      reportMeta: {
        quarter: report?.quarter || "",
        year: report?.year || "",
        location: report?.location || "",
      },
    });
  }, [sections, cover, content, images, metrics, narrative, report]);

  // Compute Readiness Score for header display
  const readinessScore = useMemo(() => {
    const errors = qaIssues.filter(issue => issue.severity === "error");
    const warnings = qaIssues.filter(issue => issue.severity === "warning");
    const uncheckedCount = Object.values(approval).filter(v => !v).length;
    return Math.max(0, 100 - (errors.length * 15) - (warnings.length * 5) - (uncheckedCount * 5));
  }, [qaIssues, approval]);

  // Section meta compilation
  const sectionMeta = useMemo(() => {
    const meta: Record<string, any> = {};
    
    sections.forEach(s => {
      let status: 'complete' | 'review' | 'incomplete' = 'complete';
      let stats: any = {};
      
      switch (s.type) {
        case 'cover':
          status = cover.reportTitle?.trim() && cover.preparedBy?.trim() ? 'complete' : 'review';
          break;
        case 'toc':
          status = 'complete';
          break;
        case 'executive':
          const execText = content.executiveSummary?.trim() || "";
          status = execText.length > 50 ? 'complete' : 'review';
          stats = {
            wordCount: execText.split(/\s+/).filter(Boolean).length,
            insightCount: narrative.overview?.insights?.length || 0,
          };
          break;
        case 'kpi':
          stats = { chartCount: 1, tableCount: 1 };
          break;
        case 'financial':
          stats = { chartCount: 1, tableCount: 1 };
          break;
        case 'health':
          stats = { chartCount: 1 };
          break;
        case 'divisions':
          stats = { tableCount: 1 };
          break;
        case 'suppliers':
          stats = { tableCount: 1 };
          break;
        case 'distribution':
          stats = { chartCount: 1 };
          break;
        case 'validation':
          stats = { tableCount: 1 };
          break;
        case 'risk':
          const isHighRisk = metrics.totalRiskValue > metrics.totalInventoryValue * 0.2;
          stats = {
            riskLevel: isHighRisk ? 'High' : 'Medium',
            tableCount: 1,
          };
          break;
        case 'opportunities':
          stats = { insightCount: narrative.opportunities?.length || 0 };
          break;
        case 'recommendations':
          stats = { recCount: narrative.consolidatedRecommendations?.length || 0 };
          break;
        case 'conclusion':
          status = cover.preparedBy?.trim() && cover.checkedBy?.trim() && cover.approvedBy?.trim() ? 'complete' : 'review';
          break;
        case 'team':
          status = images.length > 0 ? 'complete' : 'review';
          break;
      }
      
      meta[s.id] = { status, ...stats };
    });
    
    return meta;
  }, [sections, cover, content, images, narrative, metrics]);

  // Scroll Synchronization
  const handleSectionSelect = (sectionId: string) => {
    setActiveSectionId(sectionId);
    
    // Find page element inside the preview container
    setTimeout(() => {
      const pageEl = document.getElementById(`page-${sectionId}`);
      if (pageEl && previewContainerRef.current) {
        const container = previewContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const elRect = pageEl.getBoundingClientRect();
        
        // Calculate relative offset to scroll the container viewport
        const scrollTarget = container.scrollTop + (elRect.top - containerRect.top) - 16;
        container.scrollTo({
          top: scrollTarget,
          behavior: "smooth"
        });
      }
    }, 50);
  };

  // Auto-fill legacy logic
  useEffect(() => {
    if (!narrative || items.length === 0) return;

    const legacyExec = /inventory verification audit, a total of/;
    const legacyRecs = /reconciliation review of high-risk items identified in Section 3/;
    const legacyObs = /Discrepancy rates are concentrated within specific warehouse divisions/;
    const legacyRemarks = /^Data verification is complete with standard tolerances\. The results present a true and fair view/;

    const needsExec = !content.executiveSummary.trim() || legacyExec.test(content.executiveSummary);
    const needsRecs = !content.recommendations.trim() || legacyRecs.test(content.recommendations);
    const needsObs = !content.observations.trim() || legacyObs.test(content.observations);
    const needsRemarks = !content.auditorRemarks.trim() || legacyRemarks.test(content.auditorRemarks);

    if (!needsExec && !needsRecs && !needsObs && !needsRemarks) return;

    const topObservations = [
      ...narrative.overview.insights.slice(0, 1),
      ...narrative.organizations.insights.slice(0, 1),
      ...narrative.validation.insights.slice(0, 1),
    ].join("\n");

    setContent(prev => ({
      ...prev,
      executiveSummary: needsExec ? narrative.executiveSummary : prev.executiveSummary,
      recommendations: needsRecs
        ? narrative.consolidatedRecommendations.map((r, i) => `${i + 1}. ${r.title} — ${r.reason}`).join("\n")
        : prev.recommendations,
      observations: needsObs ? topObservations : prev.observations,
      auditorRemarks: needsRemarks
        ? `Verification is complete within standard tolerances. The composite health score of ${metrics.healthScore} (“${metrics.inventoryHealthStatus}”) presents a true and fair view of physical stock levels at the time of the audit.`
        : prev.auditorRemarks
    }));
  }, [narrative, metrics, items.length]);

  const handleSave = async (showNotification = true) => {
    setSaving(true);
    setError(null);
    if (showNotification) setSuccessMsg(null);

    try {
      const docRef = doc(db, "reports", id);
      await setDoc(docRef, {
        preReportConfig: {
          sections,
          cover,
          content,
          images,
          approval
        },
        updatedAt: new Date()
      }, { merge: true });
      if (showNotification) {
        setSuccessMsg("Pre-Report configuration saved successfully!");
        setTimeout(() => setSuccessMsg(null), 4500);
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
      await setDoc(docRef, {
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
        // Promote highest step reached to 5 to unlock final PDF Builder stage
        highestStepReached: 5,
        updatedAt: new Date()
      }, { merge: true });
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

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const enabledSections = sortedSections.filter(s => s.enabled);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Upper Navigation Bar */}
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
              Pre-Report Builder &amp; Workspace
            </h1>
          </div>
        </div>

        {/* Global Save Actions and Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800/60 bg-slate-950/20 text-[11px]">
            <span className="text-slate-450">Quality Readiness:</span>
            <span className={`font-bold ${readinessScore >= 90 ? 'text-emerald-450' : readinessScore >= 70 ? 'text-amber-450' : 'text-rose-450'}`}>
              {readinessScore}% Complete
            </span>
          </div>

          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/50 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Draft"}
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

      {/* Main Dual-Pane WYSIWYG Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Builder Controls / Toolbox (5 of 12 columns) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Internal Workspace Toolbox Tabs */}
          <div className="flex border-b border-slate-800 pb-px overflow-x-auto gap-1">
            {[
              { id: 'sections', label: 'Outline' },
              { id: 'cover', label: 'Cover Designer' },
              { id: 'content', label: 'Narrative Editor' },
              { id: 'images', label: 'Evidence Images' },
              { id: 'approve', label: 'Quality & Sign-Off' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-450 bg-indigo-500/5 rounded-t-md"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 rounded-t-md"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Workspace Control Component */}
          <div className="space-y-4">
            {activeTab === 'sections' && (
              <SectionManager
                sections={sections}
                onSectionsChange={setSections}
                activeSectionId={activeSectionId}
                onSectionSelect={handleSectionSelect}
                sectionMeta={sectionMeta}
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
                qaIssues={qaIssues}
              />
            )}
          </div>
        </div>

        {/* Right Side: Primary WYSIWYG Document Workspace Hero (7 of 12 columns) */}
        <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-6">
          
          {/* Workspace Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 bg-[#090b11]/80 backdrop-blur-md px-1">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Document Preview Workspace
              </h3>
            </div>

            {/* Document Presets & Zoom Options */}
            <div className="flex items-center gap-2">
              {/* Presets */}
              <button
                onClick={() => setZoom(0.55)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer hover:border-slate-700"
                title="Fit full page in viewport"
              >
                <Minimize2 className="h-3 w-3" />
                Fit Page
              </button>
              <button
                onClick={() => setZoom(0.95)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer hover:border-slate-700"
                title="Expand page to full width"
              >
                <Maximize2 className="h-3 w-3" />
                Fit Width
              </button>

              {/* Steps/Scale control */}
              <div className="h-4 w-px bg-slate-850" />
              
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
                <button
                  onClick={() => setZoom(prev => Math.max(0.4, prev - 0.05))}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-850 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3 w-3" />
                </button>
                <span className="text-[10px] font-mono text-slate-400 w-10 text-center select-none font-bold">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(prev => Math.min(1.3, prev + 0.05))}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-850 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Document Page Canvas */}
          <div
            ref={previewContainerRef}
            className="w-full flex flex-col items-center bg-[#07090d]/60 border border-slate-850/80 rounded-xl py-6 px-4 overflow-y-auto max-h-[80vh] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent scroll-smooth"
          >
            {/* Canvas Container keeping scale wrapper responsive */}
            <div
              style={{
                width: `${794 * zoom}px`,
                height: `${(enabledSections.length * 1123 + (enabledSections.length - 1) * 32) * zoom}px`,
                position: "relative",
              }}
              className="transition-all duration-300"
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
                className="flex flex-col gap-8"
              >
                <ExecutiveReportDocument
                  sections={sections}
                  cover={cover}
                  content={content}
                  images={images}
                  metrics={metrics}
                  narrative={narrative}
                  reportMeta={{
                    quarter: report?.quarter || "",
                    year: report?.year || "",
                    location: report?.location || ""
                  }}
                />
              </div>
            </div>
          </div>

          {/* Live Sync Footer Alert */}
          <div className="flex items-center justify-between text-[10px] text-slate-550 px-1 font-mono">
            <span>* Document is synchronized in real-time</span>
            <span>A4 Portrait Layout (794px × 1123px)</span>
          </div>

        </div>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}
