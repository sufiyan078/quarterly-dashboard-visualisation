"use client";

import React from "react";
import {
  ReportSection, CoverPageData, EditableContent, UploadedImage,
} from "@/types/preReport";
import {
  ReportNarrative, Recommendation, RiskFinding, Priority,
  PreReportMetrics, SectionNarrative, fmtSAR, fmtPct,
} from "@/lib/report/insightEngine";
import { C, TYPOGRAPHY, LAYOUT } from "@/lib/report/designTokens";

/* ════════════════════════════════════════════════════════════════
   EXECUTIVE REPORT DOCUMENT
   Shared renderer for the pre-report live preview AND the final
   jsPDF/html2canvas export. One A4 page (794×1123) per section.

   IMPORTANT: html2canvas cannot parse modern CSS color functions,
   so every color in this file is an inline hex/rgba style — no
   Tailwind classes inside the pages. All layout variables are 
   governed by the designTokens module.
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

const PRIORITY_STYLE: Record<Priority, { fg: string; bg: string }> = {
  Critical: { fg: C.status.critical, bg: C.status.criticalSoft },
  High: { fg: C.status.bad, bg: C.status.badSoft },
  Medium: { fg: C.status.warn, bg: C.status.warnSoft },
  Low: { fg: C.status.good, bg: C.status.goodSoft },
};

/* ─── Shared style fragments ─── */
const overline: React.CSSProperties = {
  fontSize: TYPOGRAPHY.sizes.label,
  fontWeight: TYPOGRAPHY.weights.bold,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: C.brand.accent,
};

const bodyText: React.CSSProperties = {
  fontSize: TYPOGRAPHY.sizes.body,
  lineHeight: 1.65,
  color: C.text.secondary,
  fontWeight: TYPOGRAPHY.weights.regular,
  fontFamily: TYPOGRAPHY.fontFamily,
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: TYPOGRAPHY.sizes.tableHeader,
  fontWeight: TYPOGRAPHY.weights.bold,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: C.brand.white,
  backgroundColor: C.brand.primary,
  borderBottom: `2px solid ${C.brand.accent}`,
  textAlign: "left",
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: TYPOGRAPHY.sizes.tableCell,
  color: C.text.primary,
  borderBottom: `1px solid ${C.borderSoft}`,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** Numeric cell — right-aligned, tabular figures, never wraps */
const num: React.CSSProperties = {
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

/* ════════════════════════════════════════════════════════════════
   BUILDING BLOCKS
   ════════════════════════════════════════════════════════════════ */

function PriorityBadge({ level }: { level: Priority }) {
  const s = PRIORITY_STYLE[level];
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: "4px",
      fontSize: "8px", fontWeight: TYPOGRAPHY.weights.extrabold, letterSpacing: "0.08em",
      textTransform: "uppercase", color: s.fg, backgroundColor: s.bg,
      border: `1px solid ${s.fg}22`,
    }}>
      {level}
    </span>
  );
}

function FactCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "accent" }) {
  const color = tone === "good" ? C.status.good : tone === "bad" ? C.status.bad : tone === "accent" ? C.brand.secondary : C.brand.primary;
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderTop: `3px solid ${color}`,
      borderRadius: "6px",
      padding: "10px 12px",
      backgroundColor: C.panel,
      minWidth: 0,
      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
    }}>
      <span style={{ ...overline, display: "block", color: C.text.muted, fontSize: "8px" }}>{label}</span>
      <span style={{
        display: "block", marginTop: "4px", fontSize: "15px",
        fontWeight: TYPOGRAPHY.weights.extrabold, color, letterSpacing: "-0.01em",
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
    <div style={{ marginBottom: "12px" }}>
      {text.split("\n\n").map((para, idx) => (
        <p key={idx} style={{
          ...bodyText,
          fontSize: "10.5px",
          lineHeight: "1.6",
          color: C.text.primary,
          marginBottom: "8px",
          marginTop: 0,
        }}>
          {para}
        </p>
      ))}
    </div>
  );
}

