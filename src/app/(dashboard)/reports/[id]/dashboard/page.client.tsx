"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useReportId } from "@/lib/useReportId";
import { db, doc, getDoc, collection, getDocs, updateDoc, setDoc } from "@/lib/firebase";
import { getHighestStep } from "@/lib/workflow";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Unlock,
  Filter,
  RefreshCw,
  AlertTriangle,
  Info,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Package,
  CheckCircle2,
  Search,
  Calendar,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  UserCheck,
  BarChart3,
  Users,
  FileText,
  AlertCircle,
  Award,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { computeDashboardMetrics } from "@/lib/inventory/dashboardCalculations";
import { PieChart, PieSlice, PieCenter } from "@/components/ui/bklitui-pie-chart";
import { NotchedRadialGauge } from "@/components/ui/notched-radial-gauge";

interface Report {
  title: string;
  quarter: string;
  year: number;
  status: string;
  companyId?: string;
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

interface InventoryItem {
  id: string;
  itemCode: string;
  description: string;
  supplierName?: string;
  detectedSupplierName?: string;
  supplier?: string;
  org: string;
  erpQty: number;
  physicalQty: number;
  differenceQty: number;
  unitCost: number;
  varianceValue: number;
  absoluteVarianceValue: number;
  issueCategory: string;
  status: string;
  validationWarnings?: string[];
  remarks?: string;
  sheetName?: string;
  reported?: string;
}

// ==========================================
// CUSTOM EXECUTIVE-LEVEL VISUAL COMPONENTS
// ==========================================

interface SectionInsightBriefProps {
  whatHappened: string;
  whereItHappened: string;
  whyImportant: string;
}

function SectionInsightBrief({ whatHappened, whereItHappened, whyImportant }: SectionInsightBriefProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">What Happened?</span>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">{whatHappened}</p>
      </div>
      <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-850 pt-3 md:pt-0 md:pl-4">
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Where Did It Happen?</span>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">{whereItHappened}</p>
      </div>
      <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-850 pt-3 md:pt-0 md:pl-4">
        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block">Why Is It Important?</span>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">{whyImportant}</p>
      </div>
    </div>
  );
}

// ─── Dashboard Glossary Component ───────────────────────────────────────────

const GLOSSARY_TERMS: { category: string; color: string; icon: string; terms: { term: string; definition: string }[] }[] = [
  {
    category: "Financial Metrics",
    color: "emerald",
    icon: "💰",
    terms: [
      { term: "ERP Value", definition: "Enterprise Resource Planning value — the monetary book value of an inventory item as recorded in the company's ERP system (e.g. SAP, Oracle). This represents the 'expected' financial figure before physical verification." },
      { term: "Verified Value", definition: "The SAR monetary value of items that have been physically counted and confirmed on the warehouse floor. Compared against ERP to identify discrepancies." },
      { term: "Variance", definition: "The difference between the ERP (book) value and the physically verified value. A negative variance (shortage) means fewer items exist than recorded; a positive variance (excess) means more items were found." },
      { term: "Absolute Variance", definition: "The total magnitude of variance regardless of direction — shortages and excesses are both added as positive numbers. Used to measure overall financial exposure." },
      { term: "Net Variance", definition: "Shortages minus excesses — the directional financial impact. A positive net variance means the warehouse holds more than the books show; negative means a deficit." },
      { term: "SAR", definition: "Saudi Riyal — the currency unit used across all monetary figures in this dashboard. All values expressed in SAR are in full Saudi Riyals (no rounding unless stated)." },
    ]
  },
  {
    category: "Audit & Verification",
    color: "indigo",
    icon: "🔍",
    terms: [
      { term: "Coverage Rate", definition: "The percentage of ERP ledger value that has been physically verified. Formula: (Verified Value ÷ ERP Value) × 100. A coverage rate of 97.5% means 97.5% of the total asset value has been physically counted." },
      { term: "Count Match Rate", definition: "The percentage of verified line items where the physical count exactly matches the ERP quantity. High match rates (>95%) indicate strong record accuracy." },
      { term: "Audit Opinion", definition: "A qualitative conclusion derived from the verification results. Possible values include: 'Unqualified Opinion' (clean audit, no material issues), 'Qualified Opinion' (minor discrepancies found), and 'Adverse Opinion' (significant material misstatements)." },
      { term: "Physical Count", definition: "The actual on-the-floor count of inventory items performed by the stock-take team. Results are uploaded via Excel workbooks and compared against ERP records." },
      { term: "Unverified Stock", definition: "Inventory items present in the ERP system that have not yet been physically counted in this reporting cycle. Represents outstanding audit exposure." },
    ]
  },
  {
    category: "Organizational Structure",
    color: "blue",
    icon: "🏢",
    terms: [
      { term: "Division", definition: "A top-level organizational cost center (e.g., Warehouse A, Engineering, Procurement). All inventory items are attributed to a division for performance tracking." },
      { term: "Sub-Division", definition: "A workbook worksheet or sub-unit within a division. Each Excel sheet uploaded represents a sub-division with its own item catalog, quantities, and values." },
      { term: "Cost Center", definition: "An accounting unit within a division used to track spending and asset values. Variance analysis is performed at the cost center level." },
      { term: "Supplier", definition: "The vendor or manufacturer associated with an inventory item, detected from the uploaded data via name matching or fallback rules. Supplier performance is tracked by financial exposure." },
    ]
  },
  {
    category: "Dashboard KPIs",
    color: "violet",
    icon: "📊",
    terms: [
      { term: "Inventory Health Score", definition: "A composite score (0–100) representing the overall audit integrity of the warehouse. Calculated from three components: Coverage Rate (40%), Count Accuracy (40%), and Financial Risk Exposure (20%). Scores ≥95 are 'Excellent'." },
      { term: "Financial Risk", definition: "The total absolute variance across all inventory items — representing the total monetary value at risk due to discrepancies between ERP records and physical counts." },
      { term: "Highest Risk Supplier", definition: "The supplier whose inventory items have the largest combined absolute variance. Indicates where count discrepancies are financially most significant." },
      { term: "Highest Risk Cost Center", definition: "The division with the largest total absolute variance — the organizational unit with the most financial exposure from inventory discrepancies." },

    ]
  },
  {
    category: "Report Terminology",
    color: "amber",
    icon: "📋",
    terms: [
      { term: "Report Period", definition: "A defined quarterly cycle (e.g., Q3 2026) for which the stock-take exercise is conducted. Each report period has its own set of uploaded workbooks and generates its own dashboard." },
      { term: "Line Item", definition: "A single inventory entry — one unique item code with its associated description, quantity, and SAR value. The dashboard counts and analyses at the line-item level." },
      { term: "Workbook", definition: "An Excel file uploaded by the stock-take team. May contain multiple sheets (sub-divisions) each representing a portion of the warehouse." },
      { term: "Deterministic Calculation", definition: "All metrics in this dashboard are rule-based and fully reproducible. Given the same input data, the same results will always be produced — no AI estimation or probabilistic modelling is used." },
    ]
  },
];

