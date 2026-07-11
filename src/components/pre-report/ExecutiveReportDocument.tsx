"use client";

import React from "react";
import {
  ReportSection, CoverPageData, EditableContent, UploadedImage,
} from "@/types/preReport";
import {
  ReportNarrative, Recommendation, RiskFinding, Priority,
  PreReportMetrics, SectionNarrative, fmtSAR, fmtPct,
} from "@/lib/report/insightEngine";

/* ════════════════════════════════════════════════════════════════
   EXECUTIVE REPORT DOCUMENT
   Shared renderer for the pre-report live preview AND the final
   jsPDF/html2canvas export. One A4 page (794×1123) per section.

   IMPORTANT: html2canvas cannot parse modern CSS color functions,
   so every color in this file is an inline hex/rgba style — no
   Tailwind classes inside the pages.
   ════════════════════════════════════════════════════════════════ */

export interface ReportMeta {
  quarter: string;
  year: number | string;
  location: string;
}

interface ExecutiveReportDocumentProps {
  sections: ReportSection[];
  cover: CoverPageData;
  content: EditableContent;
  images: UploadedImage[];
  metrics: PreReportMetrics;
  narrative: ReportNarrative;
  reportMeta: ReportMeta;
  /** When the host appends extra pages (e.g. evidence appendix in the
      builder), pass the true total so footers number correctly. */
  totalPagesOverride?: number;
}

/* ─── Palette (hex only) ─── */
const C = {
  ink: "#0f172a",
  heading: "#1e293b",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e2e8f0",
  borderSoft: "#f1f5f9",
  panel: "#f8fafc",
  white: "#ffffff",
  accent: "#4338ca",
  accentSoft: "#eef2ff",
  good: "#059669",
  goodSoft: "#ecfdf5",
  bad: "#dc2626",
  badSoft: "#fef2f2",
  warn: "#d97706",
  warnSoft: "#fffbeb",
};

const PRIORITY_STYLE: Record<Priority, { fg: string; bg: string }> = {
  Critical: { fg: "#b91c1c", bg: "#fee2e2" },
  High: { fg: "#c2410c", bg: "#ffedd5" },
  Medium: { fg: "#a16207", bg: "#fef9c3" },
  Low: { fg: "#15803d", bg: "#dcfce7" },
};

/* ─── Shared style fragments ─── */
const overline: React.CSSProperties = {
  fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
  textTransform: "uppercase", color: C.faint,
};

const bodyText: React.CSSProperties = {
  fontSize: "11px", lineHeight: 1.65, color: C.body, fontWeight: 400,
};

const thStyle: React.CSSProperties = {
  padding: "7px 10px", fontSize: "8.5px", fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase",
  color: C.muted, backgroundColor: C.panel,
  borderBottom: `1px solid ${C.border}`, textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 10px", fontSize: "10px", color: C.body,
  borderBottom: `1px solid ${C.borderSoft}`,
};

const num: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };

/* ════════════════════════════════════════════════════════════════
   BUILDING BLOCKS
   ════════════════════════════════════════════════════════════════ */

function PriorityBadge({ level }: { level: Priority }) {
  const s = PRIORITY_STYLE[level];
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: "4px",
      fontSize: "8.5px", fontWeight: 800, letterSpacing: "0.08em",
      textTransform: "uppercase", color: s.fg, backgroundColor: s.bg,
    }}>
      {level}
    </span>
  );
}

function FactCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "accent" }) {
  const color = tone === "good" ? C.good : tone === "bad" ? C.bad : tone === "accent" ? C.accent : C.ink;
  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: "10px",
      padding: "12px 14px", backgroundColor: C.panel, minWidth: 0,
    }}>
      <span style={{ ...overline, display: "block", color: C.muted }}>{label}</span>
      <span style={{
        display: "block", marginTop: "5px", fontSize: "16px",
        fontWeight: 800, color, letterSpacing: "-0.01em",
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {value}
      </span>
    </div>
  );
}

function Commentary({ text }: { text: string }) {
  return (
    <p style={{ ...bodyText, fontSize: "11.5px", marginBottom: "14px" }}>{text}</p>
  );
}