function InsightBlock({ insights, max = 4 }: { insights: string[]; max?: number }) {
  if (!insights.length) return null;
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${C.brand.primary}`,
      borderRadius: "6px",
      padding: "12px 16px",
      backgroundColor: C.borderSoft,
      marginTop: "14px",
    }}>
      <span style={{ ...overline, color: C.brand.primary, display: "block", marginBottom: "7px" }}>
        Key Analytical Insights
      </span>
      <div>
        {insights.slice(0, max).map((ins, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: i === Math.min(insights.length, max) - 1 ? 0 : "7px" }}>
            <span style={{ color: C.brand.accent, fontSize: "9px", lineHeight: "17px", flexShrink: 0 }}>◆</span>
            <span style={{ ...bodyText, fontSize: "10.5px", lineHeight: 1.55, color: C.text.primary }}>{ins}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ rec, compact }: { rec: Recommendation; compact?: boolean }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${PRIORITY_STYLE[rec.priority].fg}`,
      borderRadius: "6px",
      padding: compact ? "10px 14px" : "12px 16px",
      backgroundColor: C.brand.white,
      boxShadow: "0 1px 2px rgba(0,0,0,0.01)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: compact ? "10.5px" : "11px", fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary }}>
          {rec.title}
        </span>
        <PriorityBadge level={rec.priority} />
      </div>
      <div style={{ marginTop: "6px" }}>
        <span style={{ ...bodyText, fontSize: "9.5px", display: "block", color: C.text.secondary }}>
          <strong style={{ color: C.brand.primary, fontWeight: TYPOGRAPHY.weights.bold }}>Why: </strong>{rec.reason}
        </span>
        <span style={{ ...bodyText, fontSize: "9.5px", display: "block", marginTop: "3px", color: C.text.secondary }}>
          <strong style={{ color: C.brand.primary, fontWeight: TYPOGRAPHY.weights.bold }}>Expected benefit: </strong>{rec.benefit}
        </span>
        {(rec.suggestedOwner || rec.suggestedTimeline) && (
          <div style={{
            display: "flex", gap: "14px", marginTop: "6px", paddingTop: "5px",
            borderTop: `1px solid ${C.borderSoft}`,
          }}>
            {rec.suggestedOwner && (
              <span style={{ fontSize: "8.5px", color: C.text.muted }}>
                <strong style={{ color: C.text.secondary, fontWeight: TYPOGRAPHY.weights.bold, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "7.5px" }}>Owner </strong>
                {rec.suggestedOwner}
              </span>
            )}
            {rec.suggestedTimeline && (
              <span style={{ fontSize: "8.5px", color: C.text.muted }}>
                <strong style={{ color: C.text.secondary, fontWeight: TYPOGRAPHY.weights.bold, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "7.5px" }}>Timeline </strong>
                {rec.suggestedTimeline}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionRecommendations({ recs, max = 2 }: { recs: Recommendation[]; max?: number }) {
  if (!recs.length) return null;
  return (
    <div style={{ marginTop: "14px" }}>
      <span style={{ ...overline, color: C.text.muted, display: "block", marginBottom: "8px" }}>
        Recommended Corrective Actions
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
        <span style={{ fontSize: "9.5px", fontWeight: TYPOGRAPHY.weights.semibold, color: C.text.primary }}>{label}</span>
        <span style={{ fontSize: "9.5px", fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary, fontVariantNumeric: "tabular-nums" }}>{valueLabel}</span>
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
  let stroke = C.status.bad;
  if (score >= 95) stroke = C.status.good;
  else if (score >= 85) stroke = C.brand.secondary;
  else if (score >= 70) stroke = C.status.warn;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      border: `1px solid ${C.border}`, borderRadius: "6px",
      padding: "12px 18px 10px", backgroundColor: C.panel,
      boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
    }}>
      <div style={{ position: "relative", width: "120px", height: "66px", overflow: "hidden" }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: "absolute", top: 0, left: 0 }}>
          <path d="M 16 76 A 44 44 0 0 1 104 76" fill="none" stroke={C.border} strokeWidth="9" strokeLinecap="round" />
          <path d="M 16 76 A 44 44 0 0 1 104 76" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} />
        </svg>
        <span style={{
          position: "absolute", bottom: "0", left: "0", right: "0", textAlign: "center",
          fontSize: "20px", fontWeight: TYPOGRAPHY.weights.extrabold, color: C.brand.primary,
        }}>
          {score}
        </span>
      </div>
      <span style={{ ...overline, marginTop: "6px", fontSize: "7.5px" }}>Health Index / 100</span>
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
      border: `1px solid ${C.border}`, borderRadius: "6px",
      padding: "12px 18px 10px", backgroundColor: C.panel,
      boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
    }}>
      <div style={{ position: "relative", width: "66px", height: "66px" }}>
        <svg width="66" height="66" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="33" cy="33" r={radius} stroke={C.border} strokeWidth="6" fill="transparent" />
          <circle cx="33" cy="33" r={radius} stroke={color} strokeWidth="6" fill="transparent"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", fontWeight: TYPOGRAPHY.weights.extrabold, color: C.brand.primary,
        }}>
          {ratePct.toFixed(1)}%
        </span>
      </div>
      <span style={{ ...overline, marginTop: "6px", fontSize: "7.5px" }}>{label}</span>
    </div>
  );
}

/* ─── Brand mark (template header: logo block + wordmark) ─── */
function BrandMark({ logoUrl, dark, large }: { logoUrl?: string; dark?: boolean; large?: boolean }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="GAS Arabian Services" style={{ maxHeight: large ? "76px" : "38px", objectFit: "contain" }} />;
  }

  if (dark) {
    const width = large ? "150px" : "84px";
    const padding = large ? "8px 12px" : "4px 8px";
    const gasSize = large ? "30px" : "16px";
    const arabicSize = large ? "9px" : "5.5px";
    const englishSize = large ? "8px" : "5px";
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0B2B47",
        padding,
        borderRadius: "2px",
        textAlign: "center",
        fontFamily: TYPOGRAPHY.headingFamily,
        width,
      }}>
        <span style={{
          color: "#FFFFFF",
          fontSize: gasSize,
          fontWeight: 900,
          fontStyle: "italic",
          letterSpacing: "0.02em",
          lineHeight: "1.1",
          display: "block"
        }}>GAS</span>
        <span style={{
          color: "#FFFFFF",
          fontSize: arabicSize,
          fontWeight: 500,
          lineHeight: "1",
          display: "block",
          margin: "2px 0"
        }}>غاز العربية للخدمات</span>
        <span style={{
          color: "#FFFFFF",
          fontSize: englishSize,
          fontWeight: 700,
          letterSpacing: "0.05em",
          lineHeight: "1",
          display: "block"
        }}>GAS ARABIAN SERVICES</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <div style={{
        backgroundColor: C.brand.primary,
        color: C.brand.white,
        fontFamily: TYPOGRAPHY.headingFamily,
        fontWeight: TYPOGRAPHY.weights.extrabold,
        fontSize: "11px", letterSpacing: "0.04em",
        padding: "4px 7px", borderRadius: "3px",
      }}>
        GAS
      </div>
      <span style={{
        fontFamily: TYPOGRAPHY.headingFamily,
        fontSize: "9px", fontWeight: TYPOGRAPHY.weights.semibold,
        color: C.brand.primary, lineHeight: 1.25,
      }}>
        GAS Arabian<br />Services
      </span>
    </div>
  );
}