function DashboardGlossary() {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  const colorMap: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
    emerald: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
    indigo:  { bg: "bg-indigo-500/5",  border: "border-indigo-500/20",  text: "text-indigo-400",  badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",   dot: "bg-indigo-400"  },
    blue:    { bg: "bg-cyan-500/5",    border: "border-cyan-500/20",    text: "text-cyan-400",    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",         dot: "bg-cyan-400"    },
    violet:  { bg: "bg-violet-500/5",  border: "border-violet-500/20",  text: "text-violet-400",  badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",   dot: "bg-violet-400"  },
    amber:   { bg: "bg-amber-500/5",   border: "border-amber-500/20",   text: "text-amber-400",   badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",     dot: "bg-amber-400"   },
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-gradient-to-br from-[#0c0e15] to-[#0f1120] overflow-hidden shadow-xl">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-900/20 transition-colors text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm">📖</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Dashboard Terminology Guide</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Definitions for all metrics, KPIs, and terms used across this dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-slate-700 text-slate-500 font-mono">
            {GLOSSARY_TERMS.reduce((sum, g) => sum + g.terms.length, 0)} Terms · {GLOSSARY_TERMS.length} Categories
          </span>
          <div className={`w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t border-slate-850">
          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto px-5 py-3 border-b border-slate-850 scrollbar-none">
            <button
              onClick={() => setActiveCategory(null)}
              className={`flex-shrink-0 text-[10px] font-bold uppercase px-3 py-1 rounded-full border transition-all ${
                activeCategory === null
                  ? "bg-slate-700 text-white border-slate-600"
                  : "text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
              }`}
            >
              All Categories
            </button>
            {GLOSSARY_TERMS.map((group) => {
              const c = colorMap[group.color];
              return (
                <button
                  key={group.category}
                  onClick={() => setActiveCategory(activeCategory === group.category ? null : group.category)}
                  className={`flex-shrink-0 text-[10px] font-bold uppercase px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                    activeCategory === group.category
                      ? `${c.badge} border`
                      : "text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span>{group.icon}</span>
                  {group.category}
                </button>
              );
            })}
          </div>

          {/* Terms Grid */}
          <div className="p-5 space-y-6">
            {GLOSSARY_TERMS
              .filter(group => activeCategory === null || group.category === activeCategory)
              .map((group) => {
                const c = colorMap[group.color];
                return (
                  <div key={group.category}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`}></span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${c.text}`}>
                        {group.icon} {group.category}
                      </span>
                      <div className="flex-1 h-px bg-slate-850"></div>
                      <span className="text-[9px] text-slate-600 font-mono">{group.terms.length} terms</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.terms.map((item) => (
                        <div
                          key={item.term}
                          className={`rounded-lg border ${c.border} ${c.bg} p-3.5 space-y-1.5 hover:brightness-110 transition-all`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`}></span>
                            <span className={`text-xs font-bold ${c.text}`}>{item.term}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed pl-3.5">{item.definition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Footer note */}
          <div className="px-5 pb-4 pt-1 border-t border-slate-850">
            <p className="text-[10px] text-slate-600 font-mono">
              ℹ️ All calculations in this dashboard are fully deterministic. Metrics are derived exclusively from the uploaded Excel workbooks — no AI estimation or manual overrides are applied.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Executive Summary Panel ──────────────────────────────────────────────────

interface ExecutiveSummaryPanelProps {
  metrics: any;
  matchRateVal: number;
}

function ExecutiveSummaryPanel({ metrics, matchRateVal }: ExecutiveSummaryPanelProps) {
  const remainingValue = Math.max(0, metrics.totalInventoryValue - metrics.verifiedValue);
  
  return (
    <div className="rounded-xl border border-slate-800/85 bg-gradient-to-br from-[#0c0e15] to-[#121524] p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-850 pb-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-indigo-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Executive Insights & Summary</h2>
        </div>
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">System Generated • 100% Deterministic</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Metrics Summary */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Core Metrics Profile</span>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex justify-between items-center">
              <span className="text-slate-400">Total Asset Value:</span>
              <span className="font-mono font-bold text-white">SAR {metrics.totalInventoryValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-slate-400">Verified Coverage:</span>
              <span className="font-mono font-bold text-emerald-400">{metrics.coverageRate.toFixed(1)}%</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-slate-400">Count Match Rate:</span>
              <span className="font-mono font-bold text-indigo-400">{matchRateVal.toFixed(1)}%</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-slate-400">Total Absolute Risk:</span>
              <span className="font-mono font-bold text-rose-400">SAR {metrics.totalFinancialRisk.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </li>
          </ul>
        </div>

        {/* Operational Concentration */}
        <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-850 pt-4 md:pt-0 md:pl-6">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Operational Concentration</span>
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Highest Risk Cost Center:</span>
              <span className="font-bold text-white mt-1 truncate flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                {metrics.highestRiskDivision}
              </span>
            </li>
            <li className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Highest Risk Supplier:</span>
              <span className="font-bold text-white mt-1 truncate flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                {metrics.highestRiskSupplier}
              </span>
            </li>
          </ul>
        </div>

        {/* Key Observations */}
        <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-850 pt-4 md:pt-0 md:pl-6">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Key Observations</span>
          <div className="text-xs text-slate-300 leading-relaxed space-y-2.5">
            <p className="flex items-start gap-1.5">
              <span className="text-indigo-400 font-bold">•</span>
              <span>Inventory health is calculated at <strong className="text-indigo-400">{metrics.inventoryHealthScore}</strong> ({metrics.inventoryHealthStatus}).</span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="text-indigo-400 font-bold">•</span>
              <span>Unverified stock represents <strong className="text-slate-200">SAR {remainingValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong> ({metrics.remainingLines.toLocaleString()} remaining items).</span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="text-indigo-400 font-bold">•</span>
              <span>Audit opinion: <strong className="text-amber-400">"{metrics.auditConclusion.split(" - ")[0]}"</strong>.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DonutData {
  label: string;
  value: number;
  color: string;
}

interface SVGDonutChartProps {
  data: DonutData[];
  title: string;
  subtitle?: string;
  size?: "sm" | "lg";
  isCurrency?: boolean;
}

function SVGDonutChart({ data, title, subtitle, size = "sm", isCurrency = false }: SVGDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const isLg = size === "lg";
  const center = isLg ? 72 : 48;
  const radius = isLg ? 47 : 28;
  const strokeWidth = isLg ? 22 : 15;
  const circumference = 2 * Math.PI * radius;

  // Formatting helper for currency or raw numbers
  const formatValue = (val: number) => {
    if (isCurrency) {
      if (val >= 1_000_000) return `SAR ${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `SAR ${(val / 1_000).toFixed(1)}K`;
      return `SAR ${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    } else {
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
      return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }
  };
  
  let currentOffset = 0;
  
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-5 flex flex-col h-full">
      <div>
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className={`flex-grow flex flex-col sm:flex-row items-center justify-center mt-6 ${isLg ? "gap-8" : "gap-6"}`}>
        <div className={`relative flex items-center justify-center flex-shrink-0 ${isLg ? "w-36 h-36" : "w-24 h-24"}`}>
          <svg className={`${isLg ? "w-36 h-36" : "w-24 h-24"} transform -rotate-90`}>
            {/* Background ring */}
            <circle cx={center} cy={center} r={radius} className="stroke-slate-850" strokeWidth={strokeWidth} fill="transparent" />
            
            {/* Inner mask circle for nice contrast */}
            <circle cx={center} cy={center} r={radius - strokeWidth / 2} className="fill-slate-950/30" />
            
            {data.map((item, idx) => {
              const share = item.value / total;
              const strokeDasharray = `${share * circumference} ${circumference}`;
              const strokeDashoffset = circumference - currentOffset;
              currentOffset += share * circumference;
              
              return (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  className="transition-all duration-500"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                />
              );
            })}
          </svg>
          
          {/* Overlay centered labels */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest scale-90">Total</span>
            <span className={`font-mono font-bold text-white tracking-tight ${isLg ? "text-[13px] mt-0.5" : "text-[10px] mt-0"}`}>
              {formatValue(total)}
            </span>
          </div>
        </div>

        <div className="flex-grow space-y-2 text-xs w-full">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-900/40 last:border-0">
              <div className="flex items-center gap-1.5 text-slate-400 min-w-0">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                <span className="truncate" title={item.label}>{item.label}</span>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 pl-3">
                <span className="font-mono font-bold text-white">
                  {((item.value / total) * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {formatValue(item.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface BKLitSupplierDonutChartProps {
  data: DonutData[];
  title: string;
  subtitle?: string;
  isCurrency?: boolean;
}

function BKLitSupplierDonutChart({ data, title, subtitle, isCurrency = false }: BKLitSupplierDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  const formatValue = (val: number) => {
    if (isCurrency) {
      if (val >= 1_000_000) return `SAR ${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `SAR ${(val / 1_000).toFixed(1)}K`;
      return `SAR ${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    } else {
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
      return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-5 flex flex-col h-full">
      <div>
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex-grow flex flex-col sm:flex-row items-center justify-center mt-6 gap-8">
        <div className="relative flex items-center justify-center flex-shrink-0 w-36 h-36">
          <PieChart
            data={data}
            innerRadius={55}
            padAngle={0.02}
            cornerRadius={4}
          >
            {data.map((_, index) => (
              <PieSlice
                key={index}
                index={index}
              />
            ))}

            <PieCenter
              defaultLabel="TOTAL"
              prefix="SAR "
            />
          </PieChart>
        </div>

        <div className="flex-grow space-y-2 text-xs w-full">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-900/40 last:border-0">
              <div className="flex items-center gap-1.5 text-slate-400 min-w-0">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                <span className="truncate" title={item.label}>{item.label}</span>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 pl-3">
                <span className="font-mono font-bold text-white">
                  {((item.value / total) * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {formatValue(item.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface BKLitAccuracyDonutChartProps {
  data: DonutData[];
  title: string;
  subtitle?: string;
}

function BKLitAccuracyDonutChart({ data, title, subtitle }: BKLitAccuracyDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  const formatValue = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-5 flex flex-col h-full">
      <div>
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex-grow flex flex-col sm:flex-row items-center justify-center mt-6 gap-8">
        <div className="relative flex items-center justify-center flex-shrink-0 w-36 h-36">
          <PieChart
            data={data}
            innerRadius={55}
            padAngle={0.02}
            cornerRadius={4}
          >
            {data.map((_, index) => (
              <PieSlice
                key={index}
                index={index}
              />
            ))}

            <PieCenter
              defaultLabel="TOTAL"
            />
          </PieChart>
        </div>

        <div className="flex-grow space-y-2 text-xs w-full">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-900/40 last:border-0">
              <div className="flex items-center gap-1.5 text-slate-400 min-w-0">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                <span className="truncate" title={item.label}>{item.label}</span>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 pl-3">
                <span className="font-mono font-bold text-white">
                  {((item.value / total) * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {formatValue(item.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface BarData {
  label: string;
  value: number;
  displayValue?: string;
  color?: string;
}

interface SVGHorizontalBarChartProps {
  data: BarData[];
  title: string;
  subtitle?: string;
}

function SVGHorizontalBarChart({ data, title, subtitle }: SVGHorizontalBarChartProps) {
  const maxVal = Math.max(...data.map(d => Math.abs(d.value))) || 1;

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-5 space-y-4 flex flex-col h-full">
      <div>
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="space-y-3 flex-1 flex flex-col justify-center">
        {data.map((item, idx) => {
          const pct = Math.min(100, Math.max(2, (Math.abs(item.value) / maxVal) * 100));
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold truncate max-w-[220px]" title={item.label}>
                  {item.label}
                </span>
                <span className="font-mono text-white font-bold">
                  {item.displayValue || item.value.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-900/60 h-2.5 rounded-full overflow-hidden border border-slate-850">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: item.color || "#6366f1"
                    }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SVGVerticalBarChartProps {
  data: BarData[];
  title: string;
  subtitle?: string;
  height?: number;
}

function SVGVerticalBarChart({ data, title, subtitle, height = 220 }: SVGVerticalBarChartProps) {
  const maxVal = Math.max(...data.map(d => Math.abs(d.value))) || 1;

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-5 space-y-4 flex flex-col h-full">
      <div>
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div 
        className="flex items-end justify-between gap-2.5 pt-6 pb-2" 
        style={{ height: `${height}px` }}
      >
        {data.map((item, idx) => {
          const pct = (Math.abs(item.value) / maxVal) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end min-w-0">
              {/* Bar Wrapper exactly matching bar height */}
              <div 
                className="w-full relative group flex flex-col justify-end"
                style={{ height: `${Math.max(4, pct)}%` }}
              >
                {/* Tooltip on hover - positioned relative to bar height */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-950 text-white text-[10px] rounded px-2 py-1 border border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 font-mono shadow-xl">
                  {item.displayValue || item.value.toLocaleString()}
                </div>

                {/* Bar */}
                <div
                  className="w-full h-full rounded-t-sm transition-all duration-300 hover:brightness-125 hover:scale-x-105 origin-bottom cursor-pointer"
                  style={{
                    backgroundColor: item.color || "#6366f1"
                  }}
                ></div>
              </div>

              {/* Label */}
              <span className="text-[9px] text-slate-400 mt-2 font-mono text-center truncate w-full" title={item.label}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BKLit Grouped Vertical Bar Chart ────────────────────────────────────────
// Two-series grouped bar chart matching the dashboard design system.
// Uses the same spring-feel hover, tooltip, and card style as all other charts.

interface GroupedBarSeries {
  key: string;
  label: string;
  color: string;
}

interface GroupedBarDataPoint {
  group: string;
  values: Record<string, number>;
}

interface BKLitGroupedBarChartProps {
  title: string;
  subtitle?: string;
  data: GroupedBarDataPoint[];
  series: GroupedBarSeries[];
  height?: number;
  formatValue?: (v: number) => string;
}

function BKLitGroupedBarChart({
  title,
  subtitle,
  data,
  series,
  height = 240,
  formatValue,
}: BKLitGroupedBarChartProps) {
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; point: GroupedBarDataPoint } | null>(null);

  const allValues = data.flatMap(d => series.map(s => d.values[s.key] ?? 0));
  const maxVal = Math.max(...allValues, 1);

  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }));

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-5 flex flex-col h-full" style={{ position: "relative" }}>
      {/* Header */}
      <div>
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 mb-1">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] text-slate-400 font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div
        className="relative flex items-end gap-3 pt-4 pb-2 overflow-x-auto"
        style={{ height: `${height}px`, minHeight: `${height}px` }}
      >
        {data.map((point, gi) => (
          <div
            key={gi}
            className="flex flex-col items-center flex-1 min-w-[48px] h-full justify-end"
            onMouseEnter={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const parent = (e.currentTarget.closest(".rounded-xl") as HTMLElement)?.getBoundingClientRect();
              if (parent) {
                setTooltip({
                  x: rect.left - parent.left + rect.width / 2,
                  y: rect.top - parent.top,
                  point,
                });
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Two bars side-by-side */}
            <div className="flex items-end gap-[3px] w-full h-full justify-center">
              {series.map(s => {
                const val = point.values[s.key] ?? 0;
                const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                return (
                  <div
                    key={s.key}
                    className="flex-1 group relative flex flex-col justify-end"
                    style={{ height: "100%", maxWidth: "28px" }}
                  >
                    <div
                      className="w-full rounded-t-sm transition-all duration-500 ease-out cursor-pointer group-hover:brightness-125"
                      style={{
                        height: `${Math.max(3, pct)}%`,
                        backgroundColor: s.color,
                        opacity: 0.9,
                        transformOrigin: "bottom",
                        transition: "height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-Axis label */}
            <span className="text-[9px] text-slate-400 mt-2 font-mono text-center truncate w-full" title={point.group}>
              {point.group}
            </span>
          </div>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{
              left: `${Math.min(tooltip.x, 260)}px`,
              top: `${Math.max(0, tooltip.y - 8)}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 shadow-2xl text-[11px] font-mono min-w-[160px] space-y-1.5">
              <div className="text-slate-300 font-bold border-b border-slate-800 pb-1.5 mb-1">
                Division: {tooltip.point.group}
              </div>
              {series.map(s => (
                <div key={s.key} className="flex justify-between items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="text-slate-400">{s.label}</span>
                  </span>
                  <span className="font-bold text-white">{fmt(tooltip.point.values[s.key] ?? 0)}</span>
                </div>
              ))}
              {/* Difference row */}
              {series.length === 2 && (() => {
                const diff = (tooltip.point.values[series[0].key] ?? 0) - (tooltip.point.values[series[1].key] ?? 0);
                return (
                  <div className="flex justify-between items-center gap-4 border-t border-slate-800 pt-1.5 mt-0.5">
                    <span className="text-slate-500">Difference</span>
                    <span className={`font-bold ${diff < 0 ? "text-rose-400" : diff > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                      {diff > 0 ? "+" : ""}{fmt(diff)}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface DivisionRankingItem {
  name: string;
  score: number;
  displayValue: string;
  metricLabel: string;
  varianceValue: number;
}

interface DivisionRankingListProps {
  data: DivisionRankingItem[];
  title: string;
  subtitle?: string;
}

function DivisionRankingList({ data, title, subtitle }: DivisionRankingListProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5 space-y-4">
      <div>
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="divide-y divide-slate-850">
        {data.map((item, idx) => (
          <div key={idx} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-extrabold text-indigo-400 font-mono w-4">#{idx + 1}</span>
              <div>
                <span className="text-xs font-bold text-white block">{item.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Variance: <span className={item.varianceValue < 0 ? "text-rose-455 font-semibold" : item.varianceValue > 0 ? "text-cyan-400 font-semibold" : "text-slate-500"}>
                    {item.varianceValue < 0 ? "-" : item.varianceValue > 0 ? "+" : ""}SAR {Math.abs(item.varianceValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold text-emerald-400 font-mono block">{item.displayValue}</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">{item.metricLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// MAIN INVENTORY DASHBOARD PORTAL
// ==========================================

export default function InventoryDashboard() {
  const id = useReportId();

  const [report, setReport] = useState<Report | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [agingRecords, setAgingRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layout View Tabs
  const [activeView, setActiveView] = useState<
    "overview" | "operations" | "suppliers" | "team" | "risk" | "ledger"
  >("overview");

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Ledger Table State
  const [activeTab, setActiveTab] = useState<"discrepancies" | "pending">("discrepancies");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(15);

  // Ledger Sorting State
  const [sortField, setSortField] = useState<string>("absoluteVarianceValue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filters State
  const [selectedSupplier, setSelectedSupplier] = useState<string>("All Suppliers");
  const [selectedOrg, setSelectedOrg] = useState<string>("All Organizations");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Issue Categories");
  const [selectedStatus, setSelectedStatus] = useState<string>("All Statuses");
  const [selectedRisk, setSelectedRisk] = useState<string>("All Risk Levels");
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");

  // Supplier Table sorting/filtering
  const [supplierSortField, setSupplierSortField] = useState<string>("absoluteVarianceValue");
  const [supplierSortDirection, setSupplierSortDirection] = useState<"asc" | "desc">("desc");
  const [supplierColumnFilters, setSupplierColumnFilters] = useState({
    name: "",
    minItems: "",
    minErpValue: "",
    minCoverage: "",
    minAbsVariance: "",
    minMatchRate: ""
  });

  const fetchReportAndItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, "reports", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const reportData = docSnap.data() as Report;
        setReport(reportData);

        // Update highest step reached on database if it's less than 3
        const currentHighest = getHighestStep(reportData);
        if (currentHighest < 3) {
          await setDoc(docRef, {
            highestStepReached: 3,
            updatedAt: new Date()
          }, { merge: true });
        }

        if (reportData.status?.toLowerCase() !== "draft") {
          // Fetch inventoryItems and agingData concurrently for faster loading
          const itemsCol = collection(db, "reports", id, "inventoryItems");
          const agingCol = collection(db, "reports", id, "agingData");
          const [querySnap, agingSnap] = await Promise.all([
            getDocs(itemsCol),
            getDocs(agingCol)
          ]);

          // Process inventory items
          const loadedItems: InventoryItem[] = [];
          querySnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.items && Array.isArray(data.items)) {
              data.items.forEach((item: any) => {
                loadedItems.push({
                  id: item.id || docSnap.id,
                  ...item,
                  // Fallback mapping for erpQty & physicalQty compatibility
                  erpQty: item.systemOnHand !== undefined ? item.systemOnHand : (item.erpQty || 0),
                  physicalQty: item.physicalCount !== undefined ? item.physicalCount : (item.physicalQty || 0),
                } as any);
              });
            } else {
              loadedItems.push({
                id: docSnap.id,
                ...data,
                // Fallback mapping for erpQty & physicalQty compatibility
                erpQty: data.systemOnHand !== undefined ? data.systemOnHand : (data.erpQty || 0),
                physicalQty: data.physicalCount !== undefined ? data.physicalCount : (data.physicalQty || 0),
              } as any);
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
        }
      } else {
        setError("Report session not found.");
      }
    } catch (err: any) {
      console.error("Error fetching report details:", err);
      setError("Could not retrieve report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id || id === "placeholder") return;
    fetchReportAndItems();
  }, [id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReportAndItems();
    setRefreshing(false);
  };

  // Reset page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSupplier, selectedOrg, selectedCategory, selectedStatus, selectedRisk, searchQuery, activeTab, sortField, sortDirection]);

  // Handle Locked State
  const isLocked = report?.status?.toLowerCase() === "draft";

  // Cache formatted / computed items to ensure matching calculations
  const computedItems = useMemo(() => {
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
        status: (item.status as any) || "open",
        validationWarnings: item.validationWarnings || []
      };
    });
  }, [items]);

  // Cache dashboard calculations metrics
  const metrics = useMemo(() => {
    return computeDashboardMetrics(computedItems as any, agingRecords);
  }, [computedItems, agingRecords]);

  // Processed, filtered, and sorted supplier list
  const processedSuppliers = useMemo(() => {
    if (!metrics?.suppliers) return [];
    
    // 1. Filter
    let result = metrics.suppliers.filter(sup => {
      if (supplierColumnFilters.name && !sup.supplier.toLowerCase().includes(supplierColumnFilters.name.toLowerCase())) {
        return false;
      }
      if (supplierColumnFilters.minItems) {
        const val = parseInt(supplierColumnFilters.minItems, 10);
        if (!isNaN(val) && sup.itemCount < val) return false;
      }
      if (supplierColumnFilters.minErpValue) {
        const val = parseFloat(supplierColumnFilters.minErpValue);
        if (!isNaN(val) && sup.erpValue < val) return false;
      }
      if (supplierColumnFilters.minCoverage) {
        const val = parseFloat(supplierColumnFilters.minCoverage);
        if (!isNaN(val) && sup.coverageRate < val) return false;
      }
      if (supplierColumnFilters.minAbsVariance) {
        const val = parseFloat(supplierColumnFilters.minAbsVariance);
        if (!isNaN(val) && sup.absoluteVarianceValue < val) return false;
      }
      if (supplierColumnFilters.minMatchRate) {
        const val = parseFloat(supplierColumnFilters.minMatchRate);
        if (!isNaN(val) && sup.matchingRate < val) return false;
      }
      if (supplierSearchQuery && !sup.supplier.toLowerCase().includes(supplierSearchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });

    // 2. Sort
    result.sort((a, b) => {
      let aVal = a[supplierSortField as keyof typeof a];
      let bVal = b[supplierSortField as keyof typeof b];

      if (typeof aVal === "string" || typeof bVal === "string") {
        aVal = String(aVal || "").toLowerCase();
        bVal = String(bVal || "").toLowerCase();
      }

      if (aVal < bVal) return supplierSortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return supplierSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [metrics?.suppliers, supplierColumnFilters, supplierSearchQuery, supplierSortField, supplierSortDirection]);

  // Distinct High-Risk items (deduplicated by itemCode & org before slicing to prevent duplicates)
  const highestRiskItemsDistinct = useMemo(() => {
    const sorted = [...computedItems].sort((a, b) => b.absoluteVarianceValue - a.absoluteVarianceValue);
    const seenKeys = new Set();
    const unique = [];
    for (const item of sorted) {
      const key = `${item.itemCode}-${item.org}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        unique.push(item);
      }
      if (unique.length >= 10) break;
    }
    return unique;
  }, [computedItems]);

  // Per-division Physical Count vs System On Hand quantity aggregation
  // Pure aggregation of existing fields — no new calculations.
  const divisionQtyData = useMemo(() => {
    const map: Record<string, { physicalCount: number; systemOnHand: number }> = {};
    for (const item of computedItems) {
      const div = (item.org || "Others").trim();
      if (!map[div]) map[div] = { physicalCount: 0, systemOnHand: 0 };
      map[div].physicalCount += item.physicalQty ?? 0;
      map[div].systemOnHand += item.erpQty ?? 0;
    }
    // Sort by systemOnHand descending (mirrors the division sort order)
    return Object.entries(map)
      .map(([group, vals]) => ({ group, values: { physicalCount: vals.physicalCount, systemOnHand: vals.systemOnHand } }))
      .sort((a, b) => b.values.systemOnHand - a.values.systemOnHand);
  }, [computedItems]);

  const matchRateVal = computedItems.length > 0
    ? (computedItems.filter(item => item.erpQty === item.physicalQty).length / computedItems.length) * 100
    : 100;

  const shortageRateVal = computedItems.length > 0
    ? (computedItems.filter(item => item.physicalQty < item.erpQty).length / computedItems.length) * 100
    : 0;

  const excessRateVal = computedItems.length > 0
    ? (computedItems.filter(item => item.physicalQty > item.erpQty).length / computedItems.length) * 100
    : 0;

  // Derive unique suppliers and organizations from loaded items
  const uniqueSuppliers = useMemo(() => {
    return Array.from(
      new Set(
        computedItems
          .map((item) => item.supplierName || item.detectedSupplierName || item.supplier)
          .filter(Boolean)
      )
    ).sort() as string[];
  }, [computedItems]);

  const uniqueOrgs = useMemo(() => {
    return Array.from(
      new Set(computedItems.map((item) => item.org).filter(Boolean))
    ).sort() as string[];
  }, [computedItems]);

  const getRiskLabel = (val: number) => {
    if (val >= 5000) return { label: "High Risk", classes: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    if (val >= 1000) return { label: "Medium Risk", classes: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
    return { label: "Low Risk", classes: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" };
  };

  // Apply filters in memory for Ledger tab
  const filteredItems = useMemo(() => {
    return computedItems.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (item.itemCode || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const supp = (item.supplierName || item.detectedSupplierName || item.supplier || "").toLowerCase();
        const o = (item.org || "").toLowerCase();
        const riskLabel = getRiskLabel(item.absoluteVarianceValue || 0).label.toLowerCase();
        const varianceValStr = (item.varianceValue || 0).toString();
        const diffQtyStr = (item.differenceQty || 0).toString();

        if (
          !code.includes(q) &&
          !desc.includes(q) &&
          !supp.includes(q) &&
          !o.includes(q) &&
          !riskLabel.includes(q) &&
          !varianceValStr.includes(q) &&
          !diffQtyStr.includes(q)
        ) {
          return false;
        }
      }

      if (selectedSupplier !== "All Suppliers") {
        const supplierName = item.supplierName || item.detectedSupplierName || item.supplier || "";
        if (supplierName.toLowerCase() !== selectedSupplier.toLowerCase()) {
          return false;
        }
      }

      if (selectedOrg !== "All Organizations") {
        const org = item.org || "";
        if (org.toLowerCase() !== selectedOrg.toLowerCase()) {
          return false;
        }
      }

      if (selectedCategory !== "All Issue Categories") {
        if (selectedCategory === "Shortage (Negative Variance)" && item.differenceQty >= 0) {
          return false;
        }
        if (selectedCategory === "Excess (Positive Variance)" && item.differenceQty <= 0) {
          return false;
        }
        if (selectedCategory === "Match (Zero Variance)" && item.differenceQty !== 0) {
          return false;
        }
      }

      if (selectedStatus !== "All Statuses") {
        const status = item.status || "open";
        if (selectedStatus === "Open" && status !== "open") {
          return false;
        }
        if (selectedStatus === "Closed" && status !== "closed") {
          return false;
        }
      }

      if (selectedRisk !== "All Risk Levels") {
        const val = item.absoluteVarianceValue || 0;
        if (selectedRisk === "High Risk (>= 5,000 SAR)" && val < 5000) {
          return false;
        }
        if (selectedRisk === "Medium Risk (1,000 - 4,999 SAR)" && (val < 1000 || val >= 5000)) {
          return false;
        }
        if (selectedRisk === "Low Risk (< 1,000 SAR)" && val >= 1000) {
          return false;
        }
      }

      return true;
    });
  }, [computedItems, searchQuery, selectedSupplier, selectedOrg, selectedCategory, selectedStatus, selectedRisk]);

  const displayItems = useMemo(() => {
    return activeTab === "pending" 
      ? filteredItems.filter(item => item.status !== "closed")
      : filteredItems;
  }, [filteredItems, activeTab]);

  // Sort displayItems in memory
  const sortedDisplayItems = useMemo(() => {
    return [...displayItems].sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";

      if (sortField === "itemCode") {
        aVal = a.itemCode || "";
        bVal = b.itemCode || "";
      } else if (sortField === "description") {
        aVal = a.description || "";
        bVal = b.description || "";
      } else if (sortField === "supplier") {
        aVal = a.supplierName || a.detectedSupplierName || a.supplier || "";
        bVal = b.supplierName || b.detectedSupplierName || b.supplier || "";
      } else if (sortField === "org") {
        aVal = a.org || "";
        bVal = b.org || "";
      } else if (sortField === "erpQty") {
        aVal = a.erpQty || 0;
        bVal = b.erpQty || 0;
      } else if (sortField === "physicalQty") {
        aVal = a.physicalQty || 0;
        bVal = b.physicalQty || 0;
      } else if (sortField === "differenceQty") {
        aVal = a.differenceQty || 0;
        bVal = b.differenceQty || 0;
      } else if (sortField === "unitCost") {
        aVal = a.unitCost || 0;
        bVal = b.unitCost || 0;
      } else if (sortField === "varianceValue") {
        aVal = a.varianceValue || 0;
        bVal = b.varianceValue || 0;
      } else if (sortField === "absoluteVarianceValue") {
        aVal = a.absoluteVarianceValue || 0;
        bVal = b.absoluteVarianceValue || 0;
      } else if (sortField === "status") {
        aVal = a.status || "";
        bVal = b.status || "";
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortDirection === "asc"
          ? (aVal > bVal ? 1 : -1)
          : (bVal > aVal ? 1 : -1);
      }
    });
  }, [displayItems, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedDisplayItems.length / rowsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    return sortedDisplayItems.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );
  }, [sortedDisplayItems, currentPage, rowsPerPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <SlidersHorizontal className="h-3 w-3 opacity-30 flex-shrink-0" />;
    return sortDirection === "asc" 
      ? <TrendingUp className="h-3 w-3 text-indigo-400 flex-shrink-0" /> 
      : <TrendingDown className="h-3 w-3 text-indigo-400 flex-shrink-0" />;
  };

  const handleSupplierSort = (field: string) => {
    if (supplierSortField === field) {
      setSupplierSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSupplierSortField(field);
      setSupplierSortDirection("desc");
    }
  };

  const renderSupplierSortIcon = (field: string) => {
    if (supplierSortField !== field) return <SlidersHorizontal className="h-3 w-3 opacity-30 flex-shrink-0" />;
    return supplierSortDirection === "asc" 
      ? <TrendingUp className="h-3 w-3 text-indigo-400 flex-shrink-0" /> 
      : <TrendingDown className="h-3 w-3 text-indigo-400 flex-shrink-0" />;
  };

  if (isLocked) {
    return (
      <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <Link
            href="/reports"
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Status</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-8 text-center py-16 space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <Lock className="h-7 w-7" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-bold text-slate-200">Dashboard Locked</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              This inventory dashboard and variance analytics are locked until the parsed spreadsheet rows have been reviewed and approved in the validation workspace.
            </p>
          </div>

          <div className="pt-4">
            <Link
              href={`/reports/${id}/validate`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-500/10 cursor-pointer"
            >
              <Unlock className="h-4 w-4" />
              Go to Validation Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: "overview", label: "Executive Overview", icon: Award },
    { id: "operations", label: "Division Performance", icon: Building },
    { id: "suppliers", label: "Supplier Performance", icon: TruckIcon },
    { id: "team", label: "Team Leaderboard", icon: Users },
    { id: "risk", label: "Financial Risk", icon: AlertCircle },
    { id: "ledger", label: "Item Ledger", icon: FileText },
  ];

  function TruckIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 18H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10" />
        <path d="M14 2h1a2 2 0 0 1 2 2v4a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3" />
        <circle cx="7.5" cy="18.5" r="2.5" />
        <circle cx="16.5" cy="18.5" r="2.5" />
      </svg>
    );
  }

  const overviewKpis = [
    { title: "Total Inventory Value", value: `SAR ${metrics.totalInventoryValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, desc: "Gross asset valuation under audit", color: "text-slate-100", border: "border-l-indigo-500" },
    { title: "Verified Value", value: `SAR ${metrics.verifiedValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, desc: `Asset value physical confirmed (${metrics.coverageRate.toFixed(1)}%)`, color: "text-emerald-400", border: "border-l-emerald-500" },
    { title: "Total Financial Risk", value: `SAR ${metrics.totalFinancialRisk.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, desc: "Sum of absolute variances", color: "text-rose-400", border: "border-l-rose-500" },
    { title: "Accuracy Match Rate", value: `${matchRateVal.toFixed(1)}%`, desc: "Percentage of zero-variance line items", color: "text-violet-400", border: "border-l-violet-500" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900 pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/reports"
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              {report?.quarter} {report?.year} Cycle
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
              Executive Inventory Portal: {report?.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer"
            title="Refresh calculations"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Link
            href={`/reports/${id}/pre-report`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-500/10 cursor-pointer"
          >
            Proceed to Pre-Report
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Progress Steps Component */}
      <div className="grid grid-cols-5 gap-2 sm:gap-4 max-w-3xl mx-auto border-b border-slate-850 pb-4 w-full">
        {[
          { number: 1, label: "Upload Excel", path: "upload" },
          { number: 2, label: "Validate Data", path: "validate" },
          { number: 3, label: "Dashboard", path: "dashboard" },
          { number: 4, label: "Pre-Report", path: "pre-report" },
          { number: 5, label: "Report PDF", path: "builder" }
        ].map((step) => {
          const isCurrent = step.number === 3;
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

      {/* Sidebar and Content Panel Layout */}
      <div className={`grid grid-cols-1 gap-8 transition-all duration-300 ${
        isSidebarCollapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[240px_1fr]"
      }`}>
        
        {/* Left Side Navigation Panel */}
        <div className="flex flex-col">
          <div className={`flex items-center justify-between px-3 mb-3 ${
            isSidebarCollapsed ? "lg:flex-col lg:gap-2 lg:px-0" : ""
          }`}>
            <span className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all duration-300 ${
              isSidebarCollapsed ? "lg:hidden" : "block"
            }`}>
              Dashboard Sections
            </span>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg border border-slate-800 bg-[#0c0e15]/40 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors flex items-center justify-center cursor-pointer"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          <div className={`flex flex-row lg:flex-col gap-1 overflow-x-auto pb-3 lg:pb-0 scrollbar-thin ${
            isSidebarCollapsed ? "lg:items-center" : ""
          }`}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as any)}
                  className={`flex items-center rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-indigo-600/10 border-l-2 border-indigo-500 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                  } ${
                    isSidebarCollapsed
                      ? "px-3 py-2.5 lg:px-0 lg:py-3 lg:w-12 lg:justify-center lg:gap-0"
                      : "px-3 py-2.5 gap-3"
                  }`}
                  title={item.label}
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                  <span className={`transition-all duration-300 ${
                    isSidebarCollapsed ? "block lg:hidden" : "block"
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side Content Panel */}
        <div className="space-y-6 min-w-0">
          
          {/* VIEW: OVERVIEW */}
          {activeView === "overview" && (
            <div className="space-y-6">
              {/* Insight Brief */}
              <SectionInsightBrief
                whatHappened={`Reconciliation of system records vs. physical counts covers ${metrics.totalLines.toLocaleString()} catalog line items.`}
                whereItHappened="Audited across all active organizational cost divisions and workbook sheets."
                whyImportant={`Derived overall health score of ${metrics.inventoryHealthScore}/100 based on verified value coverage (${metrics.coverageRate.toFixed(1)}%) and financial risk metrics.`}
              />

              {/* Executive Summary Panel */}
              <ExecutiveSummaryPanel metrics={metrics} matchRateVal={matchRateVal} />

              {/* Dashboard Terminology & Glossary Card */}
              <DashboardGlossary />

              {/* Executive Overview KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {overviewKpis.map((kpi, idx) => (
                  <div key={idx} className={`rounded-xl border border-slate-800/80 border-l-4 ${kpi.border} bg-slate-950/20 p-5 flex flex-col justify-between hover:bg-slate-950/30 transition-all`}>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{kpi.title}</span>
                    <div className="mt-2.5">
                      <p className={`text-xl font-extrabold tracking-tight ${kpi.color}`}>{kpi.value}</p>
                      <p className="mt-1 text-[10px] text-slate-400 leading-normal">{kpi.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Guages & Rings Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-slate-800/80 bg-slate-950/20 relative overflow-hidden h-full">
                    <NotchedRadialGauge score={metrics.inventoryHealthScore} />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <BKLitAccuracyDonutChart
                    title="Accuracy Breakdown"
                    subtitle="Percentage of verified line items by discrepancy category"
                    data={[
                      { label: "Matches (Zero Variance)", value: matchRateVal, color: "#10b981" },
                      { label: "Shortage (Negative Variance)", value: shortageRateVal, color: "#ef4444" },
                      { label: "Excess (Positive Variance)", value: excessRateVal, color: "#60a5fa" }
                    ]}
                  />
                </div>
              </div>

              {/* Extra Executive Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SVGHorizontalBarChart
                  title="Division Coverage Rate"
                  subtitle="Verification completion rate by operational cost center"
                  data={metrics.divisions.slice(0, 5).map(div => ({
                    label: div.division,
                    value: div.coverageRate,
                    displayValue: `${div.coverageRate.toFixed(1)}%`,
                    color: div.coverageRate >= 95 ? "#10b981" : div.coverageRate >= 80 ? "#6366f1" : "#f59e0b"
                  }))}
                />

                <SVGHorizontalBarChart
                  title="Top 5 Suppliers by absolute variance"
                  subtitle="Suppliers associated with highest absolute financial risk"
                  data={metrics.suppliers.filter(sup => sup.absoluteVarianceValue > 0).slice(0, 5).map(sup => ({
                    label: sup.supplier,
                    value: sup.absoluteVarianceValue,
                    displayValue: `SAR ${sup.absoluteVarianceValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                    color: "#ef4444"
                  }))}
                />
              </div>

              {/* Stock Count Progress Status Card */}
              <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Stock Count Performance</h3>
                    <p className="text-[11px] text-slate-500">Progress rate of physical item verification lines.</p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                    {metrics.coverageRate.toFixed(1)}% Covered
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 justify-center flex flex-col">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Verified Count Lines</span>
                      <span className="font-mono text-slate-200 font-bold">
                        {metrics.verifiedLines.toLocaleString()} / {metrics.totalLines.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900/60 h-3 rounded-full border border-slate-850 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(metrics.verifiedLines / metrics.totalLines) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Remaining: {metrics.remainingLines.toLocaleString()} lines</span>
                      <span>Rate: {((metrics.verifiedLines / metrics.totalLines) * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-900 space-y-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Verification Analysis</span>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      Physical inventory audit has covered <strong>{metrics.verifiedLines.toLocaleString()}</strong> unique catalog entries out of <strong>{metrics.totalLines.toLocaleString()}</strong>. Total quantities verified reach <strong>{metrics.verifiedQuantity.toLocaleString()}</strong> units out of <strong>{metrics.totalQuantity.toLocaleString()}</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* External Audit Opinion Card */}
              <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">External Audit Opinion</h3>
                    <p className="text-[10px] text-slate-500">Official evaluation according to compliance frameworks.</p>
                  </div>
                </div>
                
                <div className="border border-slate-850/80 rounded-lg p-4 bg-slate-950/60 flex flex-col md:flex-row items-center gap-4 justify-between">
                  <div className="space-y-1.5 flex-1 text-center md:text-left">
                    <span className="text-[9px] font-mono text-slate-500 uppercase">CONCLUSION STATUS</span>
                    <p className="text-xs font-bold text-slate-200">{metrics.auditConclusion}</p>
                    <div className="flex justify-center md:justify-start gap-4 text-[10px] text-slate-500 mt-2 font-mono">
                      <span>Sample Size: <strong>{metrics.sampleCount}</strong></span>
                      <span>•</span>
                      <span>Audited coverage: <strong>{metrics.auditCoverageRate.toFixed(1)}%</strong></span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-800 bg-slate-900/40 w-full md:w-36 text-center">
                    <Award className="h-6 w-6 text-indigo-400 mb-1" />
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">OPINION LEVEL</span>
                    <span className="text-xs font-extrabold text-white mt-1">
                      {metrics.coverageRate >= 98 && metrics.totalFinancialRisk / metrics.totalInventoryValue < 0.02 ? "UNQUALIFIED" : "QUALIFIED"}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* VIEW: OPERATIONS (DIVISIONS & SHEETS) */}
          {activeView === "operations" && (
            <div className="space-y-6">
              {/* Insight Brief */}
              <SectionInsightBrief
                whatHappened={`Reconciliation performance audit across ${metrics.divisions.length} distinct organizational divisions.`}
                whereItHappened="Grouped based on item organization cost codes (INS, GMT, etc.) and original Excel sheets."
                whyImportant="Identifies divisions with verification coverage gaps or net adjustment risks to guide operational remediation."
              />

              {/* Division KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Divisions</span>
                  <p className="text-2xl font-extrabold text-white mt-1">{metrics.divisions.length}</p>
                  <p className="text-[10px] text-slate-450 mt-1">Active cost centers under audit</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Highest Coverage</span>
                  <p className="text-xl font-extrabold text-emerald-400 mt-1 truncate" title={metrics.divisions[0]?.division}>
                    {metrics.divisions[0]?.division || "N/A"}
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1">({metrics.divisions[0]?.coverageRate.toFixed(1) || 0}% verified)</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-rose-400 uppercase block">Highest Risk Division</span>
                  <p className="text-xl font-extrabold text-rose-400 mt-1 truncate" title={metrics.highestRiskDivision}>
                    {metrics.highestRiskDivision}
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1">Highest variance cost center</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Net Ops Variance</span>
                  <p className={`text-xl font-extrabold mt-1 ${metrics.varianceValue < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {metrics.varianceValue < 0 ? "-" : "+"}SAR {Math.abs(metrics.varianceValue).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1">Total operational variance</p>
                </div>
              </div>

              {/* Division summaries horizontal & vertical bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <SVGHorizontalBarChart
                  title="Division Verification Rates"
                  subtitle="Percentage of ERP ledger value verified physically"
                  data={metrics.divisions.map((div) => ({
                    label: div.division,
                    value: div.coverageRate,
                    displayValue: `${div.coverageRate.toFixed(1)}%`,
                    color: div.coverageRate >= 95 ? "#10b981" : div.coverageRate >= 80 ? "#6366f1" : "#f43f5e"
                  }))}
                />

                <div className="flex flex-col gap-6">
                  <SVGVerticalBarChart
                    title="Division Items Mapped"
                    subtitle="Total item catalog counts under cost centers"
                    data={metrics.divisions.map((div) => ({
                      label: div.division,
                      value: div.itemCount,
                      displayValue: `${div.itemCount.toLocaleString()} items`,
                      color: "#6366f1"
                    }))}
                  />

                  {/* Division Insights & Risk Analysis */}
                  <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 p-5 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Division Insights & Risks</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Summary statistics and variance risks by organizational cost centers</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-850 bg-slate-950/40 p-3 text-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase block">Perfect Coverage</span>
                        <span className="text-sm font-extrabold text-emerald-400 mt-1 block">
                          {metrics.divisions.filter(d => d.coverageRate >= 100).length} / {metrics.divisions.length}
                        </span>
                        <span className="text-[8px] text-slate-500 block mt-0.5">Divisions @ 100%</span>
                      </div>

                      <div className="rounded-lg border border-slate-850 bg-slate-950/40 p-3 text-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase block">Highest Volume</span>
                        <span className="text-sm font-extrabold text-indigo-400 mt-1 block truncate" title={[...metrics.divisions].sort((a,b) => b.itemCount - a.itemCount)[0]?.division || ""}>
                          {[...metrics.divisions].sort((a,b) => b.itemCount - a.itemCount)[0]?.division || "N/A"}
                        </span>
                        <span className="text-[8px] text-slate-500 block mt-0.5">
                          {([...metrics.divisions].sort((a,b) => b.itemCount - a.itemCount)[0]?.itemCount || 0).toLocaleString()} items
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-850 bg-slate-950/40 p-3 text-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase block">Highest Risk</span>
                        <span className="text-sm font-extrabold text-rose-400 mt-1 block truncate" title={[...metrics.divisions].sort((a,b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue))[0]?.division || ""}>
                          {[...metrics.divisions].sort((a,b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue))[0]?.division || "N/A"}
                        </span>
                        <span className="text-[8px] text-slate-500 block mt-0.5">
                          SAR {Math.abs([...metrics.divisions].sort((a,b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue))[0]?.varianceValue || 0).toLocaleString(undefined, {maximumFractionDigits:0})}
                        </span>
                      </div>
                    </div>

                    {/* Top Discrepancies Table */}
                    <div className="border border-slate-850 rounded-lg overflow-hidden bg-slate-950/20">
                      <div className="bg-slate-900/40 px-3 py-2 border-b border-slate-850">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Top 3 Variance Divisions</span>
                      </div>
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-500 bg-slate-950/30 font-semibold uppercase">
                            <th className="px-3 py-1.5">Division</th>
                            <th className="px-3 py-1.5 text-right">Items</th>
                            <th className="px-3 py-1.5 text-right">Coverage</th>
                            <th className="px-3 py-1.5 text-right">Net Variance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/60">
                          {[...metrics.divisions]
                            .sort((a,b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue))
                            .slice(0, 3)
                            .map((div, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/20 text-slate-300 font-mono">
                                <td className="px-3 py-2 font-bold text-slate-200">{div.division}</td>
                                <td className="px-3 py-2 text-right">{div.itemCount.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right">
                                  <span className={div.coverageRate >= 98 ? "text-emerald-400" : div.coverageRate >= 90 ? "text-indigo-400" : "text-rose-400"}>
                                    {div.coverageRate.toFixed(1)}%
                                  </span>
                                </td>
                                <td className={`px-3 py-2 text-right font-semibold ${div.varianceValue < 0 ? "text-rose-400" : div.varianceValue > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                                  {div.varianceValue < 0 ? "-" : div.varianceValue > 0 ? "+" : ""}SAR {Math.abs(div.varianceValue).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-division sheet performance table */}
              <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 overflow-hidden">
                <div className="p-6 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sub-Division Workbook Sheet Analysis</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Ingested workbook worksheet performance statistics.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="p-4">Sheet Name</th>
                        <th className="p-4 text-center">Items Count</th>
                        <th className="p-4 text-right">ERP Value</th>
                        <th className="p-4 text-right">Verified Value</th>
                        <th className="p-4 text-right">Coverage Rate</th>
                        <th className="p-4 text-right">Net Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 text-slate-300 font-mono">
                      {metrics.subDivisions.map((sub, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/10">
                          <td className="p-4 font-sans font-bold text-slate-200">{sub.subDivision}</td>
                          <td className="p-4 text-center text-slate-450">{sub.itemCount}</td>
                          <td className="p-4 text-right text-slate-450">SAR {sub.erpValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                          <td className="p-4 text-right text-slate-450">SAR {sub.verifiedValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                          <td className="p-4 text-right">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              sub.coverageRate >= 95 ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                            }`}>{sub.coverageRate}%</span>
                          </td>
                          <td className={`p-4 text-right font-extrabold ${
                            sub.varianceValue < 0 ? "text-rose-450" : sub.varianceValue > 0 ? "text-cyan-400" : "text-slate-500"
                          }`}>
                            {sub.varianceValue < 0 ? "-" : sub.varianceValue > 0 ? "+" : ""}SAR {Math.abs(sub.varianceValue).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Physical Count vs System On Hand by Division */}
              <BKLitGroupedBarChart
                title="Physical Count vs System On Hand by Division"
                subtitle="Comparison of ERP System Quantity and Physically Counted Quantity across all operational divisions."
                data={divisionQtyData}
                series={[
                  { key: "physicalCount", label: "Physical Count", color: "#10b981" },
                  { key: "systemOnHand",  label: "System On Hand",  color: "#60a5fa" },
                ]}
                height={260}
              />

            </div>
          )}

          {/* VIEW: SUPPLIERS */}
          {activeView === "suppliers" && (
            <div className="space-y-6">
              {/* Insight Brief */}
              <SectionInsightBrief
                whatHappened={`Audit reconciliations mapped across ${metrics.suppliers.length} resolved supplier entities.`}
                whereItHappened="Discrepancy levels tracked by grouping parsed rows to supplier names."
                whyImportant="Enables vendor delivery auditing, contract review, and identification of supply chains with material risk."
              />

              {/* Suppliers KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Mapped Suppliers</span>
                  <p className="text-2xl font-extrabold text-white mt-1">{metrics.suppliers.length}</p>
                  <p className="text-[10px] text-slate-450 mt-1">Resolved suppliers in file</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-rose-400 uppercase block">Top Exposure Supplier</span>
                  <p className="text-xl font-extrabold text-rose-400 mt-1 truncate" title={metrics.highestRiskSupplier}>
                    {metrics.highestRiskSupplier}
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1">Supplier with highest variance</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Supplier Abs Variance</span>
                  <p className="text-xl font-extrabold text-slate-200 mt-1">
                    SAR {metrics.suppliers.reduce((sum, s) => sum + s.absoluteVarianceValue, 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1">Total supplier absolute risk</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Average Match Rate</span>
                  <p className="text-2xl font-extrabold text-indigo-400 mt-1">
                    {((metrics.suppliers.reduce((sum, s) => sum + s.matchedCount, 0) / (metrics.suppliers.reduce((sum, s) => sum + s.itemCount, 0) || 1)) * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1">Average supplier line matching</p>
                </div>
              </div>

              {/* Supplier performance overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SVGHorizontalBarChart
                  title="Top Suppliers by Absolute Variance"
                  subtitle="Highest absolute financial risk associated with suppliers"
                  data={metrics.suppliers.filter(sup => sup.absoluteVarianceValue > 0).slice(0, 5).map(sup => ({
                    label: sup.supplier,
                    value: sup.absoluteVarianceValue,
                    displayValue: `SAR ${sup.absoluteVarianceValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                    color: "#ef4444"
                  }))}
                />

                <BKLitSupplierDonutChart
                  title="Variance Share of Top Suppliers"
                  subtitle="Top suppliers share of absolute variance risk"
                  isCurrency={true}
                  data={[
                    { label: metrics.suppliers[0]?.supplier || "Supplier 1", value: metrics.suppliers[0]?.absoluteVarianceValue || 0, color: "#ef4444" },
                    { label: metrics.suppliers[1]?.supplier || "Supplier 2", value: metrics.suppliers[1]?.absoluteVarianceValue || 0, color: "#f59e0b" },
                    { label: metrics.suppliers[2]?.supplier || "Supplier 3", value: metrics.suppliers[2]?.absoluteVarianceValue || 0, color: "#3b82f6" },
                    { label: "All Others", value: Math.max(0, metrics.suppliers.slice(3).reduce((sum, s) => sum + s.absoluteVarianceValue, 0)), color: "#6b7280" }
                  ]}
                />
              </div>

              {/* Complete supplier table */}
              <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 overflow-hidden">
                <div className="p-6 border-b border-slate-850 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">All Suppliers Breakdown</h3>
                    <p className="text-[11px] text-slate-500 mt-1">Detailed inventory analytics for all resolved supplier entities.</p>
                  </div>
                  <div>
                    {(supplierColumnFilters.name ||
                      supplierColumnFilters.minItems ||
                      supplierColumnFilters.minErpValue ||
                      supplierColumnFilters.minCoverage ||
                      supplierColumnFilters.minAbsVariance ||
                      supplierColumnFilters.minMatchRate) && (
                      <button
                        onClick={() => {
                          setSupplierColumnFilters({
                            name: "",
                            minItems: "",
                            minErpValue: "",
                            minCoverage: "",
                            minAbsVariance: "",
                            minMatchRate: ""
                          });
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer whitespace-nowrap bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-500/20"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase tracking-wider font-semibold">
                        <th 
                          onClick={() => handleSupplierSort("supplier")} 
                          className="p-4 cursor-pointer hover:bg-slate-900/40 select-none group transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Supplier Name</span>
                            {renderSupplierSortIcon("supplier")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSupplierSort("itemCount")} 
                          className="p-4 text-center cursor-pointer hover:bg-slate-900/40 select-none group transition-colors"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>Items Count</span>
                            {renderSupplierSortIcon("itemCount")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSupplierSort("erpValue")} 
                          className="p-4 text-right cursor-pointer hover:bg-slate-900/40 select-none group transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span>ERP Value</span>
                            {renderSupplierSortIcon("erpValue")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSupplierSort("coverageRate")} 
                          className="p-4 text-right cursor-pointer hover:bg-slate-900/40 select-none group transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span>Coverage Rate</span>
                            {renderSupplierSortIcon("coverageRate")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSupplierSort("absoluteVarianceValue")} 
                          className="p-4 text-right cursor-pointer hover:bg-slate-900/40 select-none group transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span>Absolute Variance</span>
                            {renderSupplierSortIcon("absoluteVarianceValue")}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSupplierSort("matchingRate")} 
                          className="p-4 text-right cursor-pointer hover:bg-slate-900/40 select-none group transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span>Match Rate</span>
                            {renderSupplierSortIcon("matchingRate")}
                          </div>
                        </th>
                      </tr>
                      {/* Interactive Column-Specific Filters */}
                      <tr className="bg-slate-950/20 border-b border-slate-850/50">
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="Filter name..."
                            value={supplierColumnFilters.name}
                            onChange={(e) => setSupplierColumnFilters(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-slate-900/40 border border-slate-800/80 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans font-normal"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            placeholder="Min count..."
                            value={supplierColumnFilters.minItems}
                            onChange={(e) => setSupplierColumnFilters(prev => ({ ...prev, minItems: e.target.value }))}
                            className="w-24 mx-auto bg-slate-900/40 border border-slate-800/80 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans font-normal text-center"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            placeholder="Min ERP..."
                            value={supplierColumnFilters.minErpValue}
                            onChange={(e) => setSupplierColumnFilters(prev => ({ ...prev, minErpValue: e.target.value }))}
                            className="w-28 ml-auto bg-slate-900/40 border border-slate-800/80 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans font-normal text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            placeholder="Min %..."
                            value={supplierColumnFilters.minCoverage}
                            onChange={(e) => setSupplierColumnFilters(prev => ({ ...prev, minCoverage: e.target.value }))}
                            className="w-20 ml-auto bg-slate-900/40 border border-slate-800/80 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans font-normal text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            placeholder="Min var..."
                            value={supplierColumnFilters.minAbsVariance}
                            onChange={(e) => setSupplierColumnFilters(prev => ({ ...prev, minAbsVariance: e.target.value }))}
                            className="w-28 ml-auto bg-slate-900/40 border border-slate-800/80 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans font-normal text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            placeholder="Min %..."
                            value={supplierColumnFilters.minMatchRate}
                            onChange={(e) => setSupplierColumnFilters(prev => ({ ...prev, minMatchRate: e.target.value }))}
                            className="w-20 ml-auto bg-slate-900/40 border border-slate-800/80 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-sans font-normal text-right"
                          />
                        </td>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 text-slate-300 font-mono">
                      {(() => {
                        if (processedSuppliers.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-500">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                  <Info className="h-5 w-5 text-slate-600" />
                                  <p className="text-xs font-sans">No suppliers matching filter criteria</p>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return processedSuppliers.map((sup, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/10">
                            <td className="p-4 font-sans font-bold text-slate-200 truncate max-w-xs">{sup.supplier}</td>
                            <td className="p-4 text-center text-slate-450">{sup.itemCount}</td>
                            <td className="p-4 text-right text-slate-450">SAR {sup.erpValue.toLocaleString()}</td>
                            <td className="p-4 text-right">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                sup.coverageRate >= 95 ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                              }`}>{sup.coverageRate}%</span>
                            </td>
                            <td className="p-4 text-right font-extrabold text-slate-200">
                              SAR {sup.absoluteVarianceValue.toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-bold text-indigo-400">
                              {sup.matchingRate}%
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* VIEW: TEAM */}
          {activeView === "team" && (
            <div className="space-y-6">
              {/* Insight Brief */}
              <SectionInsightBrief
                whatHappened={`Reconciliation performance tracked for ${metrics.counters.length} active count specialists.`}
                whereItHappened="Physical stock bins and count tags on the warehouse floor."
                whyImportant="Evaluates speed, productivity and accuracy rate per counter to ensure verification process data integrity."
              />

              {/* Team KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Active Counters</span>
                  <p className="text-2xl font-extrabold text-white mt-1">{metrics.counters.length}</p>
                  <p className="text-[10px] text-slate-450 mt-1">Physical counting personnel</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Top Counter (Count Volume)</span>
                  <p className="text-xl font-extrabold text-indigo-400 mt-1 truncate" title={metrics.counters[0]?.name}>
                    {metrics.counters[0]?.name || "N/A"}
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1">({metrics.counters[0]?.itemsCounted || 0} items counted)</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Average Accuracy Rate</span>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                    {((metrics.counters.reduce((sum, c) => sum + c.matchedCount, 0) / (metrics.counters.reduce((sum, c) => sum + c.itemsCounted, 0) || 1)) * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-slate-450 mt-1">Average count matching rate</p>
                </div>
              </div>

              {/* Visuals Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <SVGHorizontalBarChart
                  title="Counter Productivity Profile"
                  subtitle="Share of overall lines counted by counter"
                  data={metrics.counters.map(c => ({
                    label: c.name,
                    value: c.itemsCounted,
                    displayValue: `${c.itemsCounted.toLocaleString()} lines`,
                    color: "#6366f1"
                  }))}
                />

                <SVGVerticalBarChart
                  title="Counter Accuracy Profile"
                  subtitle="Verification count accuracy rating"
                  data={metrics.counters.map(c => ({
                    label: c.name,
                    value: c.accuracyRate,
                    displayValue: `${c.accuracyRate.toFixed(1)}% accuracy`,
                    color: c.accuracyRate >= 95 ? "#10b981" : "#f59e0b"
                  }))}
                />
              </div>

              {/* Leaderboard table */}
              <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 overflow-hidden">
                <div className="p-6 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Physical Count Team Leaderboard</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Verification speed and accuracy performance metrics for field counters.</p>
                </div>

                {metrics.counters.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2 bg-slate-950/10">
                    <Users className="h-8 w-8 text-slate-750 mx-auto" />
                    <p className="text-xs">No individual counter data recorded in files.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase tracking-wider font-semibold">
                          <th className="p-4 text-center">Rank</th>
                          <th className="p-4">Counter Name</th>
                          <th className="p-4 text-center">Items Counted</th>
                          <th className="p-4 text-right">Physical Qty Counted</th>
                          <th className="p-4 text-right">Verified Value</th>
                          <th className="p-4 text-right">Productivity Rate</th>
                          <th className="p-4 text-right">Count Accuracy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 text-slate-300 font-mono">
                        {metrics.counters.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/10">
                          <td className="p-4 text-center font-bold text-indigo-400">{idx + 1}</td>
                            <td className="p-4 font-sans font-bold text-slate-200">{c.name}</td>
                            <td className="p-4 text-center text-slate-450">{c.itemsCounted}</td>
                            <td className="p-4 text-right text-slate-450">{c.verifiedQty.toLocaleString()}</td>
                            <td className="p-4 text-right text-slate-450">SAR {c.verifiedValue.toLocaleString()}</td>
                            <td className="p-4 text-right text-slate-450">{c.productivityRate}%</td>
                            <td className="p-4 text-right">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                c.accuracyRate >= 95 ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                              }`}>{c.accuracyRate}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* VIEW: RISK */}
          {activeView === "risk" && (
            <div className="space-y-6">
              {/* Insight Brief */}
              <SectionInsightBrief
                whatHappened={`Identified absolute financial risk of SAR ${metrics.totalFinancialRisk.toLocaleString()} across ${metrics.totalLines.toLocaleString()} inventory line items.`}
                whereItHappened="Concentrated within high-variance line items across divisions."
                whyImportant="Provides core write-off analysis to proactively isolate high-risk asset records and support financial provisioning decisions."
              />

              {/* Risk metrics header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 p-5 space-y-1">
                  <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wide">Total Absolute Risk</span>
                  <p className="text-xl font-extrabold text-rose-400 font-mono">SAR {metrics.totalFinancialRisk.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-slate-500 leading-normal">Total absolute value variance (shortages + excesses).</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 p-5 space-y-1">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">Total Excess Value</span>
                  <p className="text-xl font-extrabold text-emerald-400 font-mono">SAR {metrics.totalExcessValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-slate-500 leading-normal">Sum of positive variances (surplus stock value).</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 p-5 space-y-1">
                  <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wide">Total Shortage Value</span>
                  <p className="text-xl font-extrabold text-rose-400 font-mono">
                    {metrics.totalShortageValue < 0 ? "-" : ""}SAR {Math.abs(metrics.totalShortageValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-normal">Sum of negative variances (missing stock value).</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 p-5 space-y-1">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide">Net Ops Variance</span>
                  <p className={`text-xl font-extrabold font-mono ${metrics.varianceValue < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {metrics.varianceValue < 0 ? "-" : "+"}SAR {Math.abs(metrics.varianceValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-normal">Excess Value + Shortage Value (net reconciliation).</p>
                </div>
              </div>

              {/* Interactive Visualizations */}
              <div className="grid grid-cols-1 gap-6 items-start">
                <SVGHorizontalBarChart
                  title="Top 5 High-Risk Discrepancy Items"
                  subtitle="Individual stock item records with highest financial risk"
                  data={highestRiskItemsDistinct.slice(0, 5).map(item => ({
                    label: `${item.itemCode} - ${item.description}`,
                    value: item.absoluteVarianceValue,
                    displayValue: `SAR ${item.absoluteVarianceValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                    color: "#f43f5e"
                  }))}
                />
              </div>

              {/* High Risk Items List */}
              <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 overflow-hidden">
                <div className="p-6 border-b border-slate-850">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top 10 High-Risk Discrepancy Items</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Specific item rows that represent the highest financial vulnerability.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="p-4">Item Code & Details</th>
                        <th className="p-4">Supplier</th>
                        <th className="p-4">Organization</th>
                        <th className="p-4 text-right">ERP / Physical</th>
                        <th className="p-4 text-right">Variance Qty</th>
                        <th className="p-4 text-right">Variance Value</th>
                        <th className="p-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 text-slate-300">
                      {highestRiskItemsDistinct.map((item, idx) => {
                        const supplier = item.supplierName || item.detectedSupplierName || "Unknown";
                        return (
                          <tr key={idx} className="hover:bg-slate-900/10">
                            <td className="p-4">
                              <span className="block font-mono font-bold text-slate-200">{item.itemCode || "N/A"}</span>
                              <span className="text-[10px] text-slate-550 block truncate max-w-[240px]" title={item.description}>
                                {item.description}
                              </span>
                            </td>
                            <td className="p-4 text-slate-400 text-xs truncate max-w-[150px]">{supplier}</td>
                            <td className="p-4 text-slate-400 font-mono text-xs">{item.org}</td>
                            <td className="p-4 text-right font-mono text-slate-450">
                              {item.erpQty.toLocaleString()} / <strong>{item.physicalQty.toLocaleString()}</strong>
                            </td>
                            <td className={`p-4 text-right font-mono font-bold ${
                              item.differenceQty < 0 ? "text-rose-400" : "text-cyan-400"
                            }`}>
                              {item.differenceQty > 0 ? "+" : ""}{item.differenceQty.toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono font-extrabold text-rose-455">
                              SAR {item.absoluteVarianceValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                                item.status === "closed" ? "bg-slate-800 text-slate-500" : "bg-rose-500/10 text-rose-400 border border-rose-500/15"
                              }`}>
                                {item.status || "open"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* VIEW: LEDGER (DETAILED ITEM TABLE & FILTERS) */}
          {activeView === "ledger" && (
            <div className="space-y-6">
              {/* Insight Brief */}
              <SectionInsightBrief
                whatHappened={`Displaying detailed reconciliation registry for ${displayItems.length.toLocaleString()} matching items.`}
                whereItHappened="Spanning all worksheets, warehouse cost organizations, and suppliers."
                whyImportant="Provides the ultimate trace utility for individual discrepancies. Supports responsive headers, column sorting, pagination, and multi-field query inputs."
              />

              {/* Ledger Tab KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-850 bg-slate-950/20 p-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Filtered Items</span>
                  <p className="text-xl font-extrabold text-white mt-1">{filteredItems.length.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-slate-850 bg-slate-950/20 p-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Action Required</span>
                  <p className="text-xl font-extrabold text-amber-500 mt-1">
                    {filteredItems.filter(i => i.status !== "closed").length.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-850 bg-slate-950/20 p-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Filtered Abs Risk</span>
                  <p className="text-xl font-extrabold text-rose-400 mt-1">
                    SAR {getFilteredAbsVariance().toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-850 bg-slate-950/20 p-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Filtered Net Variance</span>
                  <p className={`text-xl font-extrabold mt-1 ${getFilteredNetVariance() < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {getFilteredNetVariance() < 0 ? "-" : "+"}SAR {Math.abs(getFilteredNetVariance()).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="rounded-xl border border-slate-850 bg-[#0c0e15]/40 backdrop-blur-md p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-350 uppercase tracking-wider">
                    <Filter className="h-3.5 w-3.5 text-indigo-400" />
                    Display Filters
                  </span>
                  
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:text-slate-650 font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Refreshing..." : "Refresh Engine"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Search bar */}
                  <div className="relative flex items-center lg:col-span-2">
                    <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search code, description, supplier..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-950/80 border border-slate-800 rounded-lg pl-8.5 pr-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 w-full"
                    />
                  </div>

                  {/* Supplier dropdown */}
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option>All Suppliers</option>
                    {uniqueSuppliers.map((sup) => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  {/* Organization dropdown */}
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option>All Organizations</option>
                    {uniqueOrgs.map((org) => (
                      <option key={org} value={org}>{org}</option>
                    ))}
                  </select>

                  {/* Issue category dropdown */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option>All Issue Categories</option>
                    <option>Shortage (Negative Variance)</option>
                    <option>Excess (Positive Variance)</option>
                    <option>Match (Zero Variance)</option>
                  </select>

                  {/* Risk Level dropdown */}
                  <select
                    value={selectedRisk}
                    onChange={(e) => setSelectedRisk(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option>All Risk Levels</option>
                    <option>High Risk (&gt;= 5,000 SAR)</option>
                    <option>Medium Risk (1,000 - 4,999 SAR)</option>
                    <option>Low Risk (&lt; 1,000 SAR)</option>
                  </select>
                </div>

                {/* Filtered View Indicator */}
                {isAnyFilterActive() && (
                  <div className="flex items-center gap-2 border-t border-slate-850/60 pt-3 text-[11px] text-slate-400">
                    <span className="inline-flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
                    <span>
                      Filtered View active: <strong>{filteredItems.length}</strong> items matching. Net Variance of filtered items:{" "}
                      <strong className={getFilteredNetVariance() < 0 ? "text-rose-455" : "text-emerald-400"}>
                        SAR {getFilteredNetVariance().toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </strong>{" "}
                      (Abs: SAR {getFilteredAbsVariance().toLocaleString("en-US", { minimumFractionDigits: 2 })}).
                    </span>
                  </div>
                )}
              </div>

              {/* Data Table */}
              <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 overflow-hidden flex flex-col justify-between">
                
                {/* Tabs Bar */}
                <div className="px-6 border-b border-slate-850 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 sm:pt-0">
                  <div className="flex gap-6">
                    <button
                      onClick={() => setActiveTab("discrepancies")}
                      className={`py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                        activeTab === "discrepancies"
                          ? "border-indigo-500 text-white"
                          : "border-transparent text-slate-500 hover:text-slate-350"
                      }`}
                    >
                      All Discrepancy Items ({filteredItems.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("pending")}
                      className={`py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                        activeTab === "pending"
                          ? "border-indigo-500 text-white"
                          : "border-transparent text-slate-500 hover:text-slate-350"
                      }`}
                    >
                      Items Requiring Action ({filteredItems.filter(i => i.status !== "closed").length})
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase py-2 sm:py-0">
                    Displaying page {currentPage} of {totalPages}
                  </span>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                  {paginatedItems.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 space-y-2">
                      <AlertTriangle className="h-8 w-8 text-slate-750 mx-auto" />
                      <p className="text-xs">No records found matching the active filters or search criteria.</p>
                    </div>
                  ) : activeTab === "discrepancies" ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-[#0b0d16] z-10 shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                        <tr className="border-b border-slate-850 text-slate-400 uppercase tracking-wider font-semibold bg-[#0b0d16]">
                          <th className="p-4">
                            <button onClick={() => handleSort("itemCode")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                              Item Code & Details {renderSortIcon("itemCode")}
                            </button>
                          </th>
                          <th className="p-4">
                            <button onClick={() => handleSort("supplier")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                              Supplier {renderSortIcon("supplier")}
                            </button>
                          </th>
                          <th className="p-4">
                            <button onClick={() => handleSort("org")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                              Org {renderSortIcon("org")}
                            </button>
                          </th>
                          <th className="p-4 text-right font-mono">
                            <div className="flex justify-end gap-1.5 items-center">
                              <button onClick={() => handleSort("erpQty")} className="flex items-center gap-1 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                                ERP {renderSortIcon("erpQty")}
                              </button>
                              <span>/</span>
                              <button onClick={() => handleSort("physicalQty")} className="flex items-center gap-1 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                                Phys {renderSortIcon("physicalQty")}
                              </button>
                            </div>
                          </th>
                          <th className="p-4 text-right font-mono">
                            <button onClick={() => handleSort("differenceQty")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider ml-auto">
                              Diff {renderSortIcon("differenceQty")}
                            </button>
                          </th>
                          <th className="p-4 text-right font-mono">
                            <button onClick={() => handleSort("unitCost")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider ml-auto">
                              Unit Cost {renderSortIcon("unitCost")}
                            </button>
                          </th>
                          <th className="p-4 text-right font-mono">
                            <button onClick={() => handleSort("absoluteVarianceValue")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider ml-auto">
                              Variance {renderSortIcon("absoluteVarianceValue")}
                            </button>
                          </th>
                          <th className="p-4 text-center">
                            <button onClick={() => handleSort("status")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider mx-auto">
                              Risk Level {renderSortIcon("status")}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 text-slate-300">
                        {paginatedItems.map((item) => {
                          const risk = getRiskLabel(item.absoluteVarianceValue || 0);
                          const supplier = item.supplierName || item.detectedSupplierName || "Unknown";
                          return (
                            <tr key={item.id} className="hover:bg-slate-900/10 transition-colors">
                              <td className="p-4 max-w-sm">
                                <span className="block font-mono font-bold text-slate-200">{item.itemCode || "N/A"}</span>
                                <span className="text-[10px] text-slate-500 font-sans block truncate max-w-[280px]" title={item.description}>
                                  {item.description || "No description provided"}
                                </span>
                              </td>
                              <td className="p-4 text-slate-400 truncate max-w-[150px]" title={supplier}>{supplier}</td>
                              <td className="p-4 text-slate-400">{item.org || "N/A"}</td>
                              <td className="p-4 text-right font-mono text-slate-450">
                                {item.erpQty.toLocaleString()} / <strong className="text-slate-100">{item.physicalQty.toLocaleString()}</strong>
                              </td>
                              <td className={`p-4 text-right font-mono font-bold ${item.differenceQty < 0 ? "text-rose-455" : item.differenceQty > 0 ? "text-cyan-400" : "text-slate-400"}`}>
                                {item.differenceQty > 0 ? "+" : ""}{item.differenceQty.toLocaleString()}
                              </td>
                              <td className="p-4 text-right font-mono text-slate-400">
                                SAR {item.unitCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className={`p-4 text-right font-mono font-extrabold ${item.differenceQty < 0 ? "text-rose-400" : item.differenceQty > 0 ? "text-cyan-400" : "text-slate-400"}`}>
                                {item.differenceQty < 0 ? "-" : item.differenceQty > 0 ? "+" : ""}
                                SAR {item.absoluteVarianceValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${risk.classes}`}>
                                  {risk.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-[#0b0d16] z-10 shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                        <tr className="border-b border-slate-850 text-slate-400 uppercase tracking-wider font-semibold bg-[#0b0d16]">
                          <th className="p-4">
                            <button onClick={() => handleSort("itemCode")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                              Item Code & Details {renderSortIcon("itemCode")}
                            </button>
                          </th>
                          <th className="p-4">
                            <button onClick={() => handleSort("supplier")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                              Supplier {renderSortIcon("supplier")}
                            </button>
                          </th>
                          <th className="p-4">
                            <button onClick={() => handleSort("org")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                              Org {renderSortIcon("org")}
                            </button>
                          </th>
                          <th className="p-4 text-right font-mono">
                            <button onClick={() => handleSort("differenceQty")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider ml-auto">
                              Diff {renderSortIcon("differenceQty")}
                            </button>
                          </th>
                          <th className="p-4 text-right font-mono">
                            <button onClick={() => handleSort("absoluteVarianceValue")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider ml-auto">
                              Variance {renderSortIcon("absoluteVarianceValue")}
                            </button>
                          </th>
                          <th className="p-4">
                            <button onClick={() => handleSort("status")} className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none font-semibold text-[10px] tracking-wider">
                              Status & Warnings {renderSortIcon("status")}
                            </button>
                          </th>
                          <th className="p-4">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 text-slate-300">
                        {paginatedItems.map((item) => {
                          const supplier = item.supplierName || item.detectedSupplierName || "Unknown";
                          const hasWarnings = item.validationWarnings && item.validationWarnings.length > 0;
                          return (
                            <tr key={item.id} className="hover:bg-slate-900/10 transition-colors">
                              <td className="p-4 max-w-sm">
                                <span className="block font-mono font-bold text-slate-200">{item.itemCode || "N/A"}</span>
                                <span className="text-[10px] text-slate-500 font-sans block truncate max-w-[280px]" title={item.description}>
                                  {item.description || "No description provided"}
                                </span>
                              </td>
                              <td className="p-4 text-slate-400 truncate max-w-[150px]" title={supplier}>{supplier}</td>
                              <td className="p-4 text-slate-400">{item.org || "N/A"}</td>
                              <td className={`p-4 text-right font-mono font-bold ${item.differenceQty < 0 ? "text-rose-455" : item.differenceQty > 0 ? "text-cyan-400" : "text-slate-400"}`}>
                                {item.differenceQty > 0 ? "+" : ""}{item.differenceQty.toLocaleString()}
                              </td>
                              <td className={`p-4 text-right font-mono font-extrabold ${item.differenceQty < 0 ? "text-rose-400" : item.differenceQty > 0 ? "text-cyan-400" : "text-slate-400"}`}>
                                {item.differenceQty < 0 ? "-" : item.differenceQty > 0 ? "+" : ""}
                                SAR {item.absoluteVarianceValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">
                                    {item.status || "open"}
                                  </span>
                                </div>
                                {hasWarnings && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.validationWarnings?.map((warning, wIdx) => (
                                      <span
                                        key={wIdx}
                                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-rose-500/10 text-rose-450 border border-rose-500/15"
                                      >
                                        <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />
                                        {warning}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="p-4 text-slate-400 italic text-[11px] max-w-xs truncate" title={item.remarks}>
                                {item.remarks || <span className="text-slate-650">No remarks entered</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Table Footer with Pagination Controls */}
                <div className="p-4 border-t border-slate-850 bg-slate-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 items-center">
                    <span>Filtered: <strong>{sortedDisplayItems.length.toLocaleString()}</strong> items</span>
                    <span>•</span>
                    <span>All values in Saudi Riyal (SAR)</span>
                  </div>

                  {/* Pagination buttons */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 disabled:opacity-30 disabled:hover:bg-slate-950 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                          let pageNum = idx + 1;
                          if (totalPages > 5 && currentPage > 3) {
                            pageNum = currentPage - 3 + idx;
                            if (pageNum + (4 - idx) > totalPages) {
                              pageNum = totalPages - 4 + idx;
                            }
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`h-7 w-7 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                currentPage === pageNum
                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                  : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-900"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 disabled:opacity-30 disabled:hover:bg-slate-950 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
      
    </div>
  );

  // Helper functions for filter metrics
  function isAnyFilterActive() {
    return (
      selectedSupplier !== "All Suppliers" ||
      selectedOrg !== "All Organizations" ||
      selectedCategory !== "All Issue Categories" ||
      selectedStatus !== "All Statuses" ||
      selectedRisk !== "All Risk Levels" ||
      searchQuery.trim() !== ""
    );
  }

  function getFilteredNetVariance() {
    return filteredItems.reduce((sum, item) => sum + (item.varianceValue || 0), 0);
  }

  function getFilteredAbsVariance() {
    return filteredItems.reduce((sum, item) => sum + (item.absoluteVarianceValue || 0), 0);
  }
}

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}