function InsightBlock({ insights, max = 4 }: { insights: string[]; max?: number }) {
  if (!insights.length) return null;
  return (
    <div style={{
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}`,
      borderRadius: "8px", padding: "12px 16px", backgroundColor: C.accentSoft,
      marginTop: "14px",
    }}>
      <span style={{ ...overline, color: C.accent, display: "block", marginBottom: "7px" }}>
        Key Insights
      </span>
      <div>
        {insights.slice(0, max).map((ins, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: i === Math.min(insights.length, max) - 1 ? 0 : "7px" }}>
            <span style={{ color: C.accent, fontSize: "9px", lineHeight: "17px", flexShrink: 0 }}>◆</span>
            <span style={{ ...bodyText, fontSize: "10.5px", lineHeight: 1.55 }}>{ins}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ rec, compact }: { rec: Recommendation; compact?: boolean }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: "8px",
      padding: compact ? "10px 14px" : "13px 16px", backgroundColor: C.white,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: compact ? "10.5px" : "11.5px", fontWeight: 700, color: C.ink }}>
          {rec.title}
        </span>
        <PriorityBadge level={rec.priority} />
      </div>
      <div style={{ marginTop: "6px" }}>
        <span style={{ ...bodyText, fontSize: "10px", display: "block" }}>
          <strong style={{ color: C.heading, fontWeight: 700 }}>Why: </strong>{rec.reason}
        </span>
        <span style={{ ...bodyText, fontSize: "10px", display: "block", marginTop: "3px" }}>
          <strong style={{ color: C.heading, fontWeight: 700 }}>Expected benefit: </strong>{rec.benefit}
        </span>
      </div>
    </div>
  );
}

function SectionRecommendations({ recs, max = 2 }: { recs: Recommendation[]; max?: number }) {
  if (!recs.length) return null;
  return (
    <div style={{ marginTop: "14px" }}>
      <span style={{ ...overline, color: C.muted, display: "block", marginBottom: "8px" }}>
        Recommended Actions
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {recs.slice(0, max).map((r) => <RecommendationCard key={r.id} rec={r} compact />)}
      </div>
    </div>
  );
}

function HBar({ label, valueLabel, ratio, color }: { label: string; valueLabel: string; ratio: number; color: string }) {
  const width = Math.max(1.5, Math.min(100, ratio * 100));
  return (
    <div style={{ marginBottom: "9px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontSize: "9.5px", fontWeight: 600, color: C.body }}>{label}</span>
        <span style={{ fontSize: "9.5px", fontWeight: 700, color: C.heading, fontVariantNumeric: "tabular-nums" }}>{valueLabel}</span>
      </div>
      <div style={{ height: "8px", borderRadius: "4px", backgroundColor: C.borderSoft, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${width}%`, borderRadius: "4px", backgroundColor: color }} />
      </div>
    </div>
  );
}

function HealthGauge({ score }: { score: number }) {
  const r = 44;
  const circ = Math.PI * r;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circ - (clamped / 100) * circ;
  let stroke = C.bad;
  if (score >= 95) stroke = C.good;
  else if (score >= 85) stroke = C.accent;
  else if (score >= 70) stroke = C.warn;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      border: `1px solid ${C.border}`, borderRadius: "10px",
      padding: "16px 22px 12px", backgroundColor: C.panel,
    }}>
      <div style={{ position: "relative", width: "120px", height: "66px", overflow: "hidden" }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: "absolute", top: 0, left: 0 }}>
          <path d="M 16 76 A 44 44 0 0 1 104 76" fill="none" stroke={C.border} strokeWidth="9" strokeLinecap="round" />
          <path d="M 16 76 A 44 44 0 0 1 104 76" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} />
        </svg>
        <span style={{
          position: "absolute", bottom: "0", left: "0", right: "0", textAlign: "center",
          fontSize: "20px", fontWeight: 800, color: C.ink,
        }}>
          {score}
        </span>
      </div>
      <span style={{ ...overline, marginTop: "6px" }}>Health Index / 100</span>
    </div>
  );
}

function DonutStat({ label, ratePct, color }: { label: string; ratePct: number; color: string }) {
  const radius = 26;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.min(100, Math.max(0, ratePct)) / 100) * circ;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      border: `1px solid ${C.border}`, borderRadius: "10px",
      padding: "16px 22px 12px", backgroundColor: C.panel,
    }}>
      <div style={{ position: "relative", width: "66px", height: "66px" }}>
        <svg width="66" height="66" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="33" cy="33" r={radius} stroke={C.border} strokeWidth="6" fill="transparent" />
          <circle cx="33" cy="33" r={radius} stroke={color} strokeWidth="6" fill="transparent"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: 800, color: C.ink,
        }}>
          {ratePct.toFixed(1)}%
        </span>
      </div>
      <span style={{ ...overline, marginTop: "6px" }}>{label}</span>
    </div>
  );
}