/* ─── Page shell (GAS master template layout) ─── */
function Page({
  children, pageNumber, totalPages, kicker, title, description, notes, nextTitle, isCover, dark, sectionIndex, sectionId, brandLogoUrl,
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
  /** Full-bleed navy page (cover, back cover) */
  dark?: boolean;
  /** 1-based index shown as "Section 0N" in the template overline */
  sectionIndex?: number;
  sectionId?: string;
  brandLogoUrl?: string;
}) {
  const isDark = dark || isCover;
  return (
    <div
      id={sectionId ? `page-${sectionId}` : undefined}
      className={isDark ? "pdf-report-page pdf-report-page--dark" : "pdf-report-page"}
      style={{
        width: LAYOUT.width,
        height: LAYOUT.height,
        padding: `${LAYOUT.padding.top} ${LAYOUT.padding.right} ${LAYOUT.padding.bottom} ${LAYOUT.padding.left}`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        backgroundColor: isDark ? C.brand.primary : C.brand.white,
        backgroundImage: undefined,
        position: "relative",
        border: `1px solid ${isDark ? C.brand.primary : C.border}`,
        overflow: "hidden",
        fontFamily: TYPOGRAPHY.fontFamily,
        color: isDark ? C.brand.light : C.text.secondary,
      }}
    >
      {/* Template content-page header: brand mark left, page number right */}
      {!isCover && !dark && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <BrandMark logoUrl={brandLogoUrl} />
          <span style={{
            fontFamily: TYPOGRAPHY.headingFamily,
            fontSize: "10px", fontWeight: TYPOGRAPHY.weights.medium,
            color: C.text.faint, letterSpacing: "0.25em",
          }}>
            {String(pageNumber).padStart(2, "0")}
          </span>
        </div>
      )}

      {!isCover && !dark && title && (
        <div style={{ marginTop: "24px", marginBottom: "14px" }}>
          {sectionIndex !== undefined && (
            <span style={{ ...overline, color: C.brand.accentDark, letterSpacing: "0.3em", display: "block" }}>
              Section {String(sectionIndex).padStart(2, "0")}
            </span>
          )}
          <h2 style={{
            fontFamily: TYPOGRAPHY.headingFamily,
            fontSize: "22px",
            fontWeight: TYPOGRAPHY.weights.bold,
            color: C.brand.primary,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            margin: "6px 0 0",
            display: "inline-block",
          }}>
            {title}
          </h2>
          {description && (
            <p style={{ fontSize: "10.5px", color: C.text.muted, margin: "6px 0 0" }}>
              {description}
            </p>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: isCover || dark ? 0 : "8px" }}>
        {children}
      </div>

      {/* Section notes */}
      {notes && !isDark && (
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: "8px", marginTop: "10px" }}>
          <span style={{ ...overline, display: "block", marginBottom: "2px", fontSize: "7.5px", color: C.text.muted }}>Notes &amp; Disclaimer</span>
          <p style={{ fontSize: "9px", color: C.text.muted, fontStyle: "italic", lineHeight: 1.4, margin: 0 }}>{notes}</p>
        </div>
      )}

      {/* Template content-page footer: brand · confidential left, page right */}
      {!isCover && !dark && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: `1px solid ${C.borderSoft}`, paddingTop: "10px", marginTop: "12px",
        }}>
          <span style={{ ...overline, color: C.text.faint }}>GAS Arabian Services · Confidential</span>
          <span style={{ ...overline, color: C.text.muted }}>
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

/** Splits the report title in the template's two-tone style:
    leading words in white, the final one or two words in accent teal. */
function splitTitleForCover(title: string): { white: string; teal: string } {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) return { white: "", teal: title };
  const tealCount = words.length >= 4 ? 2 : 1;
  return {
    white: words.slice(0, words.length - tealCount).join(" "),
    teal: words.slice(words.length - tealCount).join(" "),
  };
}