/* ─── Page shell ─── */
function Page({
  children, pageNumber, totalPages, kicker, title, description, notes, nextTitle, isCover,
}: {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
  kicker: string;
  title?: string;
  description?: string;
  notes?: string;
  nextTitle?: string;
  isCover?: boolean;
}) {
  return (
    <div
      className="pdf-report-page"
      style={{
        width: "794px", height: "1123px", padding: "62px 72px 48px",
        boxSizing: "border-box", display: "flex", flexDirection: "column",
        backgroundColor: C.white, position: "relative",
        border: `1px solid ${C.border}`, overflow: "hidden",
        fontFamily: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif",
        color: C.body,
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", backgroundColor: C.accent }} />

      {!isCover && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: `1px solid ${C.borderSoft}`, paddingBottom: "10px",
        }}>
          <span style={overline}>Inventory Audit &amp; Reconciliation</span>
          <span style={overline}>{kicker}</span>
        </div>
      )}

      {!isCover && title && (
        <div style={{ marginTop: "22px", marginBottom: "16px" }}>
          <span style={{ ...overline, color: C.accent }}>Section {String(pageNumber - 1).padStart(2, "0")}</span>
          <h2 style={{ fontSize: "21px", fontWeight: 800, color: C.ink, letterSpacing: "-0.02em", margin: "4px 0 0" }}>
            {title}
          </h2>
          {description && (
            <p style={{ fontSize: "10.5px", color: C.muted, fontStyle: "italic", margin: "5px 0 0" }}>
              {description}
            </p>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>

      {/* Section notes */}
      {notes && (
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: "10px", marginTop: "12px" }}>
          <span style={{ ...overline, display: "block", marginBottom: "3px" }}>Section Notes &amp; Auditor Disclaimers</span>
          <p style={{ fontSize: "9.5px", color: C.muted, fontStyle: "italic", lineHeight: 1.5, margin: 0 }}>{notes}</p>
        </div>
      )}

      {/* Footer */}
      {!isCover && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: `1px solid ${C.borderSoft}`, paddingTop: "12px", marginTop: "14px",
        }}>
          <span style={overline}>Confidential — Inventory Portal</span>
          <span style={{ ...overline, color: C.muted }}>
            {nextTitle ? `Next: ${nextTitle}   ·   ` : ""}Page {pageNumber} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SECTION BODIES
   ════════════════════════════════════════════════════════════════ */

function CoverBody({ cover, reportMeta }: { cover: CoverPageData; reportMeta: ReportMeta }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {cover.companyLogoUrl ? (
          <img src={cover.companyLogoUrl} alt="Logo" style={{ maxHeight: "48px", objectFit: "contain" }} />
        ) : (
          <div style={{
            border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 12px",
            backgroundColor: C.panel, ...overline, color: C.muted,
          }}>
            Company Brand
          </div>
        )}
        {cover.clientLogoUrl ? (
          <img src={cover.clientLogoUrl} alt="Client Logo" style={{ maxHeight: "48px", objectFit: "contain" }} />
        ) : (
          <span style={overline}>Executive Management Report</span>
        )}
      </div>

      <div style={{ padding: "48px 0" }}>
        <span style={{ ...overline, color: C.accent, fontSize: "10px", display: "block", marginBottom: "14px" }}>
          {cover.reportingPeriod} Audit Cycle
        </span>
        <h1 style={{
          fontSize: "38px", fontWeight: 800, color: C.ink,
          letterSpacing: "-0.025em", lineHeight: 1.15, margin: 0,
        }}>
          {cover.reportTitle || "Inventory Verification Report"}
        </h1>
        {cover.reportSubtitle && (
          <p style={{ fontSize: "13px", color: C.muted, marginTop: "14px", lineHeight: 1.6 }}>
            {cover.reportSubtitle}
          </p>
        )}
        <div style={{ height: "5px", width: "64px", backgroundColor: C.accent, borderRadius: "3px", marginTop: "26px" }} />
        <p style={{ fontSize: "11px", color: C.muted, marginTop: "26px", lineHeight: 1.7, maxWidth: "480px" }}>
          This report presents the verified inventory position, explains what the results mean for the
          business, and sets out prioritized actions for management review — from overall status through
          financial, organizational, and supplier analysis to risks, opportunities, and conclusions.
        </p>
      </div>

      <div>
        <div style={{
          borderTop: `1px solid ${C.borderSoft}`, paddingTop: "22px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px",
        }}>
          {[
            ["Target Facility / Region", reportMeta.location || "—"],
            ["Audited Entity", cover.clientName || "—"],
            ["Report Prepared By", cover.preparedBy || "Not configured"],
            ["Audit Generation Date", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
          ].map(([label, value]) => (
            <div key={label}>
              <span style={{ ...overline, display: "block" }}>{label}</span>
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: C.heading, display: "block", marginTop: "4px" }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {cover.confidentialityStatement && (
          <div style={{
            marginTop: "26px", padding: "12px 14px", borderRadius: "8px",
            backgroundColor: C.warnSoft, borderLeft: `4px solid ${C.warn}`,
          }}>
            <p style={{ fontSize: "9.5px", color: "#92400e", lineHeight: 1.55, fontWeight: 500, margin: 0 }}>
              {cover.confidentialityStatement}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutiveBody({
  content, narrative, metrics,
}: { content: EditableContent; narrative: ReportNarrative; metrics: PreReportMetrics }) {
  const summary = content.executiveSummary?.trim() || narrative.executiveSummary;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "18px" }}>
        <FactCard label="Inventory Value" value={fmtSAR(metrics.totalInventoryValue)} />
        <FactCard label="Health Score" value={`${metrics.healthScore} / 100`} tone="accent" />
        <FactCard label="Count Accuracy" value={fmtPct(metrics.matchRate)} tone={metrics.matchRate >= 95 ? "good" : metrics.matchRate >= 85 ? undefined : "bad"} />
        <FactCard label="Gross Exposure" value={fmtSAR(metrics.totalRiskValue)} tone={metrics.totalRiskValue > 0 ? "bad" : "good"} />
      </div>

      <p style={{ ...bodyText, fontSize: "11.5px", whiteSpace: "pre-line" }}>{summary}</p>

      {content.observations?.trim() && (
        <div style={{ marginTop: "16px" }}>
          <span style={{ ...overline, color: C.accent, display: "block", marginBottom: "5px" }}>Auditor Observations</span>
          <p style={{ ...bodyText, whiteSpace: "pre-line" }}>{content.observations}</p>
        </div>
      )}

      {content.auditorRemarks?.trim() && (
        <div style={{
          marginTop: "16px", borderLeft: `3px solid ${C.accent}`,
          paddingLeft: "14px", fontStyle: "italic",
        }}>
          <span style={{ ...overline, display: "block", marginBottom: "3px" }}>Auditor Verdict Remarks</span>
          <p style={{ ...bodyText, margin: 0 }}>“{content.auditorRemarks}”</p>
        </div>
      )}
    </div>
  );
}

function NarrativeSectionBody({
  narr, children, insightsMax = 4, recsMax = 2,
}: { narr: SectionNarrative; children?: React.ReactNode; insightsMax?: number; recsMax?: number }) {
  return (
    <div>
      <Commentary text={narr.commentary} />
      {children}
      <InsightBlock insights={narr.insights} max={insightsMax} />
      <SectionRecommendations recs={narr.recommendations} max={recsMax} />
    </div>
  );
}

function OverviewBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  const avg = metrics.totalLines > 0 ? metrics.totalInventoryValue / metrics.totalLines : 0;
  return (
    <NarrativeSectionBody narr={narrative.overview}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        <FactCard label="Total Value (ERP)" value={fmtSAR(metrics.totalInventoryValue)} />
        <FactCard label="Inventory Lines" value={metrics.totalLines.toLocaleString()} />
        <FactCard label="Total Quantity" value={metrics.totalQuantity.toLocaleString()} />
        <FactCard label="Organizations" value={String(metrics.divisions.length)} />
        <FactCard label="Supplier Groups" value={String(metrics.suppliers.length)} />
        <FactCard label="Avg. Line Value" value={fmtSAR(avg)} />
      </div>
    </NarrativeSectionBody>
  );
}

function FinancialBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  const maxSplit = Math.max(Math.abs(metrics.totalShortageValue), metrics.totalExcessValue, 1);
  return (
    <NarrativeSectionBody narr={narrative.financial}>
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: "10px", padding: "16px",
        backgroundColor: C.white, marginBottom: "12px",
      }}>
        <HBar label="Recorded Book Value (ERP)" valueLabel={fmtSAR(metrics.totalInventoryValue)} ratio={1} color={C.accent} />
        <HBar
          label={`Physically Verified Value (${fmtPct(metrics.coverageRate)})`}
          valueLabel={fmtSAR(metrics.verifiedValue)}
          ratio={metrics.totalInventoryValue > 0 ? metrics.verifiedValue / metrics.totalInventoryValue : 0}
          color={C.good}
        />
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, margin: "12px 0" }} />
        <HBar label="Shortage Value" valueLabel={`− ${fmtSAR(metrics.totalShortageValue)}`} ratio={Math.abs(metrics.totalShortageValue) / maxSplit} color={C.bad} />
        <HBar label="Excess Value" valueLabel={`+ ${fmtSAR(metrics.totalExcessValue)}`} ratio={metrics.totalExcessValue / maxSplit} color={C.good} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        <FactCard
          label="Net Variance"
          value={`${metrics.netVariance < 0 ? "−" : metrics.netVariance > 0 ? "+" : ""}${fmtSAR(metrics.netVariance)}`}
          tone={metrics.netVariance < 0 ? "bad" : "good"}
        />
        <FactCard label="Gross Exposure" value={fmtSAR(metrics.totalRiskValue)} tone="bad" />
        <FactCard label="Aging Provision" value={fmtSAR(metrics.provisionAmount)} tone={metrics.provisionAmount > 0 ? "bad" : "good"} />
      </div>
    </NarrativeSectionBody>
  );
}

function HealthBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  return (
    <NarrativeSectionBody narr={narrative.health}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
        <HealthGauge score={metrics.healthScore} />
        <DonutStat label="Accuracy Rate" ratePct={metrics.matchRate} color={C.accent} />
        <DonutStat label="Value Coverage" ratePct={metrics.coverageRate} color={C.good} />
        <div style={{
          flexGrow: 1, border: `1px solid ${C.border}`, borderRadius: "10px",
          padding: "14px 16px", backgroundColor: C.panel,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: "7px",
        }}>
          {[
            ["Status", metrics.inventoryHealthStatus],
            ["Matched Lines", `${metrics.matchedItems.toLocaleString()} / ${metrics.totalLines.toLocaleString()}`],
            ["Unverified Lines", metrics.remainingLines.toLocaleString()],
            ["Audit Conclusion", metrics.auditConclusion.split(" - ")[0]],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <span style={{ fontSize: "9.5px", fontWeight: 600, color: C.muted }}>{label}</span>
              <span style={{ fontSize: "9.5px", fontWeight: 800, color: C.ink, textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </NarrativeSectionBody>
  );
}

function DivisionsBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  return (
    <NarrativeSectionBody narr={narrative.organizations}>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
        <thead>
          <tr>
            <th style={thStyle}>Organization</th>
            <th style={{ ...thStyle, ...num }}>Lines</th>
            <th style={{ ...thStyle, ...num }}>ERP Value (SAR)</th>
            <th style={{ ...thStyle, ...num }}>Verified (SAR)</th>
            <th style={{ ...thStyle, ...num }}>Coverage</th>
            <th style={{ ...thStyle, ...num }}>Net Variance</th>
          </tr>
        </thead>
        <tbody>
          {metrics.divisions.slice(0, 9).map((div, idx) => (
            <tr key={idx}>
              <td style={{ ...tdStyle, fontWeight: 700, color: C.heading }}>{div.division}</td>
              <td style={{ ...tdStyle, ...num }}>{div.itemCount.toLocaleString()}</td>
              <td style={{ ...tdStyle, ...num }}>{div.erpValue.toLocaleString()}</td>
              <td style={{ ...tdStyle, ...num }}>{div.verifiedValue.toLocaleString()}</td>
              <td style={{ ...tdStyle, ...num, fontWeight: 700, color: C.good }}>{div.coverageRate}%</td>
              <td style={{ ...tdStyle, ...num, fontWeight: 700, color: div.varianceValue < 0 ? C.bad : C.good }}>
                {div.varianceValue < 0 ? "−" : div.varianceValue > 0 ? "+" : ""}{Math.abs(div.varianceValue).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </NarrativeSectionBody>
  );
}

function SuppliersBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  const byValue = [...metrics.suppliers].sort((a, b) => b.erpValue - a.erpValue).slice(0, 5);
  return (
    <NarrativeSectionBody narr={narrative.suppliers}>
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: "10px", padding: "14px 16px 8px",
        backgroundColor: C.white, marginBottom: "12px",
      }}>
        <span style={{ ...overline, display: "block", marginBottom: "9px" }}>Share of Inventory Value — Top Suppliers</span>
        {byValue.map((s) => (
          <HBar
            key={s.supplier}
            label={s.supplier}
            valueLabel={fmtPct(metrics.totalInventoryValue > 0 ? (s.erpValue / metrics.totalInventoryValue) * 100 : 0)}
            ratio={metrics.totalInventoryValue > 0 ? s.erpValue / metrics.totalInventoryValue : 0}
            color={C.accent}
          />
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Supplier</th>
            <th style={{ ...thStyle, ...num }}>Lines</th>
            <th style={{ ...thStyle, ...num }}>ERP Value (SAR)</th>
            <th style={{ ...thStyle, ...num }}>Abs. Variance (SAR)</th>
            <th style={{ ...thStyle, ...num }}>Match Rate</th>
          </tr>
        </thead>
        <tbody>
          {metrics.suppliers.slice(0, 7).map((sup, idx) => (
            <tr key={idx}>
              <td style={{ ...tdStyle, fontWeight: 700, color: C.heading }}>{sup.supplier}</td>
              <td style={{ ...tdStyle, ...num }}>{sup.itemCount.toLocaleString()}</td>
              <td style={{ ...tdStyle, ...num }}>{sup.erpValue.toLocaleString()}</td>
              <td style={{ ...tdStyle, ...num, color: sup.absoluteVarianceValue > 0 ? C.bad : C.good, fontWeight: 700 }}>
                {sup.absoluteVarianceValue.toLocaleString()}
              </td>
              <td style={{ ...tdStyle, ...num, fontWeight: 700, color: C.accent }}>{sup.matchingRate.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </NarrativeSectionBody>
  );
}

function DistributionBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  const divs = metrics.divisions.slice(0, 6);
  return (
    <NarrativeSectionBody narr={narrative.distribution}>
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: "10px", padding: "14px 16px 8px",
        backgroundColor: C.white, marginBottom: "12px",
      }}>
        <span style={{ ...overline, display: "block", marginBottom: "9px" }}>Value Distribution by Organization</span>
        {divs.map((d) => (
          <HBar
            key={`v-${d.division}`}
            label={d.division}
            valueLabel={fmtSAR(d.erpValue)}
            ratio={metrics.totalInventoryValue > 0 ? d.erpValue / metrics.totalInventoryValue : 0}
            color={C.accent}
          />
        ))}
      </div>
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: "10px", padding: "14px 16px 8px",
        backgroundColor: C.white,
      }}>
        <span style={{ ...overline, display: "block", marginBottom: "9px" }}>Line Distribution by Organization</span>
        {divs.map((d) => (
          <HBar
            key={`l-${d.division}`}
            label={d.division}
            valueLabel={`${d.itemCount.toLocaleString()} lines`}
            ratio={metrics.totalLines > 0 ? d.itemCount / metrics.totalLines : 0}
            color={C.good}
          />
        ))}
      </div>
    </NarrativeSectionBody>
  );
}

function ValidationBody({ narrative }: { narrative: ReportNarrative }) {
  const v = narrative.validationStats;
  const clean = Math.max(0, v.totalLines - v.flaggedLines);
  return (
    <NarrativeSectionBody narr={narrative.validation} insightsMax={5}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "10px" }}>
        <FactCard label="Lines Validated" value={v.totalLines.toLocaleString()} />
        <FactCard label="Clean Lines" value={clean.toLocaleString()} tone="good" />
        <FactCard label="Flagged Lines" value={v.flaggedLines.toLocaleString()} tone={v.flaggedLines > 0 ? "bad" : "good"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        <FactCard label="Missing Item Codes" value={v.missingCodeCount.toLocaleString()} tone={v.missingCodeCount > 0 ? "bad" : "good"} />
        <FactCard label="Missing Descriptions" value={v.missingDescCount.toLocaleString()} tone={v.missingDescCount > 0 ? "bad" : "good"} />
        <FactCard label="Unattributed Supplier" value={v.unclassifiedSupplierCount.toLocaleString()} tone={v.unclassifiedSupplierCount > 0 ? "bad" : "good"} />
        <FactCard label="Missing Org / Unit" value={v.missingOrgCount.toLocaleString()} tone={v.missingOrgCount > 0 ? "bad" : "good"} />
      </div>
    </NarrativeSectionBody>
  );
}

function RiskBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  const risks = narrative.risks;
  return (
    <div>
      {risks.length === 0 ? (
        <div style={{
          border: `1px solid ${C.border}`, borderRadius: "10px", padding: "18px",
          backgroundColor: C.goodSoft, marginBottom: "14px",
        }}>
          <p style={{ ...bodyText, margin: 0, color: "#065f46", fontWeight: 600 }}>
            No business risks met the evidence threshold in this cycle. The high-variance ledger below is
            provided for routine follow-up.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "14px" }}>
          {risks.slice(0, 4).map((r: RiskFinding) => (
            <div key={r.id} style={{
              border: `1px solid ${C.border}`, borderRadius: "8px", padding: "11px 14px",
              backgroundColor: C.white,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: C.ink }}>{r.title}</span>
                <PriorityBadge level={r.level} />
              </div>
              <span style={{ ...bodyText, fontSize: "10px", display: "block", marginTop: "5px" }}>
                <strong style={{ color: C.heading }}>Impact: </strong>{r.impact}
              </span>
              <span style={{ ...bodyText, fontSize: "10px", display: "block", marginTop: "2px" }}>{r.explanation}</span>
              <span style={{ ...bodyText, fontSize: "10px", display: "block", marginTop: "2px", color: C.accent, fontWeight: 600 }}>
                → {r.action}
              </span>
            </div>
          ))}
          {risks.length > 4 && (
            <p style={{ fontSize: "9.5px", color: C.muted, fontStyle: "italic", margin: 0 }}>
              {risks.length - 4} further risk{risks.length - 4 === 1 ? "" : "s"} of lower severity {risks.length - 4 === 1 ? "is" : "are"} reflected in the Recommendations section.
            </p>
          )}
        </div>
      )}

      <span style={{ ...overline, display: "block", marginBottom: "7px" }}>High-Variance Item Ledger (Top {Math.min(6, metrics.highestRiskItems.length)})</span>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Item Code</th>
            <th style={thStyle}>Description</th>
            <th style={{ ...thStyle, ...num }}>ERP</th>
            <th style={{ ...thStyle, ...num }}>Phys</th>
            <th style={{ ...thStyle, ...num }}>Diff</th>
            <th style={{ ...thStyle, ...num }}>Variance (SAR)</th>
          </tr>
        </thead>
        <tbody>
          {metrics.highestRiskItems.slice(0, 6).map((item: any, idx: number) => (
            <tr key={idx}>
              <td style={{ ...tdStyle, fontWeight: 700, fontFamily: "Consolas, monospace", color: C.ink }}>{item.itemCode || "N/A"}</td>
              <td style={{ ...tdStyle, maxWidth: "170px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.description || "N/A"}
              </td>
              <td style={{ ...tdStyle, ...num }}>{(item.erpQty ?? item.systemOnHand ?? 0).toLocaleString()}</td>
              <td style={{ ...tdStyle, ...num }}>{(item.physicalQty ?? item.physicalCount ?? 0).toLocaleString()}</td>
              <td style={{ ...tdStyle, ...num, fontWeight: 700, color: (item.differenceQty ?? 0) < 0 ? C.bad : C.good }}>
                {(item.differenceQty ?? 0) > 0 ? "+" : ""}{(item.differenceQty ?? 0).toLocaleString()}
              </td>
              <td style={{ ...tdStyle, ...num, fontWeight: 700, color: (item.varianceValue ?? 0) < 0 ? C.bad : C.good }}>
                {(item.varianceValue ?? 0) < 0 ? "−" : (item.varianceValue ?? 0) > 0 ? "+" : ""}{Math.abs(item.varianceValue ?? 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpportunitiesBody({ narrative }: { narrative: ReportNarrative }) {
  const ops = narrative.opportunities;
  return (
    <div>
      <Commentary text={
        ops.length > 0
          ? "The findings below are the positive counterpart to the risk register: strengths the data supports directly, which management can rely on and build upon."
          : "No positive findings met the evidence threshold in this cycle. This section will populate as accuracy, coverage, and data quality improve."
      } />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {ops.slice(0, 6).map((op) => (
          <div key={op.id} style={{
            border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.good}`,
            borderRadius: "8px", padding: "12px 14px", backgroundColor: C.goodSoft,
          }}>
            <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#065f46", display: "block" }}>{op.title}</span>
            <span style={{ ...bodyText, fontSize: "10px", display: "block", marginTop: "4px" }}>{op.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsBody({ narrative, content }: { narrative: ReportNarrative; content: EditableContent }) {
  const recs = narrative.consolidatedRecommendations;
  return (
    <div>
      <Commentary text={
        recs.length > 0
          ? `The ${recs.length} action${recs.length === 1 ? "" : "s"} below consolidate the section-level recommendations of this report, ordered by priority. Each is generated only where the underlying data provides direct support.`
          : "The data in this cycle does not support corrective recommendations; the focus should be on sustaining current performance."
      } />
      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        {recs.slice(0, 7).map((r) => <RecommendationCard key={r.id} rec={r} />)}
      </div>

      {content.recommendations?.trim() && (
        <div style={{ marginTop: "14px" }}>
          <span style={{ ...overline, color: C.accent, display: "block", marginBottom: "5px" }}>Management Notes</span>
          <p style={{ ...bodyText, whiteSpace: "pre-line" }}>{content.recommendations}</p>
        </div>
      )}
    </div>
  );
}

function ConclusionBody({ narrative, metrics, cover }: {
  narrative: ReportNarrative; metrics: PreReportMetrics; cover: CoverPageData;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flexGrow: 1 }}>
        {narrative.conclusion.paragraphs.map((p, i) => (
          <p key={i} style={{ ...bodyText, fontSize: "11.5px", marginBottom: "12px" }}>{p}</p>
        ))}

        <div style={{
          border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.accent}`,
          borderRadius: "8px", padding: "14px 18px", backgroundColor: C.accentSoft,
          marginTop: "6px",
        }}>
          <span style={{ ...overline, color: C.accent, display: "block", marginBottom: "5px" }}>Overall Assessment</span>
          <p style={{ fontSize: "12px", fontWeight: 700, color: C.ink, lineHeight: 1.6, margin: 0 }}>
            {narrative.conclusion.overallAssessment}
          </p>
          <p style={{ fontSize: "10px", color: C.muted, margin: "7px 0 0" }}>
            Audit conclusion: {metrics.auditConclusion}
          </p>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "18px", marginTop: "18px" }}>
        <span style={{ ...overline, display: "block", marginBottom: "12px" }}>Reconciliation Signatories Approval</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          {[
            ["Prepared By", cover.preparedBy],
            ["Checked By", cover.checkedBy],
            ["Approved By", cover.approvedBy],
          ].map(([label, name]) => (
            <div key={label} style={{
              border: `1px solid ${C.border}`, borderRadius: "8px",
              padding: "10px 12px", backgroundColor: C.panel,
            }}>
              <span style={{ ...overline, display: "block" }}>{label}</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: C.heading, display: "block", marginTop: "3px" }}>
                {name || "Not configured"}
              </span>
              <div style={{ borderBottom: `1px dashed ${C.faint}`, height: "30px", marginTop: "6px" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamBody({ images }: { images: UploadedImage[] }) {
  return (
    <div>
      <Commentary text="Evidence and warehouse photographs appended to this report for verification purposes." />
      {images.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {images.slice(0, 4).map((img) => (
            <div key={img.id} style={{
              border: `1px solid ${C.border}`, borderRadius: "8px", padding: "9px",
              backgroundColor: C.panel,
            }}>
              <div style={{ height: "150px", borderRadius: "6px", overflow: "hidden", backgroundColor: C.border }}>
                <img src={img.url} alt={img.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ ...overline, color: C.accent, display: "block", marginTop: "7px" }}>
                {img.category.replace("_", " ")}
              </span>
              <p style={{ fontSize: "9.5px", color: C.body, margin: "3px 0 0", lineHeight: 1.4 }}>{img.caption}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          border: `1px dashed ${C.faint}`, borderRadius: "10px", padding: "48px",
          textAlign: "center", fontSize: "10.5px", color: C.faint,
        }}>
          No evidence images or photos uploaded to this builder. Select the “Evidence &amp; Images” tab to add them.
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DOCUMENT
   ════════════════════════════════════════════════════════════════ */

export function ExecutiveReportDocument({
  sections, cover, content, images, metrics, narrative, reportMeta, totalPagesOverride,
}: ExecutiveReportDocumentProps) {
  const enabled = [...sections].sort((a, b) => a.order - b.order).filter((s) => s.enabled);
  const totalPages = totalPagesOverride ?? enabled.length;
  const kicker = cover.reportingPeriod || `${reportMeta.quarter} ${reportMeta.year}`;

  return (
    <>
      {enabled.map((section, idx) => {
        const nextTitle = idx + 1 < enabled.length ? enabled[idx + 1].title : undefined;
        const pageProps = {
          pageNumber: idx + 1,
          totalPages,
          kicker,
          title: section.title,
          description: section.description,
          notes: section.notes || undefined,
          nextTitle,
        };

        switch (section.type) {
          case "cover":
            return (
              <Page key={section.id} {...pageProps} isCover title={undefined} notes={undefined}>
                <CoverBody cover={cover} reportMeta={reportMeta} />
              </Page>
            );
          case "executive":
            return (
              <Page key={section.id} {...pageProps}>
                <ExecutiveBody content={content} narrative={narrative} metrics={metrics} />
              </Page>
            );
          case "kpi":
            return (
              <Page key={section.id} {...pageProps}>
                <OverviewBody metrics={metrics} narrative={narrative} />
              </Page>
            );
          case "financial":
            return (
              <Page key={section.id} {...pageProps}>
                <FinancialBody metrics={metrics} narrative={narrative} />
              </Page>
            );
          case "health":
            return (
              <Page key={section.id} {...pageProps}>
                <HealthBody metrics={metrics} narrative={narrative} />
              </Page>
            );
          case "divisions":
            return (
              <Page key={section.id} {...pageProps}>
                <DivisionsBody metrics={metrics} narrative={narrative} />
              </Page>
            );
          case "suppliers":
            return (
              <Page key={section.id} {...pageProps}>
                <SuppliersBody metrics={metrics} narrative={narrative} />
              </Page>
            );
          case "distribution":
            return (
              <Page key={section.id} {...pageProps}>
                <DistributionBody metrics={metrics} narrative={narrative} />
              </Page>
            );
          case "validation":
            return (
              <Page key={section.id} {...pageProps}>
                <ValidationBody narrative={narrative} />
              </Page>
            );
          case "risk":
            return (
              <Page key={section.id} {...pageProps}>
                <RiskBody metrics={metrics} narrative={narrative} />
              </Page>
            );
          case "opportunities":
            return (
              <Page key={section.id} {...pageProps}>
                <OpportunitiesBody narrative={narrative} />
              </Page>
            );
          case "recommendations":
            return (
              <Page key={section.id} {...pageProps}>
                <RecommendationsBody narrative={narrative} content={content} />
              </Page>
            );
          case "conclusion":
            return (
              <Page key={section.id} {...pageProps}>
                <ConclusionBody narrative={narrative} metrics={metrics} cover={cover} />
              </Page>
            );
          case "team":
            return (
              <Page key={section.id} {...pageProps}>
                <TeamBody images={images} />
              </Page>
            );
          default:
            return (
              <Page key={section.id} {...pageProps}>
                <Commentary text={section.notes || section.description || "Custom section."} />
              </Page>
            );
        }
      })}
    </>
  );
}