function CoverBody({ cover, reportMeta }: { cover: CoverPageData; reportMeta: ReportMeta }) {
  const title = cover.reportTitle || "Physical Inventory Audit Report";
  const { white, teal } = splitTitleForCover(title);
  const period = cover.reportingPeriod || [reportMeta?.quarter, reportMeta?.year].filter(Boolean).join(" ") || "Q2 2026";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
      {/* Black Accent Box */}
      <div style={{
        position: "absolute",
        top: "550px",
        bottom: 0,
        left: "50%",
        right: 0,
        backgroundColor: "#000000",
        zIndex: 1,
      }} />

      {/* Content Wrapper to overlay on top of Black Accent Box */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        position: "relative",
        zIndex: 2,
      }}>
        {/* Top strip: brand mark left, URL right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <BrandMark logoUrl={cover.companyLogoUrl} dark />
          <span style={{
            ...overline,
            color: C.brand.white,
            fontSize: "8px",
            fontWeight: TYPOGRAPHY.weights.semibold,
            letterSpacing: "0.15em",
            textTransform: "uppercase"
          }}>
            www.gasarabianservices.com
          </span>
        </div>

        {/* Title block (template: teal overline, white + teal two-tone title) */}
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span style={{
            ...overline, color: C.brand.accent, fontSize: "10px",
            letterSpacing: "0.35em", display: "block", marginBottom: "14px",
          }}>
            Inventory Audit Report · {period.toUpperCase()}
          </span>
          <h1 style={{
            fontFamily: TYPOGRAPHY.headingFamily,
            fontSize: "42px", fontWeight: TYPOGRAPHY.weights.extrabold,
            letterSpacing: "-0.015em", lineHeight: 1.12, margin: 0,
          }}>
            {white && <span style={{ color: C.brand.white, display: "block" }}>{white}</span>}
            <span style={{ color: C.brand.accent, display: "block" }}>{teal}</span>
          </h1>
          <p style={{ fontSize: "12px", color: C.text.faint, marginTop: "18px", lineHeight: 1.65, maxWidth: "450px" }}>
            {cover.reportSubtitle ||
              "A structured report for quarterly reconciliation reporting across divisions, suppliers and org codes."}
          </p>
          <div style={{ height: "3px", width: "56px", backgroundColor: C.brand.accent, borderRadius: "2px", marginTop: "26px" }} />
        </div>

        {/* Prepared-by & Certification block */}
        <div>
          <div style={{
            borderTop: `1px solid ${C.brand.accent}`,
            paddingTop: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end"
          }}>
            {/* Left Part: 2-column Metadata Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "180px 180px",
              gap: "16px 24px"
            }}>
              <div>
                <span style={{ ...overline, fontSize: "7.5px", color: C.brand.accent, display: "block" }}>Prepared By</span>
                <span style={{ fontSize: "11px", fontWeight: TYPOGRAPHY.weights.semibold, color: C.brand.white, display: "block", marginTop: "4px" }}>
                  {cover.preparedBy || "GAS Arabian Services"}
                </span>
              </div>
              <div>
                <span style={{ ...overline, fontSize: "7.5px", color: C.brand.accent, display: "block" }}>Audited Entity</span>
                <span style={{ fontSize: "11px", fontWeight: TYPOGRAPHY.weights.semibold, color: C.brand.white, display: "block", marginTop: "4px" }}>
                  {cover.clientName || "All Divisions"}
                </span>
              </div>
              <div>
                <span style={{ ...overline, fontSize: "7.5px", color: C.brand.accent, display: "block" }}>Facility / Location</span>
                <span style={{ fontSize: "11px", fontWeight: TYPOGRAPHY.weights.semibold, color: C.brand.white, display: "block", marginTop: "4px" }}>
                  {reportMeta.location || "Kingdom of Saudi Arabia"}
                </span>
              </div>
              <div>
                <span style={{ ...overline, fontSize: "7.5px", color: C.brand.accent, display: "block" }}>Report Date</span>
                <span style={{ fontSize: "11px", fontWeight: TYPOGRAPHY.weights.semibold, color: C.brand.white, display: "block", marginTop: "4px" }}>
                  {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            </div>

            {/* Right Part: Cert Badge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ ...overline, fontSize: "7.5px", color: C.brand.accent, display: "block", marginBottom: "6px" }}>is certified by</span>
              {cover.clientLogoUrl ? (
                <img src={cover.clientLogoUrl} alt="Certification" style={{ maxHeight: "36px", objectFit: "contain" }} />
              ) : (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#0B2B47",
                  padding: "5px 8px",
                  borderRadius: "4px",
                  border: "1px solid rgba(255,255,255,0.08)"
                }}>
                  <span style={{ fontSize: "7px", color: C.brand.accent, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>TRACE</span>
                  <div style={{ width: "1px", height: "12px", backgroundColor: "rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "7px", color: "#FFFFFF", fontWeight: "medium" }}>CERTIFIED</span>
                </div>
              )}
            </div>
          </div>

          {/* Confidentiality Statement */}
          {cover.confidentialityStatement && (
            <div style={{
              marginTop: "16px", padding: "8px 12px", borderRadius: "4px",
              backgroundColor: "rgba(255,255,255,0.04)", borderLeft: `3px solid ${C.brand.accent}`,
            }}>
              <p style={{ fontSize: "8px", color: C.text.faint, lineHeight: 1.4, margin: 0 }}>
                {cover.confidentialityStatement}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TableOfContentsBody({ sections }: { sections: ReportSection[] }) {
  // Cover (page 1), the ToC itself (page 2) and the closing page are not listed.
  const list = sections.filter(s => s.type !== "cover" && s.type !== "toc" && s.type !== "backcover");

  return (
    <div style={{ display: "flex", height: "100%", gap: "26px" }}>
      {/* Left column: contents register */}
      <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexGrow: 1 }}>
          {list.map((section, index) => {
            // Page offset: Cover (1), ToC (2) -> Section page index is index + 3
            const pageNum = index + 3;
            return (
              <div key={section.id} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "10px",
                padding: "5px 0",
                borderBottom: `1px solid ${C.borderSoft}`,
              }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "baseline", minWidth: 0 }}>
                  <span style={{
                    fontFamily: TYPOGRAPHY.headingFamily,
                    fontSize: "10px", fontWeight: TYPOGRAPHY.weights.semibold,
                    color: C.brand.accent, width: "22px", flexShrink: 0,
                  }}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{
                      fontFamily: TYPOGRAPHY.headingFamily,
                      fontSize: "11px", fontWeight: TYPOGRAPHY.weights.semibold,
                      color: C.brand.primary, display: "block",
                    }}>
                      {section.title}
                    </span>
                    <span style={{ fontSize: "8.5px", color: C.text.muted, display: "block", marginTop: "1px" }}>
                      {section.description}
                    </span>
                  </div>
                </div>
                <span style={{
                  fontSize: "10px", fontWeight: TYPOGRAPHY.weights.semibold,
                  color: C.text.secondary, fontVariantNumeric: "tabular-nums", flexShrink: 0,
                }}>
                  {String(pageNum).padStart(2, "0")}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{
          border: `1px solid ${C.border}`,
          borderRadius: "6px",
          padding: "11px 14px",
          backgroundColor: C.panel,
          marginTop: "14px",
        }}>
          <span style={{ ...overline, color: C.brand.primary, display: "block", marginBottom: "4px" }}>Audit Verification Scope</span>
          <p style={{ fontSize: "9px", color: C.text.secondary, margin: 0, lineHeight: 1.45 }}>
            All sections in this report have been cross-checked by the automated QA Engine. Visual evidence, data
            completeness, and numerical reconciliations match the inventory transactions logged during this audit cycle.
          </p>
        </div>
      </div>

      {/* Right: full-height navy tagline panel (template composition) */}
      <div style={{
        width: "192px", flexShrink: 0,
        backgroundColor: C.brand.primary,
        backgroundImage: `linear-gradient(175deg, ${C.brand.primary} 0%, ${C.brand.dark} 100%)`,
        borderRadius: "6px",
        padding: "34px 24px",
        display: "flex", flexDirection: "column", justifyContent: "flex-start",
      }}>
        <div style={{ height: "3px", width: "34px", backgroundColor: C.brand.accent, borderRadius: "2px", marginBottom: "20px" }} />
        <span style={{
          fontFamily: TYPOGRAPHY.headingFamily,
          fontSize: "16px", fontWeight: TYPOGRAPHY.weights.semibold,
          lineHeight: 1.45,
        }}>
          <span style={{ color: C.brand.white }}>Reporting built on accuracy,</span>{" "}
          <span style={{ color: C.brand.accent }}>reconciled by design.</span>
        </span>
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

      <p style={{ ...bodyText, fontSize: "11.5px", whiteSpace: "pre-line", color: C.text.primary }}>{summary}</p>

      {content.observations?.trim() && (
        <div style={{ marginTop: "16px" }}>
          <span style={{ ...overline, color: C.brand.primary, display: "block", marginBottom: "5px" }}>Auditor Core Observations</span>
          <p style={{ ...bodyText, whiteSpace: "pre-line" }}>{content.observations}</p>
        </div>
      )}

      {content.auditorRemarks?.trim() && (
        <div style={{
          marginTop: "16px", borderLeft: `3px solid ${C.brand.accent}`,
          paddingLeft: "14px", fontStyle: "italic",
        }}>
          <span style={{ ...overline, display: "block", marginBottom: "3px" }}>Auditor Recommending Signature Notes</span>
          <p style={{ ...bodyText, margin: 0, color: C.text.primary }}>“{content.auditorRemarks}”</p>
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

// Format numbers nicely or return fallback
function formatNumber(val: any) {
  if (val === undefined || val === null) return "0";
  return Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function OverviewBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  const avg = metrics.totalLines > 0 ? metrics.totalInventoryValue / metrics.totalLines : 0;
  return (
    <NarrativeSectionBody narr={narrative.overview}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        <FactCard label="Total Value (ERP)" value={fmtSAR(metrics.totalInventoryValue)} />
        <FactCard label="Inventory Lines" value={formatNumber(metrics.totalLines)} />
        <FactCard label="Total Quantity" value={formatNumber(metrics.totalQuantity)} />
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
        border: `1px solid ${C.border}`, borderRadius: "6px", padding: "14px 16px",
        backgroundColor: C.brand.white, marginBottom: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
      }}>
        <HBar label="Recorded Book Value (ERP)" valueLabel={fmtSAR(metrics.totalInventoryValue)} ratio={1} color={C.brand.primary} />
        <HBar
          label={`Physically Verified Value (${fmtPct(metrics.coverageRate)})`}
          valueLabel={fmtSAR(metrics.verifiedValue)}
          ratio={metrics.totalInventoryValue > 0 ? metrics.verifiedValue / metrics.totalInventoryValue : 0}
          color={C.status.good}
        />
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, margin: "10px 0" }} />
        <HBar label="Shortage Value" valueLabel={`− ${fmtSAR(metrics.totalShortageValue)}`} ratio={Math.abs(metrics.totalShortageValue) / maxSplit} color={C.status.bad} />
        <HBar label="Excess Value" valueLabel={`+ ${fmtSAR(metrics.totalExcessValue)}`} ratio={metrics.totalExcessValue / maxSplit} color={C.status.good} />
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
        <DonutStat label="Accuracy Rate" ratePct={metrics.matchRate} color={C.brand.secondary} />
        <DonutStat label="Value Coverage" ratePct={metrics.coverageRate} color={C.status.good} />
        <div style={{
          flexGrow: 1, border: `1px solid ${C.border}`, borderRadius: "6px",
          padding: "12px 14px", backgroundColor: C.panel,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
        }}>
          {[
            ["Status", metrics.inventoryHealthStatus],
            ["Matched Lines", `${formatNumber(metrics.matchedItems)} / ${formatNumber(metrics.totalLines)}`],
            ["Unverified Lines", formatNumber(metrics.remainingLines)],
            ["Audit Conclusion", metrics.auditConclusion.split(" - ")[0]],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <span style={{ fontSize: "9px", fontWeight: TYPOGRAPHY.weights.semibold, color: C.text.muted }}>{label}</span>
              <span style={{ fontSize: "9px", fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary, textAlign: "right" }}>{value}</span>
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
      {/* wrapper: overflow hidden so fixed-layout table never bleeds outside A4 */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: "6px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.01)", width: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            {/* Organization 28% | Lines 8% | ERP Value 18% | Verified 18% | Coverage 11% | Net Variance 17% */}
            <col style={{ width: "28%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "17%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>Organization</th>
              <th style={{ ...thStyle, ...num }}>Lines</th>
              <th style={{ ...thStyle, ...num }}>ERP Value</th>
              <th style={{ ...thStyle, ...num }}>Verified</th>
              <th style={{ ...thStyle, ...num }}>Coverage</th>
              <th style={{ ...thStyle, ...num }}>Variance</th>
            </tr>
          </thead>
          <tbody>
            {metrics.divisions.slice(0, 9).map((div, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? C.brand.white : C.panel }}>
                <td style={{ ...tdStyle, fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{div.division}</td>
                <td style={{ ...tdStyle, ...num }}>{formatNumber(div.itemCount)}</td>
                <td style={{ ...tdStyle, ...num }}>{formatNumber(div.erpValue)}</td>
                <td style={{ ...tdStyle, ...num }}>{formatNumber(div.verifiedValue)}</td>
                <td style={{ ...tdStyle, ...num, fontWeight: TYPOGRAPHY.weights.bold, color: C.status.good }}>{div.coverageRate}%</td>
                <td style={{ ...tdStyle, ...num, fontWeight: TYPOGRAPHY.weights.bold, color: div.varianceValue < 0 ? C.status.bad : C.status.good }}>
                  {div.varianceValue < 0 ? "−" : div.varianceValue > 0 ? "+" : ""}{formatNumber(Math.abs(div.varianceValue))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NarrativeSectionBody>
  );
}

function SuppliersBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  const byValue = [...metrics.suppliers].sort((a, b) => b.erpValue - a.erpValue).slice(0, 5);
  return (
    <NarrativeSectionBody narr={narrative.suppliers}>
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: "6px", padding: "12px 14px 6px",
        backgroundColor: C.brand.white, marginBottom: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
      }}>
        <span style={{ ...overline, display: "block", marginBottom: "8px", color: C.brand.primary }}>Share of Inventory Value — Top 5 Suppliers</span>
        {byValue.map((s) => (
          <HBar
            key={s.supplier}
            label={s.supplier}
            valueLabel={fmtPct(metrics.totalInventoryValue > 0 ? (s.erpValue / metrics.totalInventoryValue) * 100 : 0)}
            ratio={metrics.totalInventoryValue > 0 ? s.erpValue / metrics.totalInventoryValue : 0}
            color={C.brand.secondary}
          />
        ))}
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: "6px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.01)", width: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            {/* Supplier 30% | Lines 8% | ERP Value 20% | Abs Variance 22% | Match Rate 20% */}
            <col style={{ width: "30%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>Supplier</th>
              <th style={{ ...thStyle, ...num }}>Lines</th>
              <th style={{ ...thStyle, ...num }}>ERP Value</th>
              <th style={{ ...thStyle, ...num }}>Abs. Var.</th>
              <th style={{ ...thStyle, ...num }}>Match %</th>
            </tr>
          </thead>
          <tbody>
            {metrics.suppliers.slice(0, 7).map((sup, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? C.brand.white : C.panel }}>
                <td style={{ ...tdStyle, fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sup.supplier}</td>
                <td style={{ ...tdStyle, ...num }}>{formatNumber(sup.itemCount)}</td>
                <td style={{ ...tdStyle, ...num }}>{formatNumber(sup.erpValue)}</td>
                <td style={{ ...tdStyle, ...num, color: sup.absoluteVarianceValue > 0 ? C.status.bad : C.status.good, fontWeight: TYPOGRAPHY.weights.bold }}>
                  {formatNumber(sup.absoluteVarianceValue)}
                </td>
                <td style={{ ...tdStyle, ...num, fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.secondary }}>{sup.matchingRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NarrativeSectionBody>
  );
}

function DistributionBody({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  const divs = metrics.divisions.slice(0, 6);
  return (
    <NarrativeSectionBody narr={narrative.distribution}>
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: "6px", padding: "12px 14px 6px",
        backgroundColor: C.brand.white, marginBottom: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
      }}>
        <span style={{ ...overline, display: "block", marginBottom: "8px", color: C.brand.primary }}>Value Distribution by Organization</span>
        {divs.map((d) => (
          <HBar
            key={`v-${d.division}`}
            label={d.division}
            valueLabel={fmtSAR(d.erpValue)}
            ratio={metrics.totalInventoryValue > 0 ? d.erpValue / metrics.totalInventoryValue : 0}
            color={C.brand.primary}
          />
        ))}
      </div>
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: "6px", padding: "12px 14px 6px",
        backgroundColor: C.brand.white,
        boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
      }}>
        <span style={{ ...overline, display: "block", marginBottom: "8px", color: C.brand.primary }}>Line Distribution by Organization</span>
        {divs.map((d) => (
          <HBar
            key={`l-${d.division}`}
            label={d.division}
            valueLabel={`${formatNumber(d.itemCount)} lines`}
            ratio={metrics.totalLines > 0 ? d.itemCount / metrics.totalLines : 0}
            color={C.brand.secondary}
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
        <FactCard label="Lines Validated" value={formatNumber(v.totalLines)} />
        <FactCard label="Clean Lines" value={formatNumber(clean)} tone="good" />
        <FactCard label="Flagged Lines" value={formatNumber(v.flaggedLines)} tone={v.flaggedLines > 0 ? "bad" : "good"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        <FactCard label="Missing Item Codes" value={formatNumber(v.missingCodeCount)} tone={v.missingCodeCount > 0 ? "bad" : "good"} />
        <FactCard label="Missing Descriptions" value={formatNumber(v.missingDescCount)} tone={v.missingDescCount > 0 ? "bad" : "good"} />
        <FactCard label="Unattributed Supplier" value={formatNumber(v.unclassifiedSupplierCount)} tone={v.unclassifiedSupplierCount > 0 ? "bad" : "good"} />
        <FactCard label="Missing Org / Unit" value={formatNumber(v.missingOrgCount)} tone={v.missingOrgCount > 0 ? "bad" : "good"} />
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
          border: `1px solid ${C.border}`, borderRadius: "6px", padding: "14px",
          backgroundColor: C.status.goodSoft, marginBottom: "14px",
        }}>
          <p style={{ ...bodyText, margin: 0, color: C.status.good, fontWeight: TYPOGRAPHY.weights.semibold }}>
            No critical business risks met the exposure threshold in this cycle. The high-variance ledger below is
            appended for operational follow-up.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "14px" }}>
          {risks.slice(0, 4).map((r: RiskFinding) => (
            <div key={r.id} style={{
              border: `1px solid ${C.border}`,
              borderLeft: `4px solid ${PRIORITY_STYLE[r.level].fg}`,
              borderRadius: "6px",
              padding: "10px 14px",
              backgroundColor: C.brand.white,
              boxShadow: "0 1px 2px rgba(0,0,0,0.01)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary }}>{r.title}</span>
                <PriorityBadge level={r.level} />
              </div>
              <span style={{ ...bodyText, fontSize: "9.5px", display: "block", marginTop: "4px" }}>
                <strong style={{ color: C.brand.primary }}>Impact: </strong>{r.impact}
              </span>
              <span style={{ ...bodyText, fontSize: "9.5px", display: "block", marginTop: "2px", color: C.text.secondary }}>{r.explanation}</span>
              <span style={{ ...bodyText, fontSize: "9.5px", display: "block", marginTop: "2px", color: C.brand.accentDark, fontWeight: TYPOGRAPHY.weights.bold }}>
                → Action Plan: {r.action}
              </span>
              {r.evidence && (
                <span style={{
                  display: "block", marginTop: "5px", paddingTop: "4px",
                  borderTop: `1px solid ${C.borderSoft}`,
                  fontSize: "8.5px", color: C.text.muted, fontStyle: "italic",
                }}>
                  Evidence: {r.evidence}
                </span>
              )}
            </div>
          ))}
          {risks.length > 4 && (
            <p style={{ fontSize: "9px", color: C.text.muted, fontStyle: "italic", margin: 0 }}>
              * Omitted {risks.length - 4} secondary risk findings from this view. Full ledger logs are maintained in step 2.
            </p>
          )}
        </div>
      )}

      <span style={{ ...overline, display: "block", marginBottom: "6px" }}>High-Variance Inventory Ledger (Top {Math.min(6, metrics.highestRiskItems.length)})</span>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: "6px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.01)", width: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            {/* Item Code 14% | Description 30% | ERP Qty 12% | Phys Qty 12% | Diff 12% | Variance (SAR) 20% */}
            <col style={{ width: "14%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, ...num }}>ERP Qty</th>
              <th style={{ ...thStyle, ...num }}>Phys Qty</th>
              <th style={{ ...thStyle, ...num }}>Diff</th>
              <th style={{ ...thStyle, ...num }}>Variance</th>
            </tr>
          </thead>
          <tbody>
            {metrics.highestRiskItems.slice(0, 6).map((item: any, idx: number) => {
              const eq = item.erpQty !== undefined ? item.erpQty : (item.systemOnHand !== undefined ? item.systemOnHand : 0);
              const pq = item.physicalQty !== undefined ? item.physicalQty : (item.physicalCount !== undefined ? item.physicalCount : 0);
              const df = item.differenceQty !== undefined ? item.differenceQty : (pq - eq);
              const vr = item.varianceValue !== undefined ? item.varianceValue : (df * (item.unitCost || 0));

              return (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? C.brand.white : C.panel }}>
                  <td style={{ ...tdStyle, fontWeight: TYPOGRAPHY.weights.bold, fontFamily: "Consolas, monospace", color: C.brand.primary, fontSize: "9px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.itemCode || "N/A"}</td>
                  <td style={{ ...tdStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.description || "N/A"}
                  </td>
                  <td style={{ ...tdStyle, ...num }}>{formatNumber(eq)}</td>
                  <td style={{ ...tdStyle, ...num }}>{formatNumber(pq)}</td>
                  <td style={{ ...tdStyle, ...num, fontWeight: TYPOGRAPHY.weights.bold, color: df < 0 ? C.status.bad : C.status.good }}>
                    {df > 0 ? "+" : ""}{formatNumber(df)}
                  </td>
                  <td style={{ ...tdStyle, ...num, fontWeight: TYPOGRAPHY.weights.bold, color: vr < 0 ? C.status.bad : C.status.good }}>
                    {vr < 0 ? "−" : vr > 0 ? "+" : ""}{formatNumber(Math.abs(vr))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpportunitiesBody({ narrative }: { narrative: ReportNarrative }) {
  const ops = narrative.opportunities;
  return (
    <div>
      <Commentary text={
        ops.length > 0
          ? "The opportunities detailed below identify key positive findings and structural strengths supported directly by the audited data."
          : "No operational enhancement opportunities met the threshold requirements in this cycle. Focus should remain on maintaining baseline validation health."
      } />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {ops.slice(0, 6).map((op) => (
          <div key={op.id} style={{
            border: `1px solid ${C.border}`,
            borderLeft: `4px solid ${C.brand.accent}`,
            borderRadius: "6px",
            padding: "12px 14px",
            backgroundColor: C.status.goodSoft,
            boxShadow: "0 1px 2px rgba(0,0,0,0.01)",
          }}>
            <span style={{ fontSize: "10.5px", fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary, display: "block" }}>{op.title}</span>
            <span style={{ ...bodyText, fontSize: "9.5px", display: "block", marginTop: "4px", color: C.text.secondary }}>{op.detail}</span>
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
          ? `The following ${recs.length} management recommendations prioritize action plans supported directly by transactional variances and audit ledger discrepancies.`
          : "Audit findings indicate stable controls. No critical recommendations are proposed for this period."
      } />
      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        {recs.slice(0, 7).map((r) => <RecommendationCard key={r.id} rec={r} />)}
      </div>

      {content.recommendations?.trim() && (
        <div style={{ marginTop: "14px" }}>
          <span style={{ ...overline, color: C.brand.primary, display: "block", marginBottom: "5px" }}>Management Actions &amp; Responses</span>
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
          <p key={i} style={{ ...bodyText, fontSize: "11px", marginBottom: "10px", color: C.text.primary }}>{p}</p>
        ))}

        <div style={{
          border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.brand.accent}`,
          borderRadius: "6px", padding: "12px 16px", backgroundColor: C.panel,
          marginTop: "6px",
        }}>
          <span style={{ ...overline, color: C.brand.primary, display: "block", marginBottom: "4px" }}>Reconciliation Conclusion</span>
          <p style={{ fontSize: "11px", fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary, lineHeight: 1.5, margin: 0 }}>
            {narrative.conclusion.overallAssessment}
          </p>
          <p style={{ fontSize: "9.5px", color: C.text.muted, margin: "6px 0 0" }}>
            Reconciliation Standard: {metrics.auditConclusion}
          </p>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "14px", marginTop: "14px" }}>
        <span style={{ ...overline, display: "block", marginBottom: "10px", color: C.brand.primary }}>Reconciliation Signatories Approval</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          {[
            ["Prepared By", cover.preparedBy],
            ["Checked By", cover.checkedBy],
            ["Approved By", cover.approvedBy],
          ].map(([label, name]) => (
            <div key={label} style={{
              border: `1px solid ${C.border}`, borderRadius: "6px",
              padding: "8px 12px", backgroundColor: C.panel,
            }}>
              <span style={{ ...overline, display: "block", fontSize: "7px" }}>{label}</span>
              <span style={{ fontSize: "10px", fontWeight: TYPOGRAPHY.weights.bold, color: C.brand.primary, display: "block", marginTop: "2px" }}>
                {name || "Awaiting Sign-off"}
              </span>
              <div style={{ borderBottom: `1px dashed ${C.brand.accent}`, height: "24px", marginTop: "4px" }} />
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
      <Commentary text="Photographic evidence logged during physical audits to support reconciliations." />
      {images.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {images.slice(0, 4).map((img) => (
            <div key={img.id} style={{
              border: `1px solid ${C.border}`, borderRadius: "6px", padding: "8px",
              backgroundColor: C.panel,
              boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
            }}>
              <div style={{ height: "150px", borderRadius: "4px", overflow: "hidden", backgroundColor: C.border }}>
                <img src={img.url} alt={img.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ ...overline, color: C.brand.accent, display: "block", marginTop: "6px", fontSize: "7.5px" }}>
                {img.category.replace("_", " ")}
              </span>
              <p style={{ fontSize: "9px", color: C.text.primary, margin: "2px 0 0", lineHeight: 1.35 }}>{img.caption}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          border: `2px dashed ${C.border}`, borderRadius: "6px", padding: "48px",
          textAlign: "center", fontSize: "11px", color: C.text.muted,
        }}>
          No evidence images or photos uploaded to this builder. Select the “Evidence &amp; Images” tab to add them.
        </div>
      )}
    </div>
  );
}

/* ─── Back cover (template "Thank You" page) ─── */
function BackCoverBody({ cover }: { cover: CoverPageData }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      alignItems: "center", justifyContent: "center", textAlign: "center",
    }}>
      <BrandMark logoUrl={cover.companyLogoUrl} dark large />
      <h1 style={{
        fontFamily: TYPOGRAPHY.headingFamily,
        fontSize: "30px", fontWeight: TYPOGRAPHY.weights.semibold,
        color: C.brand.white, margin: "24px 0 0",
      }}>
        Thank You
      </h1>
      <p style={{ fontSize: "10px", color: C.text.faint, marginTop: "14px", lineHeight: 1.7 }}>
        GAS Arabian Services — Kingdom of Saudi Arabia
        <br />
        www.gasarabianservices.com
      </p>

      {/* Cert Badge */}
      <div style={{ marginTop: "28px" }}>
        {cover.clientLogoUrl ? (
          <img src={cover.clientLogoUrl} alt="Certification" style={{ maxHeight: "36px", objectFit: "contain" }} />
        ) : (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#0B2B47",
            padding: "5px 8px",
            borderRadius: "4px",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <span style={{ fontSize: "7px", color: C.brand.accent, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>TRACE</span>
            <div style={{ width: "1px", height: "12px", backgroundColor: "rgba(255,255,255,0.2)" }} />
            <span style={{ fontSize: "7px", color: "#FFFFFF", fontWeight: "medium" }}>CERTIFIED</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DOCUMENT ENTRYPOINT
   ════════════════════════════════════════════════════════════════ */

export function ExecutiveReportDocument({
  sections, cover, content, images, metrics, narrative, reportMeta, totalPagesOverride,
}: ExecutiveReportDocumentProps) {
  const enabled = [...sections].sort((a, b) => a.order - b.order).filter((s) => s.enabled);
  const totalPages = totalPagesOverride ?? enabled.length;
  const kicker = cover.reportingPeriod || `${reportMeta.quarter} ${reportMeta.year}`;

  // "Section 0N" numbering counts only content sections (template style:
  // cover, contents and back cover carry no section number).
  const unnumbered = new Set(["cover", "toc", "backcover"]);
  let sectionCounter = 0;

  return (
    <>
      {enabled.map((section, idx) => {
        const nextTitle = idx + 1 < enabled.length ? enabled[idx + 1].title : undefined;
        const sectionIndex = unnumbered.has(section.type) ? undefined : ++sectionCounter;
        const pageProps = {
          sectionId: section.id,
          pageNumber: idx + 1,
          totalPages,
          kicker,
          title: section.title,
          description: section.description,
          notes: section.notes || undefined,
          nextTitle,
          sectionIndex,
          brandLogoUrl: cover.companyLogoUrl || undefined,
        };

        switch (section.type) {
          case "cover":
            return (
              <Page key={section.id} {...pageProps} isCover title={undefined} notes={undefined}>
                <CoverBody cover={cover} reportMeta={reportMeta} />
              </Page>
            );
          case "backcover":
            return (
              <Page key={section.id} {...pageProps} dark title={undefined} notes={undefined}>
                <BackCoverBody cover={cover} />
              </Page>
            );
          case "toc":
            return (
              <Page key={section.id} {...pageProps} title="Table of Contents" description="Overview of the verified report structure and pages" notes={undefined}>
                <TableOfContentsBody sections={enabled} />
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
