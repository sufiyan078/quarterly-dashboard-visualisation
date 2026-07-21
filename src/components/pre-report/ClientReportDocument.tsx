"use client";

import React from "react";
import {
  ReportSection, CoverPageData, EditableContent, UploadedImage, SupplierImageMapping,
} from "@/types/preReport";
import {
  ReportNarrative, PreReportMetrics, fmtSAR, fmtPct,
} from "@/lib/report/insightEngine";
import { ReportAnalytics, buildReportAnalytics } from "@/lib/report/analytics";
import { SharedReportModel } from "@/lib/report/reportModel";
import { DARK, TYPOGRAPHY } from "@/lib/report/designTokens";

/* ════════════════════════════════════════════════════════════════
   CLIENT REPORT DOCUMENT
   Presentation layer matching the client-approved reference deck
   (Physical_Inventory_Verification_Report.pdf) page-for-page:
   A4 LANDSCAPE, dark navy theme, blue info cards, gold accents.

   This component is a pure view over the EXISTING report engine —
   it consumes the same metrics, narrative, rows, and config that
   the previous document used. No calculations are modified; the
   only derivations below are display-time aggregations of data the
   engine already produces.

   html2canvas constraint: every color is a raw hex inline style.
   ════════════════════════════════════════════════════════════════ */

export interface ReportMeta {
  quarter: string;
  year: number | string;
  location: string;
}

interface ClientReportDocumentProps {
  /** When provided, the SharedReportModel is the SINGLE SOURCE OF TRUTH.
      All page order, kickers, totalPages, analytics, metrics, narrative,
      and content are derived exclusively from this model. The individual
      props below are ignored when `model` is supplied. */
  model?: SharedReportModel;
  sections?: ReportSection[];
  cover?: CoverPageData;
  content?: EditableContent;
  images?: UploadedImage[];
  metrics?: PreReportMetrics;
  narrative?: ReportNarrative;
  reportMeta?: ReportMeta;
  /** Raw formatted rows (already produced by the existing pipeline);
      used only for display-time grouping. Optional. */
  rows?: any[];
  /** Shared analytics object (single source of truth for every KPI).
      When omitted it is derived from `rows` with the same formulas. */
  analytics?: ReportAnalytics;
  /** Extra pages the host appends after this document (e.g. the
      builder's personnel appendix) so footers number correctly. */
  totalPagesOverride?: number;
  /** Supplier-to-evidence-image mapping for spotlight pages. */
  supplierImageMapping?: SupplierImageMapping;
}

/* ─── Layout (A4 landscape @96dpi) ─── */
export const CLIENT_PAGE_W = 1123;
export const CLIENT_PAGE_H = 794;
const PAD = "34px 52px 26px";

const PROOFS_PER_PAGE = 6;

/** Images that appear on Proofs & Site Photographs pages. */
export function getProofImages(images: UploadedImage[]): UploadedImage[] {
  return images.filter(img => !String(img.category || "").toLowerCase().includes("logo") && !img.supplierName);
}

/** Total pages this document renders for the given config. */
export function countClientReportPages(sections: ReportSection[], images: UploadedImage[]): number {
  const enabled = sections.filter(s => s.enabled);
  const proofs = getProofImages(images);
  return enabled.reduce((sum, s) => {
    if (s.type === "team") return sum + Math.ceil(proofs.length / PROOFS_PER_PAGE);
    return sum + 1;
  }, 0);
}

/* ─── Typography fragments ─── */
const F = TYPOGRAPHY.fontFamily;

const kickerStyle: React.CSSProperties = {
  fontFamily: F, fontSize: "11px", fontWeight: 800,
  letterSpacing: "0.32em", textTransform: "uppercase", color: DARK.gold,
};

const titleStyle: React.CSSProperties = {
  fontFamily: F, fontSize: "27px", fontWeight: 800,
  letterSpacing: "-0.01em", color: DARK.white, margin: "8px 0 0",
};

const cardLabel: React.CSSProperties = {
  fontFamily: F, fontSize: "9px", fontWeight: 800,
  letterSpacing: "0.14em", textTransform: "uppercase", color: DARK.gold,
};

const dimCaption: React.CSSProperties = {
  fontFamily: F, fontSize: "9px", color: DARK.dim,
};

const card: React.CSSProperties = {
  backgroundColor: DARK.card,
  border: `1px solid ${DARK.cardBorder}`,
  borderRadius: "8px",
};

/* ════════════════════════════════════════════════════════════════
   BUILDING BLOCKS
   ════════════════════════════════════════════════════════════════ */

function KpiCard({ label, value, caption, color = DARK.white, valueSize = "19px" }: {
  label: string; value: string; caption?: string; color?: string; valueSize?: string;
}) {
  return (
    <div style={{ ...card, padding: "14px 16px", minWidth: 0, flex: 1 }}>
      <span style={{ ...cardLabel, display: "block" }}>{label}</span>
      <span style={{
        fontFamily: F, display: "block", marginTop: "8px", fontSize: valueSize,
        fontWeight: 800, color, whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}>
        {trunc(value, 26)}
      </span>
      {caption && <span style={{ ...dimCaption, display: "block", marginTop: "6px" }}>{caption}</span>}
    </div>
  );
}

function WWWCards({ what, where, why }: { what: string; where: string; why: string }) {
  const items = [
    { title: "WHAT HAPPENED?", color: DARK.green, text: what },
    { title: "WHERE DID IT HAPPEN?", color: DARK.blue, text: where },
    { title: "WHY IS IT IMPORTANT?", color: DARK.gold, text: why },
  ];
  return (
    <div style={{ display: "flex", gap: "14px" }}>
      {items.map((it) => (
        <div key={it.title} style={{ ...card, padding: "13px 16px", flex: 1, minWidth: 0 }}>
          <span style={{ ...cardLabel, color: it.color, display: "block", letterSpacing: "0.08em", fontSize: "9.5px" }}>{it.title}</span>
          <p style={{ fontFamily: F, fontSize: "10.5px", color: DARK.text, lineHeight: 1.5, margin: "7px 0 0" }}>{it.text}</p>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, subtitle, children, style }: {
  title?: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{ ...card, padding: "16px 20px", minWidth: 0, ...style }}>
      {title && (
        <span style={{ fontFamily: F, fontSize: "13px", fontWeight: 800, color: DARK.white, display: "block" }}>
          {title}
        </span>
      )}
      {subtitle && <span style={{ ...dimCaption, display: "block", marginTop: "3px" }}>{subtitle}</span>}
      <div style={{ marginTop: title ? "12px" : 0 }}>{children}</div>
    </div>
  );
}

function BarRow({ label, valueLabel, ratio, color }: {
  label: string; valueLabel: string; ratio: number; color: string;
}) {
  const width = Math.max(2, Math.min(100, ratio * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "11px" }}>
      <span style={{
        fontFamily: F, fontSize: "10px", fontWeight: 700, color: DARK.white,
        width: "150px", flexShrink: 0, whiteSpace: "nowrap",
      }}>
        {trunc(label, 26)}
      </span>
      <div style={{ flexGrow: 1, height: "13px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${width}%`, borderRadius: "3px", backgroundColor: color }} />
      </div>
      <span style={{
        fontFamily: F, fontSize: "10px", fontWeight: 800, color: DARK.white,
        width: "86px", flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums",
      }}>
        {valueLabel}
      </span>
    </div>
  );
}

function Donut({ segments, size = 150, thickness = 26, centerTop, centerBottom, centerColor = DARK.green, centerTopSize = "24px" }: {
  segments: { value: number; color: string }[];
  size?: number; thickness?: number;
  centerTop?: string; centerBottom?: string;
  centerColor?: string; centerTopSize?: string;
}) {
  const total = Math.max(segments.reduce((s, x) => s + x.value, 0), 0.0001);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = Math.max(frac * circ - 1.5, 0.001);
          const el = (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={r}
              fill="transparent" stroke={seg.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-acc * circ}
            />
          );
          acc += frac;
          return el;
        })}
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", transform: "none",
      }}>
        {centerTop && <span style={{ fontFamily: F, fontSize: centerTopSize, fontWeight: 800, color: centerColor }}>{centerTop}</span>}
        {centerBottom && <span style={{ fontFamily: F, fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em", color: DARK.dim, textTransform: "uppercase", marginTop: "2px" }}>{centerBottom}</span>}
      </div>
    </div>
  );
}

/* ─── Tables ─── */
const th: React.CSSProperties = {
  fontFamily: F, padding: "9px 12px", fontSize: "10px", fontWeight: 800,
  color: DARK.gold, textAlign: "left", backgroundColor: DARK.tableHeader,
  border: `1px solid ${DARK.tableBorder}`, whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  fontFamily: F, padding: "8px 12px", fontSize: "10px", color: DARK.text,
  border: `1px solid ${DARK.tableBorder}`, fontVariantNumeric: "tabular-nums",
};

const money = (n: number, dp = 2) =>
  `SAR ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: dp === 0 ? 0 : 2, maximumFractionDigits: dp })}`;

/** JS truncation instead of CSS text-overflow: html2canvas renders text
    slightly below its browser baseline, so any `overflow: hidden` on the
    text's own element clips glyph bottoms in the exported PDF. */
const trunc = (s: any, max: number) => {
  const str = String(s ?? "");
  return str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str;
};

const signedMoney = (n: number) =>
  `${n < 0 ? "-" : n > 0 ? "+" : ""}SAR ${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ─── Page shell ─── */
function DeckPage({
  children, pageNumber, totalPages, kicker, title, subtitle, notes, sectionId, brandFooter,
  compact, padOverride,
}: {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
  kicker?: string;
  title?: string;
  subtitle?: string;
  notes?: string;
  sectionId?: string;
  brandFooter?: boolean;
  /** Tighter header / footer spacing to maximize content area. */
  compact?: boolean;
  /** Override the default page padding (CSS shorthand). */
  padOverride?: string;
}) {
  return (
    <div
      id={sectionId ? `page-${sectionId}` : undefined}
      className="pdf-report-page pdf-report-page--deck"
      style={{
        width: `${CLIENT_PAGE_W}px`, height: `${CLIENT_PAGE_H}px`,
        padding: padOverride || PAD, boxSizing: "border-box",
        display: "flex", flexDirection: "column",
        backgroundColor: DARK.pageBg,
        backgroundImage: `linear-gradient(165deg, ${DARK.pageBg} 0%, ${DARK.pageBgEnd} 100%)`,
        position: "relative", overflow: "hidden",
        fontFamily: F, color: DARK.text,
      }}
    >
      {/* Gold page number, top right */}
      <span style={{
        position: "absolute", top: "30px", right: "38px",
        fontFamily: F, fontSize: "12px", fontWeight: 800, color: DARK.gold,
      }}>
        {pageNumber}
      </span>

      {(kicker || title) && (
        <div style={{ marginBottom: compact ? "6px" : "14px" }}>
          {kicker && <span style={{ ...kickerStyle, display: "block" }}>{kicker}</span>}
          {title && <h2 style={titleStyle}>{title}</h2>}
          <div style={{ height: "1px", backgroundColor: DARK.divider, marginTop: compact ? "6px" : "12px" }} />
          {subtitle && <span style={{ ...dimCaption, fontSize: "10px", display: "block", marginTop: compact ? "4px" : "9px" }}>{subtitle}</span>}
        </div>
      )}

      <div style={{ flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>

      {notes && (
        <p style={{ fontFamily: F, fontSize: "8.5px", color: DARK.faint, fontStyle: "italic", margin: "8px 0 0" }}>{notes}</p>
      )}

      <div style={{ marginTop: compact ? "6px" : "12px" }}>
        <span style={{ ...dimCaption, display: "block" }}>Physical Inventory Verification &amp; Reconciliation Report</span>
        {brandFooter && (
          <span style={{ ...dimCaption, display: "block", marginTop: "2px" }}>
            Gas Arabian Services © {new Date().getFullYear()}  All Rights Reserved
          </span>
        )}
      </div>
    </div>
  );
}

/* All KPI aggregations come from the shared ReportAnalytics object
   (src/lib/report/analytics.ts) — the same source the dashboard uses. */

const abbrev = (val: number) => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

const riskLevelOf = (absVariance: number) =>
  absVariance >= 10000 ? "HIGH" : absVariance >= 1000 ? "MEDIUM" : "LOW";

const riskColorOf = (level: string) =>
  level === "HIGH" ? DARK.red : level === "MEDIUM" ? DARK.gold : DARK.green;

/* ════════════════════════════════════════════════════════════════
   PAGE BODIES
   ════════════════════════════════════════════════════════════════ */

function CoverPage({ cover, metrics, pageNumber, totalPages }: {
  cover: CoverPageData; metrics: PreReportMetrics; pageNumber: number; totalPages: number;
}) {
  const kickerPeriod = (cover.reportingPeriod || "").trim() || "Q2 2026";
  /* ── Client-mandated fixed cover layout ──
     Title and subtitle are hardcoded to match the client-approved reference
     deck (Screenshot 2). The cover.reportTitle / reportSubtitle fields are
     intentionally ignored here so the cover page is pixel-identical to the
     approved design regardless of what the user enters in Cover Designer. */
  const formattedTitle = "PHYSICAL INVENTORY\nVERIFICATION &\nRECONCILIATION";
  const subtitle = "Inventory Health, Reconciliation & Financial Risk Review";
  const clientName = (cover.clientName || "GAS ARABIAN SERVICES").toUpperCase();

  const score = Number(metrics.healthScore) || 0;
  const rawStatus = (metrics.inventoryHealthStatus || "").trim().toUpperCase();
  const ratingText = rawStatus.endsWith("RATING") ? rawStatus : `${rawStatus || "EXCELLENT"} RATING`;

  // SVG Circular progress ring parameters
  const radius = 90;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div
      id="page-cover"
      className="pdf-report-page pdf-report-page--deck"
      style={{
        width: `${CLIENT_PAGE_W}px`, height: `${CLIENT_PAGE_H}px`,
        padding: 0, margin: 0, boxSizing: "border-box",
        display: "flex", flexDirection: "row", alignItems: "stretch",
        backgroundColor: "#0B182B",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Left Column (~62% width) - Dark Navy Background #0B182B */}
      <div style={{
        width: "62%", height: "100%",
        backgroundColor: "#0B182B",
        padding: "54px 64px 40px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        boxSizing: "border-box",
      }}>
        {/* Top Content: Kicker, Title, Subtitle, Gold Line, Logos */}
        <div>
          {/* Top Logo Container: Company Logo & "Is Certified By" Client Logo */}
          {(cover.companyLogoUrl || cover.clientLogoUrl) ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              minHeight: "48px", marginBottom: "24px", gap: "16px",
            }}>
              {cover.companyLogoUrl ? (
                <img
                  src={cover.companyLogoUrl}
                  alt="Company Logo"
                  style={{ maxHeight: "48px", maxWidth: "200px", objectFit: "contain" }}
                />
              ) : <div />}

              {cover.clientLogoUrl ? (
                <img
                  src={cover.clientLogoUrl}
                  alt="Is Certified By"
                  style={{ maxHeight: "44px", maxWidth: "160px", objectFit: "contain" }}
                />
              ) : <div />}
            </div>
          ) : (
            <div style={{ height: "32px", marginBottom: "32px" }} />
          )}

          {/* Kicker: Q2 2026 · EXECUTIVE AUDIT REPORT */}
          <div style={{
            fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700,
            letterSpacing: "0.2em", textTransform: "uppercase", color: "#C69A39",
            marginBottom: "18px",
          }}>
            {kickerPeriod} &nbsp;·&nbsp; EXECUTIVE AUDIT REPORT
          </div>

          {/* Main Title: Georgia Serif, Bold White, 3 Lines */}
          <h1 style={{
            fontFamily: 'Georgia, "Times New Roman", Times, serif',
            fontSize: "44px", fontWeight: 700, color: "#FFFFFF",
            lineHeight: 1.15, letterSpacing: "-0.01em", margin: "0 0 20px 0",
            whiteSpace: "pre-line", textTransform: "uppercase",
          }}>
            {formattedTitle}
          </h1>

          {/* Subtitle: Georgia Serif, Italic, Soft Grey-Blue */}
          <p style={{
            fontFamily: 'Georgia, "Times New Roman", Times, serif',
            fontSize: "16px", fontWeight: 400, fontStyle: "italic",
            color: "#A0B0C6", margin: "0 0 26px 0", lineHeight: 1.4,
          }}>
            {subtitle}
          </p>

          {/* Gold Accent Divider Bar */}
          <div style={{
            width: "100px", height: "3px", backgroundColor: "#C69A39", borderRadius: "2px",
          }} />
        </div>

        {/* Bottom Left Meta / Branding */}
        <div>
          <span style={{
            fontFamily: 'Georgia, "Times New Roman", Times, serif',
            fontSize: "14px", fontWeight: 700, letterSpacing: "0.08em",
            color: "#FFFFFF", textTransform: "uppercase", display: "block",
          }}>
            {clientName}
          </span>
          <span style={{
            fontFamily: "sans-serif", fontSize: "11px", color: "#6C7D93", display: "block", marginTop: "6px",
          }}>
            © {new Date().getFullYear()} All Rights Reserved
          </span>
        </div>
      </div>

      {/* Right Column (~38% width) — Dedicated Health Score Panel */}
      <div style={{
        width: "38%", height: "100%",
        backgroundColor: "#12243E",
        padding: "0 32px",
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        boxSizing: "border-box",
        position: "relative",
      }}>
        {/* Panel Header: INVENTORY HEALTH SCORE */}
        <span style={{
          fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.24em",
          color: "#A0B0C6", textTransform: "uppercase", marginBottom: "36px", display: "block",
          textAlign: "center",
        }}>
          INVENTORY HEALTH SCORE
        </span>

        {/* Large SVG Circular Progress Ring (260px) */}
        <div style={{ position: "relative", width: "260px", height: "260px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="260" height="260" viewBox="0 0 260 260" style={{ transform: "rotate(-90deg)" }}>
            {/* Background Track Circle */}
            <circle cx="130" cy="130" r="108" stroke="#0B182B" strokeWidth="22" fill="transparent" />
            {/* Progress Arc (Gold) - strokeLinecap="butt" preserves exact gap for scores < 100% */}
            <circle
              cx="130" cy="130" r="108"
              stroke="#C69A39" strokeWidth="22"
              strokeDasharray={2 * Math.PI * 108}
              strokeDashoffset={2 * Math.PI * 108 - (Math.min(100, Math.max(0, score)) / 100) * 2 * Math.PI * 108}
              strokeLinecap="butt" fill="transparent"
            />
          </svg>

          {/* Inner Content: Large Score Number + Rating Text */}
          <div style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", padding: "10px", boxSizing: "border-box", pointerEvents: "none",
          }}>
            <span style={{
              fontFamily: 'Georgia, "Times New Roman", Times, serif',
              fontSize: "62px", fontWeight: 700, color: "#FFFFFF",
              lineHeight: 1, display: "block", letterSpacing: "-0.02em", margin: 0, padding: 0,
            }}>
              {score % 1 !== 0 ? score.toFixed(1) : score}
            </span>
            <span style={{
              fontFamily: "sans-serif", fontSize: "12px", fontWeight: 700, letterSpacing: "0.2em",
              color: "#C69A39", textTransform: "uppercase", display: "block", marginTop: "8px", margin: "8px 0 0 0",
            }}>
              {ratingText}
            </span>
          </div>
        </div>

        {/* Bottom Right Page Number */}
        <span style={{
          position: "absolute", bottom: "24px", right: "32px",
          fontFamily: "sans-serif", fontSize: "11px", color: "#6C7D93",
        }}>
          {pageNumber}
        </span>
      </div>
    </div>
  );
}

function ExecutivePage({ metrics, narrative, content }: {
  metrics: PreReportMetrics; narrative: ReportNarrative; content: EditableContent;
}) {
  const unverifiedValue = Math.max(0, metrics.totalInventoryValue - metrics.verifiedValue);
  const observations: string[] = [];
  observations.push(`Inventory health is calculated at ${metrics.healthScore} (${metrics.inventoryHealthStatus}).`);
  if (metrics.remainingLines > 0) {
    observations.push(`Unverified stock represents ${fmtSAR(unverifiedValue)} across ${metrics.remainingLines.toLocaleString("en-US")} remaining items.`);
  }
  observations.push(`Audit opinion: “${metrics.auditConclusion.split(" - ")[0]}”.`);
  for (const r of narrative.risks.slice(0, 2)) {
    observations.push(`${r.title} — ${r.impact}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
      <div style={{ display: "flex", gap: "14px" }}>
        <KpiCard label="Total Asset Value" value={fmtSAR(metrics.totalInventoryValue)} />
        <KpiCard label="Verified Coverage" value={fmtPct(metrics.coverageRate)} color={DARK.green} />
        <KpiCard label="Count Match Rate" value={fmtPct(metrics.matchRate)} color={DARK.green} />
        <KpiCard label="Total Absolute Risk" value={fmtSAR(metrics.totalRiskValue)} color={DARK.orange} />
      </div>

      <div style={{ display: "flex", gap: "16px", flexGrow: 1, minHeight: 0 }}>
        <div style={{ ...card, padding: "16px 20px", width: "310px", flexShrink: 0 }}>
          <span style={{ ...cardLabel, fontSize: "10px", letterSpacing: "0.06em" }}>Operational Concentration</span>
          <span style={{ ...dimCaption, display: "block", marginTop: "22px" }}>Highest Risk Cost Center</span>
          <span style={{ fontFamily: F, fontSize: "21px", fontWeight: 800, color: DARK.white, display: "block", marginTop: "4px" }}>
            {metrics.highestRiskDivision || "—"}
          </span>
          <span style={{ ...dimCaption, display: "block", marginTop: "24px" }}>Highest Risk Supplier</span>
          <span style={{ fontFamily: F, fontSize: "16px", fontWeight: 800, color: DARK.orange, display: "block", marginTop: "4px" }}>
            {metrics.highestRiskSupplier || "—"}
          </span>
        </div>

        <div style={{ ...card, padding: "16px 20px", flexGrow: 1, minWidth: 0 }}>
          <span style={{ ...cardLabel, fontSize: "10px", letterSpacing: "0.06em" }}>Key Observations</span>
          <div style={{ marginTop: "14px" }}>
            {observations.slice(0, 6).map((obs, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                <span style={{ color: DARK.white, fontSize: "11px", lineHeight: "17px" }}>•</span>
                <span style={{ fontFamily: F, fontSize: "11.5px", color: DARK.text, lineHeight: 1.5 }}>{obs}</span>
              </div>
            ))}
          </div>
          {content.executiveSummary?.trim() && (
            <p style={{ fontFamily: F, fontSize: "9.5px", color: DARK.dim, lineHeight: 1.5, margin: "6px 0 0", whiteSpace: "pre-line" }}>
              {trunc(content.executiveSummary.split("\n\n")[0], 420)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioPage({ metrics, a }: { metrics: PreReportMetrics; a: ReportAnalytics }) {
  const totalCat = Math.max(a.accuracy.matchedCount + a.accuracy.shortageCount + a.accuracy.excessCount, 1);
  const legend = [
    { label: "Matches (Zero Variance)", color: DARK.green, count: a.accuracy.matchedCount },
    { label: "Shortage (Negative Variance)", color: DARK.orange, count: a.accuracy.shortageCount },
    { label: "Excess (Positive Variance)", color: DARK.blue, count: a.accuracy.excessCount },
  ];
  // Dashboard donut segments are percentage shares summing to 100,
  // with "TOTAL / 100" rendered in the center.
  const centerTotal = Math.round(legend.reduce((s, l) => s + (l.count / totalCat) * 100, 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
      <div style={{ display: "flex", gap: "14px" }}>
        <KpiCard label="Total Inventory Value" value={fmtSAR(metrics.totalInventoryValue)} caption="Gross asset valuation under audit" />
        <KpiCard label="Verified Value" value={fmtSAR(metrics.verifiedValue)} color={DARK.green} caption={`Physically confirmed (${fmtPct(metrics.coverageRate)})`} />
        <KpiCard label="Total Financial Risk" value={fmtSAR(metrics.totalRiskValue)} color={DARK.orange} caption="Sum of absolute variances" />
        <KpiCard label="Accuracy Match Rate" value={fmtPct(metrics.matchRate)} color={DARK.green} caption="Zero-variance line items" />
      </div>

      <div style={{ display: "flex", gap: "16px", flexGrow: 1, minHeight: 0 }}>
        <div style={{ ...card, padding: "16px 20px", width: "330px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ ...cardLabel, fontSize: "10px", letterSpacing: "0.06em" }}>Health Score</span>
          <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Donut
              segments={[
                { value: Math.max(metrics.healthScore, 0.001), color: DARK.green },
                { value: Math.max(100 - metrics.healthScore, 0.001), color: "rgba(255,255,255,0.08)" },
              ]}
              size={190} thickness={34}
              centerTop={String(metrics.healthScore)}
              centerBottom={metrics.inventoryHealthStatus}
            />
          </div>
        </div>

        <div style={{ ...card, padding: "16px 20px", flexGrow: 1, minWidth: 0 }}>
          <span style={{ ...cardLabel, fontSize: "10px", letterSpacing: "0.06em" }}>Accuracy Breakdown</span>
          <span style={{ ...dimCaption, display: "block", marginTop: "3px" }}>Percentage of verified line items by discrepancy category</span>
          <div style={{ display: "flex", alignItems: "center", gap: "44px", marginTop: "14px" }}>
            <Donut
              segments={legend.map(l => ({ value: Math.max(l.count, 0.001), color: l.color }))}
              size={210} thickness={40}
              centerTop={String(centerTotal)} centerBottom="TOTAL"
              centerColor={DARK.white} centerTopSize="28px"
            />
            <div>
              {legend.map((l) => (
                <div key={l.label} style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: l.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: "11.5px", fontWeight: 700, color: DARK.white }}>{l.label}</span>
                  </div>
                  <span style={{ ...dimCaption, fontSize: "10px", display: "block", marginLeft: "21px", marginTop: "3px" }}>
                    {fmtPct((l.count / totalCat) * 100)} · {l.count.toLocaleString("en-US")} item{l.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoveragePage({ metrics }: { metrics: PreReportMetrics }) {
  const topDivs = metrics.divisions.slice(0, 5);
  const topSups = [...metrics.suppliers].sort((a, b) => b.absoluteVarianceValue - a.absoluteVarianceValue).slice(0, 5);
  const maxVar = Math.max(...topSups.map(s => s.absoluteVarianceValue), 1);
  const lineRate = metrics.totalLines > 0 ? metrics.verifiedLines / metrics.totalLines : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
      <div style={{ display: "flex", gap: "16px", flexGrow: 1, minHeight: 0 }}>
        <Panel title="Division Coverage Rate" subtitle="Verification completion rate by operational cost center" style={{ flex: 1 }}>
          {topDivs.map((d) => (
            <BarRow
              key={d.division}
              label={d.division}
              valueLabel={fmtPct(d.coverageRate)}
              ratio={d.coverageRate / 100}
              color={d.coverageRate >= 95 ? DARK.green : DARK.blue}
            />
          ))}
        </Panel>

        <Panel title="Top 5 Suppliers by Absolute Variance" subtitle="Suppliers associated with highest financial risk" style={{ flex: 1 }}>
          {topSups.map((s) => (
            <BarRow
              key={s.supplier}
              label={s.supplier}
              valueLabel={fmtSAR(s.absoluteVarianceValue)}
              ratio={s.absoluteVarianceValue / maxVar}
              color={DARK.orange}
            />
          ))}
        </Panel>
      </div>

      <div style={{ ...card, padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ ...cardLabel, fontSize: "11px", letterSpacing: "0.06em" }}>Stock Count Performance</span>
            <span style={{ ...dimCaption, display: "block", marginTop: "3px" }}>Progress rate of physical item verification lines</span>
          </div>
          <div style={{ backgroundColor: DARK.greenDeep, borderRadius: "16px", padding: "8px 22px" }}>
            <span style={{ fontFamily: F, fontSize: "10.5px", fontWeight: 800, color: DARK.white }}>
              {fmtPct(metrics.coverageRate)} COVERED
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "60px", marginTop: "12px" }}>
          <div style={{ width: "300px", flexShrink: 0 }}>
            <span style={{ fontFamily: F, fontSize: "10.5px", fontWeight: 700, color: DARK.white, display: "block" }}>Verified Count Lines</span>
            <span style={{ fontFamily: F, fontSize: "17px", fontWeight: 800, color: DARK.white, display: "block", marginTop: "4px" }}>
              {metrics.verifiedLines.toLocaleString("en-US")} / {metrics.totalLines.toLocaleString("en-US")}
            </span>
            <div style={{ height: "12px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: "8px" }}>
              <div style={{ height: "100%", width: `${Math.max(2, lineRate * 100)}%`, backgroundColor: DARK.goldSoft, borderRadius: "3px" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
              <span style={dimCaption}>Remaining: {metrics.remainingLines.toLocaleString("en-US")} lines</span>
              <span style={dimCaption}>Rate: {fmtPct(lineRate * 100)}</span>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontFamily: F, fontSize: "10.5px", fontWeight: 800, color: DARK.gold, display: "block" }}>Verification Analysis</span>
            <p style={{ fontFamily: F, fontSize: "10.5px", color: DARK.text, lineHeight: 1.55, margin: "6px 0 0" }}>
              Physical inventory audit has covered {metrics.verifiedLines.toLocaleString("en-US")} unique catalog entries out of {metrics.totalLines.toLocaleString("en-US")}.
              Total quantities verified reach {metrics.verifiedQuantity.toLocaleString("en-US")} units out of {metrics.totalQuantity.toLocaleString("en-US")}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DivisionsPage({ metrics, a }: { metrics: PreReportMetrics; a: ReportAnalytics }) {
  const divs = metrics.divisions;
  const perfect = divs.filter(d => d.coverageRate >= 100).length;
  const laggards = divs.filter(d => d.coverageRate < 100).sort((x, y) => Math.abs(y.varianceValue) - Math.abs(x.varianceValue)).slice(0, 3).map(d => d.division);
  // Dashboard color thresholds for Division Verification Rates
  const covColor = (rate: number) => rate >= 95 ? "#10b981" : rate >= 80 ? "#6366f1" : "#f43f5e";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%" }}>
      <WWWCards
        what={`Reconciliation performance audit across ${divs.length} distinct organizational divisions.`}
        where="Grouped based on item organization cost codes and original Excel sheets."
        why="Identifies divisions with verification coverage gaps or net adjustment risks to guide operational remediation."
      />

      <div style={{ display: "flex", gap: "14px" }}>
        <KpiCard label="Total Divisions" value={String(divs.length)} caption="Active cost centers under audit" />
        <KpiCard label="Highest Coverage" value={a.highestCoverageDivision?.name || "N/A"} color={DARK.green} caption={a.highestCoverageDivision ? `(${a.highestCoverageDivision.coverageRate.toFixed(1)}% verified)` : undefined} />
        <KpiCard label="Highest Risk Division" value={metrics.highestRiskDivision || "—"} color={DARK.orange} caption="Highest variance cost center" />
        <KpiCard label="Net Ops Variance" value={signedMoney(metrics.varianceValue).replace(".00", "")} color={DARK.orange} caption="Total operational variance" />
      </div>

      <div style={{ display: "flex", gap: "16px", flexGrow: 1, minHeight: 0 }}>
        <Panel
          title="Division Verification Rates"
          subtitle="Percentage of ERP ledger value verified physically"
          style={{ flex: 1.25, minWidth: 0 }}
        >
          {divs.map((d) => (
            <div key={d.division} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "3px", height: "11px" }}>
              <span style={{ fontFamily: F, fontSize: "8px", lineHeight: "10px", fontWeight: 700, color: DARK.white, width: "44px", flexShrink: 0, whiteSpace: "nowrap" }}>
                {trunc(d.division, 8)}
              </span>
              <div style={{ flexGrow: 1, height: "6px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, d.coverageRate))}%`, borderRadius: "2px", backgroundColor: covColor(d.coverageRate) }} />
              </div>
              <span style={{ fontFamily: F, fontSize: "8px", lineHeight: "10px", fontWeight: 800, color: DARK.white, width: "44px", flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {d.coverageRate.toFixed(1)}%
              </span>
            </div>
          ))}
        </Panel>

        <div style={{ ...card, padding: "18px 22px", flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: F, fontSize: "12px", color: DARK.text, lineHeight: 1.75, margin: 0 }}>
            Division reconciliation covers all {divs.length} cost centers with a blended verification coverage of {fmtPct(metrics.coverageRate)} and
            a net operational variance of {signedMoney(metrics.varianceValue).replace(".00", "")}. {perfect} of {divs.length} divisions
            ({fmtPct(divs.length ? (perfect / divs.length) * 100 : 0, 0)}) have reached 100% count coverage
            {laggards.length > 0
              ? `; the remaining ${divs.length - perfect} carry the bulk of open verification work and financial risk, led by ${laggards.join(", ")}.`
              : "."}
          </p>
        </div>
      </div>
    </div>
  );
}

function DivisionItemsPage({ metrics }: { metrics: PreReportMetrics }) {
  const divs = metrics.divisions;
  const byItems = [...divs].sort((a, b) => b.itemCount - a.itemCount);
  const largest = byItems[0];
  const rest = byItems.slice(1, 20);
  const maxRest = Math.max(...rest.map(d => d.itemCount), 1);
  const perfect = divs.filter(d => d.coverageRate >= 100).length;
  const topVariance = [...divs].sort((a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue)).slice(0, 3);
  const riskDiv = divs.find(d => d.division === metrics.highestRiskDivision);

  return (
    <div style={{ display: "flex", gap: "16px", height: "100%" }}>
      <Panel
        title="Division Items Mapped"
        subtitle={largest ? `Total item catalog counts under cost centers · ${largest.division} (${largest.itemCount.toLocaleString("en-US")} items) shown as a callout since it dwarfs the rest` : "Total item catalog counts under cost centers"}
        style={{ flex: 1.35, display: "flex", flexDirection: "column" }}
      >
        {largest && (
          <div style={{
            display: "inline-block", border: `1.5px solid ${DARK.gold}`, borderRadius: "8px",
            padding: "12px 26px", textAlign: "center", alignSelf: "flex-start", marginBottom: "16px",
          }}>
            <span style={{ fontFamily: F, fontSize: "11px", fontWeight: 800, color: DARK.gold, display: "block" }}>{largest.division}</span>
            <span style={{ fontFamily: F, fontSize: "17px", fontWeight: 800, color: DARK.white, display: "block", marginTop: "4px" }}>
              {largest.itemCount.toLocaleString("en-US")}
            </span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "230px", paddingBottom: "4px" }}>
          {rest.map((d) => (
            <div key={d.division} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
              <div style={{
                width: "70%", backgroundColor: DARK.blue, borderRadius: "2px 2px 0 0",
                height: `${Math.max(3, (d.itemCount / maxRest) * 100)}%`,
              }} />
              <span style={{ fontFamily: F, fontSize: "7.5px", color: DARK.dim, marginTop: "5px", whiteSpace: "nowrap" }}>{d.division}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
        <Panel title="Division Insights & Risks">
          <div style={{ display: "flex", gap: "20px" }}>
            {[
              ["Perfect Coverage", `${perfect} / ${metrics.divisions.length}`, "Divisions @ 100%", DARK.white],
              ["Highest Volume", largest?.division || "—", largest ? `${largest.itemCount.toLocaleString("en-US")} items` : "", DARK.white],
              ["Highest Risk", metrics.highestRiskDivision || "—", riskDiv ? fmtSAR(Math.abs(riskDiv.varianceValue)) : "", DARK.white],
            ].map(([label, value, cap, color]) => (
              <div key={label as string} style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...cardLabel, fontSize: "8px", color: DARK.dim }}>{label}</span>
                <span style={{ fontFamily: F, fontSize: "16px", fontWeight: 800, color: color as string, display: "block", marginTop: "8px", whiteSpace: "nowrap" }}>{trunc(value, 14)}</span>
                <span style={{ ...dimCaption, fontSize: "8.5px", display: "block", marginTop: "5px" }}>{cap}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Top 3 Variance Divisions" style={{ flexGrow: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Division</th>
                <th style={th}>Items</th>
                <th style={th}>Coverage</th>
                <th style={th}>Net Variance</th>
              </tr>
            </thead>
            <tbody>
              {topVariance.map((d) => (
                <tr key={d.division}>
                  <td style={td}>{d.division}</td>
                  <td style={td}>{d.itemCount.toLocaleString("en-US")}</td>
                  <td style={td}>{fmtPct(d.coverageRate)}</td>
                  <td style={{ ...td, color: d.varianceValue < 0 ? DARK.red : DARK.green, fontWeight: 800 }}>
                    {signedMoney(d.varianceValue).replace(".00", "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function WorkbooksPage({ metrics, a }: { metrics: PreReportMetrics; a: ReportAnalytics }) {
  const sheets = metrics.subDivisions.slice(0, 3);
  const divQty = a.divisionQty;
  const largest = divQty[0];
  const rest = divQty.slice(1, 20);
  const maxRest = Math.max(...rest.map(v => Math.max(v.physicalCount, v.systemOnHand)), 1);
  // Four side-by-side column groups keep all divisions within the fixed
  // page height (5 rows each for 20 divisions).
  const perCol = Math.ceil(divQty.length / 4) || 1;
  const columns = [0, 1, 2, 3]
    .map(i => divQty.slice(i * perCol, (i + 1) * perCol))
    .filter(colRows => colRows.length > 0);

  const cth: React.CSSProperties = { ...th, fontSize: "7.5px" };
  const ctd: React.CSSProperties = { ...td, fontSize: "7.5px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
      <Panel title="Sub-Division Workbook Sheet Analysis" subtitle="Ingested workbook worksheet performance statistics">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cth}>Sheet Name</th>
              <th style={cth}>Items Count</th>
              <th style={cth}>ERP Value</th>
              <th style={cth}>Verified Value</th>
              <th style={cth}>Coverage Rate</th>
              <th style={cth}>Net Variance</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.subDivision}>
                <td style={ctd}>{s.subDivision}</td>
                <td style={ctd}>{s.itemCount.toLocaleString("en-US")}</td>
                <td style={ctd}>{fmtSAR(s.erpValue)}</td>
                <td style={ctd}>{fmtSAR(s.verifiedValue)}</td>
                <td style={{ ...ctd, color: DARK.green }}>{fmtPct(s.coverageRate)}</td>
                <td style={{ ...ctd, color: s.varianceValue < 0 ? DARK.red : DARK.text, fontWeight: 700 }}>
                  {signedMoney(s.varianceValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Physical Count vs System On Hand by Division"
        subtitle={largest ? `${largest.division} carries most units and is shown separately at left; remaining divisions plotted at their own scale` : "Quantities by division"}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", gap: "20px", height: "108px" }}>
          {largest && (
            <div style={{
              width: "170px", flexShrink: 0, border: `1px solid ${DARK.cardBorder}`,
              borderRadius: "8px", backgroundColor: DARK.cardSoft,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
            }}>
              <span style={{ fontFamily: F, fontSize: "12px", fontWeight: 800, color: DARK.gold }}>{largest.division}</span>
              <span style={{ ...dimCaption, fontSize: "8px" }}>Physical Count</span>
              <span style={{ fontFamily: F, fontSize: "14px", fontWeight: 800, color: DARK.green }}>{largest.physicalCount.toLocaleString("en-US")}</span>
              <span style={{ ...dimCaption, fontSize: "8px", marginTop: "3px" }}>System On Hand</span>
              <span style={{ fontFamily: F, fontSize: "14px", fontWeight: 800, color: DARK.blue }}>{largest.systemOnHand.toLocaleString("en-US")}</span>
            </div>
          )}
          <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "6px" }}>
              {[["Physical Count", DARK.green], ["System On Hand", DARK.blue]].map(([label, color]) => (
                <span key={label as string} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", backgroundColor: color as string, display: "inline-block" }} />
                  <span style={{ ...dimCaption, fontSize: "9px", color: DARK.text }}>{label}</span>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "7px", flexGrow: 1, borderBottom: `1px solid ${DARK.tableBorder}`, paddingBottom: "2px" }}>
              {rest.map((v) => (
                <div key={v.division} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "100%", width: "80%", justifyContent: "center" }}>
                    <div style={{ width: "42%", backgroundColor: DARK.green, height: `${Math.max(2, (v.physicalCount / maxRest) * 100)}%`, borderRadius: "1.5px 1.5px 0 0" }} />
                    <div style={{ width: "42%", backgroundColor: DARK.blue, height: `${Math.max(2, (v.systemOnHand / maxRest) * 100)}%`, borderRadius: "1.5px 1.5px 0 0" }} />
                  </div>
                  <span style={{ fontFamily: F, fontSize: "7px", color: DARK.dim, marginTop: "4px", whiteSpace: "nowrap" }}>{v.division}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Division comparison table — same values as the chart above */}
        <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
          {columns.map((colRows, ci) => (
            <table key={ci} style={{ width: "100%", borderCollapse: "collapse", flex: 1 }}>
              <thead>
                <tr>
                  <th style={cth}>Division</th>
                  <th style={{ ...cth, textAlign: "right" }}>Physical</th>
                  <th style={{ ...cth, textAlign: "right" }}>System</th>
                  <th style={{ ...cth, textAlign: "right" }}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {colRows.map((v) => (
                  <tr key={v.division}>
                    <td style={{ ...ctd, fontWeight: 700, color: DARK.white }}>{v.division}</td>
                    <td style={{ ...ctd, textAlign: "right" }}>{v.physicalCount.toLocaleString("en-US")}</td>
                    <td style={{ ...ctd, textAlign: "right" }}>{v.systemOnHand.toLocaleString("en-US")}</td>
                    <td style={{ ...ctd, textAlign: "right", fontWeight: 800, color: v.difference < 0 ? DARK.red : v.difference > 0 ? DARK.green : DARK.text }}>
                      {v.difference > 0 ? "+" : ""}{v.difference.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SuppliersPage({ metrics, a }: { metrics: PreReportMetrics; a: ReportAnalytics }) {
  const top5 = a.suppliersByVariance.slice(0, 5);
  const maxVar = Math.max(...top5.map(s => s.absoluteVarianceValue), 1);
  const totalAbs = Math.max(a.supplierAbsVarianceTotal, 0.0001);
  const top3 = a.suppliersByVariance.slice(0, 3);
  const othersVar = Math.max(totalAbs - top3.reduce((s, x) => s + x.absoluteVarianceValue, 0), 0);
  const donutColors = [DARK.orange, DARK.goldSoft, DARK.blue, "rgba(255,255,255,0.14)"];
  const legend = [
    ...top3.map((s, i) => ({ label: s.supplier, value: s.absoluteVarianceValue, color: donutColors[i] })),
    { label: "All Others", value: othersVar, color: donutColors[3] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
      <WWWCards
        what={`Audit reconciliations mapped across ${metrics.suppliers.length} resolved supplier entities.`}
        where="Discrepancy levels tracked by grouping parsed rows to supplier names."
        why="Enables vendor delivery auditing, contract review, and identification of supply chains with material risk."
      />

      <div style={{ display: "flex", gap: "14px" }}>
        <KpiCard label="Mapped Suppliers" value={String(metrics.suppliers.length)} caption="Resolved suppliers in file" />
        <KpiCard label="Top Exposure Supplier" value={metrics.highestRiskSupplier || "—"} color={DARK.orange} caption="Supplier with highest variance" valueSize="15px" />
        <KpiCard label="Supplier Abs Variance" value={fmtSAR(a.supplierAbsVarianceTotal)} color={DARK.orange} caption="Total supplier absolute risk" />
        <KpiCard label="Average Match Rate" value={fmtPct(a.avgSupplierMatchRate)} color={DARK.green} caption="Average supplier line matching" />
      </div>

      <div style={{ display: "flex", gap: "16px", flexGrow: 1, minHeight: 0 }}>
        <Panel title="Top 5 Suppliers by Absolute Variance" subtitle="Highest financial risk associated with suppliers" style={{ flex: 1 }}>
          {top5.map((s) => (
            <BarRow
              key={s.supplier}
              label={s.supplier}
              valueLabel={fmtSAR(s.absoluteVarianceValue)}
              ratio={s.absoluteVarianceValue / maxVar}
              color={DARK.orange}
            />
          ))}
        </Panel>

        <Panel title="Variance Share of Top Suppliers" style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "26px" }}>
            <Donut
              segments={legend.map(l => ({ value: Math.max(l.value, 0.001), color: l.color }))}
              size={140} thickness={26}
              centerTop={`SAR ${abbrev(totalAbs)}`} centerBottom="TOTAL"
              centerColor={DARK.white} centerTopSize="13px"
            />
            <div style={{ minWidth: 0 }}>
              {legend.map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "11px", minWidth: 0 }}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: l.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: F, fontSize: "9.5px", color: DARK.text, whiteSpace: "nowrap" }}>
                    {trunc(l.label, 22)} — {fmtPct((l.value / totalAbs) * 100)} · {fmtSAR(l.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SuppliersAllPage({ metrics, a }: { metrics: PreReportMetrics; a: ReportAnalytics }) {
  /* Sort by ERP Value descending — uses existing metrics.suppliers dataset,
     the same single source of truth as the Dashboard. No new calculations. */
  const list = [...a.metrics.suppliers]
    .sort((x, y) => y.erpValue - x.erpValue)
    .slice(0, 15);

  /** Display-time sanitizer: strips Unicode replacement characters (U+FFFD)
      that may appear when Excel source files contain non-UTF-8 encoded text.
      This is purely cosmetic — no upstream data is modified. */
  const cleanName = (name: string) => name.replace(/\uFFFD/g, "").trim();

  const sth: React.CSSProperties = {
    ...th,
    padding: "10px 8px",
    fontSize: "10.5px",
  };
  const std: React.CSSProperties = {
    ...td,
    padding: "10px 8px",
    fontSize: "10.5px",
    lineHeight: 1.3,
  };
  /* Column width percentages — give supplier name the lion's share;
     tableLayout: fixed ensures columns respect these widths exactly. */
  const colW = { name: "34%", items: "7%", erp: "18%", cov: "11%", var: "18%", match: "12%" };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th style={{ ...sth, width: colW.name }}>Supplier Name</th>
          <th style={{ ...sth, width: colW.items }}>Items</th>
          <th style={{ ...sth, width: colW.erp }}>ERP Value</th>
          <th style={{ ...sth, width: colW.cov }}>Value Coverage</th>
          <th style={{ ...sth, width: colW.var }}>Abs. Variance</th>
          <th style={{ ...sth, width: colW.match }}>Line Match Rate</th>
        </tr>
      </thead>
      <tbody>
        {list.map((s) => (
          <tr key={s.supplier}>
            <td style={{ ...std, fontWeight: 700, color: DARK.white, wordWrap: "break-word" as const, overflowWrap: "break-word" as const, whiteSpace: "normal" }}>{cleanName(s.supplier)}</td>
            <td style={std}>{s.itemCount.toLocaleString("en-US")}</td>
            <td style={std}>{money(s.erpValue, 0)}</td>
            <td style={{ ...std, color: s.coverageRate >= 90 ? DARK.green : s.coverageRate >= 50 ? DARK.gold : DARK.orange }}>
              {fmtPct(s.coverageRate)}
            </td>
            <td style={{ ...std, color: s.absoluteVarianceValue > 1000 ? DARK.orange : DARK.text, fontWeight: s.absoluteVarianceValue > 1000 ? 800 : 400 }}>
              {money(s.absoluteVarianceValue, 0)}
            </td>
            <td style={std}>{fmtPct(s.matchingRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WorkforcePage({ metrics, a }: { metrics: PreReportMetrics; a: ReportAnalytics }) {
  const counters = a.counters;
  const top = counters[0];
  const totalCounted = counters.reduce((s, c) => s + c.itemsCounted, 0);
  const avgAccuracy = counters.length ? counters.reduce((s, c) => s + c.accuracyRate, 0) / counters.length : 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
      <WWWCards
        what={`Reconciliation performance tracked for ${counters.length} active count specialist${counters.length === 1 ? "" : "s"}.`}
        where="Physical stock bins and count tags on the warehouse floor."
        why="Evaluates speed, productivity and accuracy rate per counter to ensure verification process data integrity."
      />

      <div style={{ display: "flex", gap: "14px" }}>
        <KpiCard label="Active Counters" value={String(counters.length)} caption="Physical count specialists" />
        <KpiCard label="Top Counter" value={top?.name || "—"} color={DARK.green} caption={top ? `${top.itemsCounted.toLocaleString("en-US")} items counted` : undefined} valueSize="16px" />
        <KpiCard label="Lines Attributed" value={totalCounted.toLocaleString("en-US")} caption="Count lines with a named counter" />
        <KpiCard label="Average Accuracy" value={fmtPct(avgAccuracy)} color={avgAccuracy >= 95 ? DARK.green : DARK.gold} caption="Mean zero-variance rate across team" />
      </div>

      <Panel title="Productivity Share" subtitle="Portion of attributed count lines completed per specialist" style={{ flexGrow: 1 }}>
        {counters.map((c) => (
          <BarRow
            key={c.name}
            label={c.name}
            valueLabel={`${c.itemsCounted.toLocaleString("en-US")} · ${fmtPct(c.productivityRate)}`}
            ratio={totalCounted > 0 ? c.itemsCounted / Math.max(counters[0]?.itemsCounted || 1, 1) : 0}
            color={DARK.blue}
          />
        ))}
        {counters.length === 0 && (
          <p style={{ fontFamily: F, fontSize: "10.5px", color: DARK.dim, margin: 0 }}>
            No applicable data was available for this reporting period.
          </p>
        )}
      </Panel>
    </div>
  );
}

function LeaderboardPage({ metrics, a }: { metrics: PreReportMetrics; a: ReportAnalytics }) {
  const counters = a.counters;
  return counters.length === 0 ? (
    <p style={{ fontFamily: F, fontSize: "11px", color: DARK.dim }}>
      No applicable data was available for this reporting period.
    </p>
  ) : (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>Rank</th>
          <th style={th}>Counter</th>
          <th style={th}>Items Counted</th>
          <th style={th}>Physical Qty</th>
          <th style={th}>Verified Value</th>
          <th style={th}>Productivity</th>
          <th style={th}>Accuracy</th>
        </tr>
      </thead>
      <tbody>
        {counters.map((c, i) => (
          <tr key={c.name}>
            <td style={td}>{i + 1}</td>
            <td style={{ ...td, fontWeight: 800, color: DARK.white }}>{c.name}</td>
            <td style={td}>{c.itemsCounted.toLocaleString("en-US")}</td>
            <td style={td}>{c.verifiedQty.toLocaleString("en-US")}</td>
            <td style={td}>{money(c.verifiedValue)}</td>
            <td style={td}>{fmtPct(c.productivityRate)}</td>
            <td style={{ ...td, color: c.accuracyRate >= 95 ? DARK.green : c.accuracyRate >= 80 ? DARK.gold : DARK.red }}>
              {fmtPct(c.accuracyRate)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RiskPage({ metrics, narrative }: { metrics: PreReportMetrics; narrative: ReportNarrative }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
      <WWWCards
        what={`Identified absolute financial risk of ${fmtSAR(metrics.totalRiskValue)} across ${metrics.totalLines.toLocaleString("en-US")} inventory line items.`}
        where="Concentrated within high-variance line items across divisions."
        why="Provides core write-off analysis to proactively isolate high-risk asset records and support financial provisioning."
      />

      <div style={{ display: "flex", gap: "14px" }}>
        <KpiCard label="Total Absolute Risk" value={fmtSAR(metrics.totalRiskValue)} color={DARK.orange} caption="Sum of absolute variances" />
        <KpiCard label="Net Variance" value={signedMoney(metrics.varianceValue).replace(".00", "")} color={metrics.varianceValue < 0 ? DARK.orange : DARK.green} caption="Excess offset against shortage" />
        <KpiCard label="Shortage Value" value={fmtSAR(metrics.totalShortageValue)} color={DARK.orange} caption="Physically missing vs ERP" />
        <KpiCard label="Excess Value" value={fmtSAR(metrics.totalExcessValue)} color={DARK.green} caption="Surplus stock discovered" />
      </div>

      <Panel title="Top 5 High-Risk Discrepancy Items" subtitle="Sorted by absolute variance descending">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, padding: "6px 10px" }}>Item Code</th>
              <th style={{ ...th, padding: "6px 10px" }}>Supplier</th>
              <th style={{ ...th, padding: "6px 10px" }}>Organization</th>
              <th style={{ ...th, padding: "6px 10px", textAlign: "right" }}>ERP Qty</th>
              <th style={{ ...th, padding: "6px 10px", textAlign: "right" }}>Physical Qty</th>
              <th style={{ ...th, padding: "6px 10px", textAlign: "right" }}>Variance Value</th>
              <th style={{ ...th, padding: "6px 10px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {metrics.highestRiskItems.slice(0, 5).map((item: any, i: number) => {
              const v = item.varianceValue ?? 0;
              return (
                <tr key={i}>
                  <td style={{ ...td, padding: "4.5px 10px", fontWeight: 700, color: DARK.white }}>{item.itemCode || "N/A"}</td>
                  <td style={{ ...td, padding: "4.5px 10px", whiteSpace: "nowrap" }}>
                    {trunc(item.supplier || item.supplierName || item.detectedSupplierName || "Others", 24)}
                  </td>
                  <td style={{ ...td, padding: "4.5px 10px" }}>{item.org || "—"}</td>
                  <td style={{ ...td, padding: "4.5px 10px", textAlign: "right" }}>{(item.erpQty ?? 0).toLocaleString("en-US")}</td>
                  <td style={{ ...td, padding: "4.5px 10px", textAlign: "right" }}>{(item.physicalQty ?? 0).toLocaleString("en-US")}</td>
                  <td style={{ ...td, padding: "4.5px 10px", textAlign: "right", color: v < 0 ? DARK.red : DARK.green, fontWeight: 800 }}>{signedMoney(v)}</td>
                  <td style={{ ...td, padding: "4.5px 10px", color: DARK.orange, fontWeight: 800, letterSpacing: "0.06em" }}>
                    {(item.status || "open").toUpperCase()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel title="Key Risk Findings" subtitle="Data-supported findings generated from this cycle's reconciliation" style={{ flexGrow: 1 }}>
        {narrative.risks.slice(0, 2).map((r) => (
          <div key={r.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "9px" }}>
            <span style={{
              flexShrink: 0, fontFamily: F, fontSize: "8.5px", fontWeight: 800, letterSpacing: "0.08em",
              color: riskColorOf(r.level.toUpperCase() === "CRITICAL" ? "HIGH" : r.level.toUpperCase()),
              border: `1px solid ${DARK.cardBorder}`, borderRadius: "4px",
              backgroundColor: DARK.cardSoft, padding: "4px 9px", textTransform: "uppercase",
            }}>
              {r.level}
            </span>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontFamily: F, fontSize: "11px", fontWeight: 800, color: DARK.white, display: "block" }}>{r.title}</span>
              <span style={{ fontFamily: F, fontSize: "9.5px", color: DARK.dim, display: "block", marginTop: "2px" }}>
                {r.impact} → {r.action}
              </span>
            </div>
          </div>
        ))}
        {narrative.risks.length === 0 && (
          <p style={{ fontFamily: F, fontSize: "10.5px", color: DARK.dim, margin: 0 }}>
            No business risks met the evidence threshold in this cycle.
          </p>
        )}
      </Panel>
    </div>
  );
}

function RiskItemsPage({ metrics }: { metrics: PreReportMetrics }) {
  const items = metrics.highestRiskItems.slice(0, 10);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>Item Code</th>
          <th style={th}>Supplier</th>
          <th style={th}>Org</th>
          <th style={th}>ERP / Phys</th>
          <th style={th}>Variance Value</th>
          <th style={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item: any, i: number) => {
          const v = item.varianceValue ?? 0;
          return (
            <tr key={i}>
              <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700, color: DARK.white }}>
                {item.itemCode || "N/A"}
              </td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>
                {trunc(item.supplier || item.supplierName || item.detectedSupplierName || "Others", 22)}
              </td>
              <td style={td}>{item.org || "—"}</td>
              <td style={td}>{(item.erpQty ?? 0).toLocaleString("en-US")} / {(item.physicalQty ?? 0).toLocaleString("en-US")}</td>
              <td style={{ ...td, color: v < 0 ? DARK.red : DARK.green, fontWeight: 800 }}>{signedMoney(v)}</td>
              <td style={{ ...td, color: DARK.orange, fontWeight: 800, letterSpacing: "0.06em" }}>
                {(item.status || "open").toUpperCase()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RegistryPage({ metrics, a }: { metrics: PreReportMetrics; a: ReportAnalytics }) {
  const filters = ["Search code / description / supplier", "All Suppliers", "All Organizations", "All Issue Categories", "All Risk Levels"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
      <WWWCards
        what={`Displaying detailed reconciliation registry for ${metrics.totalLines.toLocaleString("en-US")} matching items.`}
        where="Spanning all worksheets, warehouse cost organizations, and suppliers."
        why="Provides the ultimate trace utility for individual discrepancies, with sortable, filterable, multi-field query support."
      />

      <div style={{ display: "flex", gap: "14px" }}>
        <KpiCard label="Filtered Items" value={metrics.totalLines.toLocaleString("en-US")} />
        <KpiCard label="Action Required" value={a.actionRequiredCount.toLocaleString("en-US")} color={DARK.gold} />
        <KpiCard label="Filtered Abs Risk" value={fmtSAR(metrics.totalRiskValue)} color={DARK.orange} />
        <KpiCard label="Filtered Net Variance" value={signedMoney(metrics.varianceValue).replace(".00", "")} color={DARK.orange} />
      </div>

      <Panel title="Display Filters" style={{ flexGrow: 1 }}>
        <div style={{ display: "flex", gap: "12px" }}>
          {filters.map((f) => (
            <div key={f} style={{
              flex: 1, minWidth: 0, border: `1px solid ${DARK.cardBorder}`, borderRadius: "6px",
              backgroundColor: DARK.cardSoft, padding: "12px 14px",
            }}>
              <span style={{ fontFamily: F, fontSize: "9.5px", color: DARK.dim, whiteSpace: "nowrap", display: "block" }}>{trunc(f, 30)}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: F, fontSize: "11px", color: DARK.text, lineHeight: 1.6, margin: "16px 0 0" }}>
          The registry supports responsive headers, column sorting, pagination, and multi-field query inputs — spanning
          all {metrics.divisions.length} divisions and {metrics.suppliers.length} supplier entities.
        </p>
      </Panel>
    </div>
  );
}

function ActionItemsPage({ a }: { a: ReportAnalytics }) {
  // Top 15 of the SAME dataset the dashboard ledger uses (non-closed
  // items), sorted by absolute variance descending.
  const rows = a.actionItems.slice(0, 15);
  const cleanVal = (val: string) => String(val ?? "").replace(/\uFFFD/g, "").trim();

  const cth: React.CSSProperties = { ...th, padding: "6px 8px", fontSize: "9px" };
  const ctd: React.CSSProperties = { ...td, padding: "5px 8px", fontSize: "9px" };
  
  const colW = {
    itemCode: "12%",
    supplier: "22%",
    division: "10%",
    erpQty: "9%",
    physQty: "9%",
    varQty: "9%",
    varVal: "15%",
    status: "7%",
    priority: "7%"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {rows.length === 0 ? (
        <p style={{ fontFamily: F, fontSize: "11px", color: DARK.dim }}>
          No applicable data was available for this reporting period.
        </p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ ...cth, width: colW.itemCode }}>Item Code</th>
                <th style={{ ...cth, width: colW.supplier }}>Supplier</th>
                <th style={{ ...cth, width: colW.division }}>Division</th>
                <th style={{ ...cth, width: colW.erpQty, textAlign: "right" }}>ERP Qty</th>
                <th style={{ ...cth, width: colW.physQty, textAlign: "right" }}>Physical Qty</th>
                <th style={{ ...cth, width: colW.varQty, textAlign: "right" }}>Variance Qty</th>
                <th style={{ ...cth, width: colW.varVal, textAlign: "right" }}>Variance Value</th>
                <th style={{ ...cth, width: colW.status }}>Status</th>
                <th style={{ ...cth, width: colW.priority }}>Action Priority</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, i: number) => {
                const level = riskLevelOf(r.absoluteVarianceValue ?? 0);
                const v = r.varianceValue ?? 0;
                return (
                  <tr key={i}>
                    <td style={{ 
                      ...ctd, 
                      fontWeight: 700, 
                      color: DARK.white,
                      wordWrap: "break-word" as const, 
                      overflowWrap: "break-word" as const, 
                      whiteSpace: "normal" as const 
                    }}>
                      {cleanVal(r.itemCode || "N/A")}
                    </td>
                    <td style={{ 
                      ...ctd, 
                      wordWrap: "break-word" as const, 
                      overflowWrap: "break-word" as const, 
                      whiteSpace: "normal" as const,
                      lineHeight: 1.25 
                    }}>
                      {cleanVal(r.supplier || "Others")}
                    </td>
                    <td style={{ 
                      ...ctd, 
                      wordWrap: "break-word" as const, 
                      overflowWrap: "break-word" as const, 
                      whiteSpace: "normal" as const 
                    }}>{cleanVal(r.org || "—")}</td>
                    <td style={{ ...ctd, textAlign: "right" }}>{(r.erpQty ?? 0).toLocaleString("en-US")}</td>
                    <td style={{ ...ctd, textAlign: "right" }}>{(r.physicalQty ?? 0).toLocaleString("en-US")}</td>
                    <td style={{ ...ctd, textAlign: "right", color: (r.differenceQty ?? 0) < 0 ? DARK.red : (r.differenceQty ?? 0) > 0 ? DARK.green : DARK.text }}>
                      {(r.differenceQty ?? 0) > 0 ? "+" : ""}{(r.differenceQty ?? 0).toLocaleString("en-US")}
                    </td>
                    <td style={{ ...ctd, textAlign: "right", color: v < 0 ? DARK.red : v > 0 ? DARK.green : DARK.text, fontWeight: 800 }}>{signedMoney(v)}</td>
                    <td style={{ ...ctd, color: DARK.orange, fontWeight: 800, letterSpacing: "0.06em" }}>
                      {(r.status || "open").toUpperCase()}
                    </td>
                    <td style={{ ...ctd, color: riskColorOf(level), fontWeight: 800, letterSpacing: "0.06em" }}>{level}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontFamily: F, fontSize: "9px", color: DARK.dim, fontStyle: "italic", margin: "auto 0 0" }}>
            Displaying {rows.length} of {a.actionRequiredCount.toLocaleString("en-US")} action items · full registry available in the application.
          </p>
        </>
      )}
    </div>
  );
}

function ProofsPage({ images }: { images: UploadedImage[] }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr",
      gap: "16px", height: "100%",
    }}>
      {images.map((img) => (
        <div key={img.id} style={{ ...card, padding: "10px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{
            flexGrow: 1, minHeight: 0, borderRadius: "5px", overflow: "hidden",
            backgroundColor: DARK.cardSoft, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img src={img.url} alt={img.caption || img.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "8px" }}>
            <span style={{
              fontFamily: F, fontSize: "9px", color: DARK.text, whiteSpace: "nowrap",
            }}>
              {trunc(img.caption || img.name || "Site photograph", 36)}
            </span>
            {img.category && (
              <span style={{
                flexShrink: 0, fontFamily: F, fontSize: "7.5px", fontWeight: 800, letterSpacing: "0.08em",
                textTransform: "uppercase", color: DARK.gold,
                border: `1px solid ${DARK.cardBorder}`, borderRadius: "3px", padding: "2px 7px",
              }}>
                {String(img.category).replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ThankYouPage({ cover, pageNumber }: { cover: CoverPageData; pageNumber: number }) {
  const companyName = (cover.clientName || "GAS ARABIAN SERVICES").toUpperCase();
  const currentYear = new Date().getFullYear();

  return (
    <div
      id="page-backcover"
      className="pdf-report-page pdf-report-page--deck"
      style={{
        width: `${CLIENT_PAGE_W}px`, height: `${CLIENT_PAGE_H}px`,
        padding: "40px 56px", boxSizing: "border-box",
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        backgroundColor: "#0B182B",
        position: "relative", overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Subtle Bottom Right Page Number */}
      <span style={{ position: "absolute", bottom: "28px", right: "38px", fontFamily: "sans-serif", fontSize: "11px", color: "#6C7D93" }}>
        {pageNumber}
      </span>

      {/* Centered Composition */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* Uploaded Logos Bar */}
        {(cover.companyLogoUrl || cover.clientLogoUrl) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "28px", marginBottom: "32px" }}>
            {cover.companyLogoUrl && (
              <img src={cover.companyLogoUrl} alt="Company Logo" style={{ maxHeight: "52px", maxWidth: "200px", objectFit: "contain" }} />
            )}
            {cover.clientLogoUrl && (
              <img src={cover.clientLogoUrl} alt="Is Certified By" style={{ maxHeight: "46px", maxWidth: "160px", objectFit: "contain" }} />
            )}
          </div>
        )}

        {/* Main Title */}
        <h1 style={{
          fontFamily: 'Georgia, "Times New Roman", Times, serif',
          fontSize: "56px",
          fontWeight: 700,
          color: "#FFFFFF",
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
        }}>
          Thank You
        </h1>

        {/* Premium Gold Divider Line */}
        <div style={{
          width: "80px",
          height: "3px",
          backgroundColor: "#C69A39",
          borderRadius: "2px",
          margin: "24px 0",
        }} />

        {/* Dynamic Company Name */}
        <span style={{
          fontFamily: "sans-serif",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.26em",
          color: "#C69A39",
          textTransform: "uppercase",
          display: "block",
        }}>
          {companyName}
        </span>

        {/* Dynamic Copyright */}
        <span style={{
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: "#6C7D93",
          display: "block",
          marginTop: "10px",
          letterSpacing: "0.04em",
        }}>
          © {currentYear} All Rights Reserved
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SUPPLIER SPOTLIGHT PAGE
   One page per top-5 supplier by absolute variance.
   Reuses EXISTING SupplierPerformance data from ReportAnalytics —
   no new calculations. Evidence image comes from the mapping or
   falls back to uploaded proof images by rank.
   ════════════════════════════════════════════════════════════════ */

function SupplierSpotlightPage({ supplier, rank, totalSuppliers, totalAbsVariance, images, mappedImageId }: {
  supplier: { supplier: string; erpValue: number; itemCount: number; matchedCount: number;
    matchingRate: number; coverageRate: number; absoluteVarianceValue: number;
    varianceValue: number; verifiedValue: number };
  rank: number;
  totalSuppliers: number;
  totalAbsVariance: number;
  images: UploadedImage[];
  mappedImageId?: string | null;
}) {
  const s = supplier;
  const varianceShare = totalAbsVariance > 0 ? (s.absoluteVarianceValue / totalAbsVariance) * 100 : 0;
  const riskLevel = s.absoluteVarianceValue >= 50000 ? "CRITICAL" : s.absoluteVarianceValue >= 10000 ? "HIGH" : s.absoluteVarianceValue >= 1000 ? "MEDIUM" : "LOW";
  const riskColor = riskLevel === "CRITICAL" ? DARK.red : riskLevel === "HIGH" ? DARK.orange : riskLevel === "MEDIUM" ? DARK.gold : DARK.green;

  // Rule-based insight generation using existing thresholds
  const insights: string[] = [];
  insights.push(
    `${fmtPct(s.coverageRate)} of the supplier's ERP inventory value (${fmtSAR(s.verifiedValue)} of ${fmtSAR(s.erpValue)}) was physically verified during the audit.`
  );
  insights.push(
    `${s.matchedCount} of ${s.itemCount} inventory records reconciled successfully with zero variance, resulting in a ${fmtPct(s.matchingRate)} Line Item Match Rate.`
  );

  if (varianceShare >= 25) insights.push(`This supplier alone accounts for ${fmtPct(varianceShare)} of total portfolio absolute variance — a primary driver of organizational financial risk.`);
  else if (varianceShare >= 10) insights.push(`Contributes ${fmtPct(varianceShare)} of total absolute variance, representing a notable risk concentration.`);

  if (s.varianceValue < 0) insights.push(`Net shortage of ${fmtSAR(Math.abs(s.varianceValue))} suggests potential stock loss, damage, or unrecorded consumption.`);
  else if (s.varianceValue > 0) insights.push(`Net excess of ${fmtSAR(s.varianceValue)} suggests unrecorded deliveries or incorrect unit-of-measure entries.`);

  // Evidence images uploaded specifically for this supplier
  const supplierEvidences = (images || []).filter(img => img.supplierName === s.supplier);
  const primaryEvidence = supplierEvidences[0] || (mappedImageId ? images?.find(img => img.id === mappedImageId) : null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
      {/* Header: Supplier Name + Rank + Risk Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
          <span style={{
            fontFamily: F, fontSize: "26px", fontWeight: 800, color: DARK.gold,
            backgroundColor: DARK.card, border: `1.5px solid ${DARK.cardBorder}`,
            borderRadius: "10px", width: "48px", height: "48px",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            #{rank}
          </span>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontFamily: F, fontSize: "18px", fontWeight: 800, color: DARK.white, display: "block", whiteSpace: "nowrap" }}>
              {trunc(s.supplier, 40)}
            </span>
            <span style={{ ...dimCaption, display: "block", marginTop: "3px" }}>
              Supplier #{rank} of {totalSuppliers} by absolute variance
            </span>
          </div>
        </div>
        <span style={{
          fontFamily: F, fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em",
          color: riskColor, backgroundColor: DARK.card, border: `1px solid ${DARK.cardBorder}`,
          borderRadius: "6px", padding: "7px 16px", flexShrink: 0,
        }}>
          {riskLevel} RISK
        </span>
      </div>

      {/* KPI Row */}
      <div style={{ display: "flex", gap: "12px" }}>
        <KpiCard label="Line Items" value={s.itemCount.toLocaleString("en-US")} caption="Catalog entries from this supplier" />
        <KpiCard label="ERP Book Value" value={fmtSAR(s.erpValue)} caption="Total ledger valuation" />
        <KpiCard label="Absolute Variance" value={fmtSAR(s.absoluteVarianceValue)} color={DARK.orange} caption={`${fmtPct(varianceShare)} of portfolio risk`} />
        <KpiCard label="Line Match Rate" value={fmtPct(s.matchingRate)} color={s.matchingRate >= 95 ? DARK.green : s.matchingRate >= 80 ? DARK.gold : DARK.orange} caption="Zero-variance line items" />
      </div>

      {/* Main content: Charts + Evidence Image */}
      <div style={{ display: "flex", gap: "14px", flexGrow: 1, minHeight: 0 }}>
        {/* Left: Coverage & Match Donut + Insights */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
          {/* Coverage & Match Rate visual */}
          <div style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", gap: "20px" }}>
            <Donut
              segments={[
                { value: Math.max(s.coverageRate, 0.001), color: DARK.green },
                { value: Math.max(100 - s.coverageRate, 0.001), color: "rgba(255,255,255,0.08)" },
              ]}
              size={110} thickness={18}
              centerTop={fmtPct(s.coverageRate, 0)}
              centerBottom="VAL COVERAGE"
              centerTopSize="16px"
            />
            <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontFamily: F, fontSize: "11px", fontWeight: 800, color: DARK.white, display: "block" }}>
                Verification Summary
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {/* Metric 1: Inventory Value Coverage */}
                <div style={{ backgroundColor: DARK.cardSoft, borderRadius: "5px", padding: "5px 9px", border: `1px solid ${DARK.cardBorder}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: F, fontSize: "9px", fontWeight: 700, color: DARK.white }}>
                      Inventory Value Coverage
                    </span>
                    <span style={{ fontFamily: F, fontSize: "9.5px", fontWeight: 800, color: DARK.green }}>
                      {fmtPct(s.coverageRate)}
                    </span>
                  </div>
                  <span style={{ ...dimCaption, fontSize: "8px", display: "block", marginTop: "1px", lineHeight: 1.35 }}>
                    {fmtSAR(s.verifiedValue)} of {fmtSAR(s.erpValue)} ERP inventory value was physically verified.
                  </span>
                </div>

                {/* Metric 2: Line Item Match Rate */}
                <div style={{ backgroundColor: DARK.cardSoft, borderRadius: "5px", padding: "5px 9px", border: `1px solid ${DARK.cardBorder}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: F, fontSize: "9px", fontWeight: 700, color: DARK.white }}>
                      Line Item Match Rate
                    </span>
                    <span style={{ fontFamily: F, fontSize: "9.5px", fontWeight: 800, color: s.matchingRate >= 95 ? DARK.green : s.matchingRate >= 80 ? DARK.gold : DARK.orange }}>
                      {fmtPct(s.matchingRate)}
                    </span>
                  </div>
                  <span style={{ ...dimCaption, fontSize: "8px", display: "block", marginTop: "1px", lineHeight: 1.35 }}>
                    {s.matchedCount} of {s.itemCount} inventory line items matched exactly with zero variance.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Insights */}
          <div style={{ ...card, padding: "14px 18px", flexGrow: 1, minHeight: 0 }}>
            <span style={{ ...cardLabel, fontSize: "10px", letterSpacing: "0.06em" }}>Supplier Insights</span>
            <div style={{ marginTop: "10px" }}>
              {insights.slice(0, 4).map((ins, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                  <span style={{ color: DARK.gold, fontSize: "10px", lineHeight: "15px", flexShrink: 0 }}>▸</span>
                  <span style={{ fontFamily: F, fontSize: "9.5px", color: DARK.text, lineHeight: 1.5 }}>{ins}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Evidence Image */}
        <div style={{ ...card, padding: "12px", width: "320px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ ...cardLabel, fontSize: "9px", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
            SUPPLIER EVIDENCE {supplierEvidences.length > 0 ? `(${supplierEvidences.length})` : ""}
          </span>
          {primaryEvidence ? (
            <>
              <div style={{
                flexGrow: 1, minHeight: 0, borderRadius: "6px", overflow: "hidden",
                backgroundColor: DARK.cardSoft, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <img src={primaryEvidence.url} alt={primaryEvidence.caption || primaryEvidence.name}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", marginTop: "8px" }}>
                <span style={{ fontFamily: F, fontSize: "8.5px", color: DARK.text, whiteSpace: "nowrap" }}>
                  {trunc(primaryEvidence.caption || primaryEvidence.name || "Evidence photograph", 34)}
                </span>
                <span style={{
                  flexShrink: 0, fontFamily: F, fontSize: "7px", fontWeight: 800, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: DARK.gold,
                  border: `1px solid ${DARK.cardBorder}`, borderRadius: "3px", padding: "2px 6px",
                }}>
                  {s.supplier}
                </span>
              </div>
              {supplierEvidences.length > 1 && (
                <div style={{ display: "flex", gap: "6px", marginTop: "8px", overflowX: "auto" }}>
                  {supplierEvidences.slice(1, 4).map((subImg) => (
                    <div key={subImg.id} style={{
                      width: "48px", height: "36px", borderRadius: "4px", overflow: "hidden",
                      border: `1px solid ${DARK.cardBorder}`, flexShrink: 0, backgroundColor: DARK.cardSoft
                    }}>
                      <img src={subImg.url} alt={subImg.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{
              flexGrow: 1, minHeight: 0, borderRadius: "6px",
              backgroundColor: DARK.cardSoft, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              <span style={{ fontFamily: F, fontSize: "28px", color: DARK.faint }}>📷</span>
              <span style={{ fontFamily: F, fontSize: "9px", color: DARK.faint, textAlign: "center" }}>
                No evidence photo uploaded for {s.supplier}.
                Upload photos in the Supplier Evidence Manager.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DOCUMENT ENTRYPOINT
   ════════════════════════════════════════════════════════════════ */

const SECTION_KICKERS: Record<string, string> = {
  executive: "System Generated · 100% Deterministic",
  kpi: "Portfolio Overview",
  coverage: "Coverage & Variance",
  divisions: "Division Analysis",
  divisionItems: "Division Analysis",
  workbooks: "Data Sources",
  suppliers: "Supplier Analysis",
  supplierSpotlight: "Supplier Deep-Dive",
  suppliersAll: "Supplier Analysis",
  workforce: "Workforce Analysis",
  leaderboard: "Workforce Analysis",
  risk: "Financial Risk",
  riskItems: "Financial Risk",
  validation: "Full Registry",
  actionItems: "Full Registry",
  team: "Verification Evidence",
};

export function ClientReportDocument(props: ClientReportDocumentProps) {
  // ── Resolve inputs: SharedReportModel is the canonical source ──
  const m = props.model;
  const sections = m?.enabledSections ?? [...(props.sections || [])].sort((a, b) => a.order - b.order).filter(s => s.enabled);
  const cover = m?.cover ?? props.cover!;
  const content = m?.content ?? props.content!;
  const images = m?.images ?? props.images ?? [];
  const metrics = m?.metrics ?? props.metrics!;
  const narrative = m?.narrative ?? props.narrative!;
  const supplierImageMapping = m?.supplierImageMapping ?? props.supplierImageMapping;
  const rows = props.rows ?? [];

  const proofs = m?.proofImages ?? getProofImages(images);
  const proofChunks: UploadedImage[][] = [];
  for (let i = 0; i < proofs.length; i += PROOFS_PER_PAGE) {
    proofChunks.push(proofs.slice(i, i + PROOFS_PER_PAGE));
  }

  // Single source of truth for every KPI (same object as the dashboard).
  const a = m?.analytics ?? props.analytics ?? buildReportAnalytics(rows);
  const totalPages = m?.totalPages ?? props.totalPagesOverride ?? countClientReportPages(props.sections || sections, images);

  // Page descriptors — when SharedReportModel is provided, use its
  // deterministic page sequence (pageIndex, kicker, title) so that
  // Web Preview, PDF, and PowerPoint share the exact same ordering.
  type PageDesc = { section: ReportSection; proofChunk?: UploadedImage[]; proofIndex?: number; modelPageIndex?: number; modelKicker?: string };
  const pageDescs: PageDesc[] = [];

  if (m) {
    // SharedReportModel path: deterministic page sequence
    for (const page of m.pages) {
      const section = sections.find(s => s.id === page.sectionId) || sections.find(s => s.type === page.sectionType);
      if (!section) continue;
      if (section.type === "team" && page.pageData?.chunk) {
        pageDescs.push({ section, proofChunk: page.pageData.chunk, proofIndex: (page.pageData.pageNumber ?? 1) - 1, modelPageIndex: page.pageIndex, modelKicker: page.kicker });
      } else {
        pageDescs.push({ section, modelPageIndex: page.pageIndex, modelKicker: page.kicker });
      }
    }
  } else {
    // Legacy prop-based path (backward compatibility)
    const enabled = sections;
    for (const section of enabled) {
      if (section.type === "team") {
        proofChunks.forEach((chunk, i) => pageDescs.push({ section, proofChunk: chunk, proofIndex: i }));
      } else {
        pageDescs.push({ section });
      }
    }
  }

  return (
    <>
      {pageDescs.map((desc, idx) => {
        const { section } = desc;
        const pageNumber = desc.modelPageIndex ?? (idx + 1);
        const kicker = desc.modelKicker ?? SECTION_KICKERS[section.type] ?? section.title;

        if (section.type === "cover") {
          return <CoverPage key={`${section.id}-${idx}`} cover={cover} metrics={metrics} pageNumber={pageNumber} totalPages={totalPages} />;
        }
        if (section.type === "backcover") {
          return <ThankYouPage key={`${section.id}-${idx}`} cover={cover} pageNumber={pageNumber} />;
        }

        const pageProps = {
          pageNumber, totalPages,
          kicker,
          notes: section.notes || undefined,
          sectionId: desc.proofIndex ? `${section.id}-${desc.proofIndex}` : section.id,
        };

        switch (section.type) {
          case "executive":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} brandFooter>
                <ExecutivePage metrics={metrics} narrative={narrative} content={content} />
              </DeckPage>
            );
          case "kpi":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title}>
                <PortfolioPage metrics={metrics} a={a} />
              </DeckPage>
            );
          case "coverage":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title}>
                <CoveragePage metrics={metrics} />
              </DeckPage>
            );
          case "divisions":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title}>
                <DivisionsPage metrics={metrics} a={a} />
              </DeckPage>
            );
          case "divisionItems":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} brandFooter>
                <DivisionItemsPage metrics={metrics} />
              </DeckPage>
            );
          case "workbooks":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} brandFooter>
                <WorkbooksPage metrics={metrics} a={a} />
              </DeckPage>
            );
          case "suppliers":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} brandFooter>
                <SuppliersPage metrics={metrics} a={a} />
              </DeckPage>
            );
          case "suppliersAll":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title="Top 15 Suppliers by ERP Value" subtitle="Suppliers ranked by total ERP inventory value for the current reporting period." brandFooter compact padOverride="28px 30px 22px">
                <SuppliersAllPage metrics={metrics} a={a} />
              </DeckPage>
            );
          case "supplierSpotlight": {
            // Derive rank from section ID: supplierSpotlight1 → 0, supplierSpotlight2 → 1, etc.
            const spotlightIndex = parseInt(section.id.replace("supplierSpotlight", ""), 10) - 1;
            const spotlightSupplier = a.suppliersByVariance[spotlightIndex];
            if (!spotlightSupplier) return null; // supplier doesn't exist at this rank
            const mappedImgId = supplierImageMapping?.[spotlightSupplier.supplier] ?? null;
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={`Supplier Spotlight — ${trunc(spotlightSupplier.supplier, 32)}`} brandFooter>
                <SupplierSpotlightPage
                  supplier={spotlightSupplier}
                  rank={spotlightIndex + 1}
                  totalSuppliers={metrics.suppliers.length}
                  totalAbsVariance={a.supplierAbsVarianceTotal}
                  images={images}
                  mappedImageId={mappedImgId}
                />
              </DeckPage>
            );
          }
          case "workforce":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} brandFooter>
                <WorkforcePage metrics={metrics} a={a} />
              </DeckPage>
            );
          case "leaderboard":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} subtitle="Verification speed and accuracy performance metrics for field counters" brandFooter>
                <LeaderboardPage metrics={metrics} a={a} />
              </DeckPage>
            );
          case "risk":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} brandFooter>
                <RiskPage metrics={metrics} narrative={narrative} />
              </DeckPage>
            );
          case "riskItems":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} subtitle="Specific item rows that represent the highest financial vulnerability" brandFooter>
                <RiskItemsPage metrics={metrics} />
              </DeckPage>
            );
          case "validation":
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} brandFooter>
                <RegistryPage metrics={metrics} a={a} />
              </DeckPage>
            );
          case "actionItems":
            return (
              <DeckPage 
                key={`${section.id}-${idx}`} 
                {...pageProps} 
                title={`Top 15 High-Risk Items (${a.actionRequiredCount.toLocaleString("en-US")} Total Items Requiring Action)`} 
                subtitle="The table below highlights the 15 highest-risk inventory items identified from the client's uploaded inventory data using the existing inventory risk assessment." 
                brandFooter
                compact
                padOverride="28px 30px 22px"
              >
                <ActionItemsPage a={a} />
              </DeckPage>
            );
          case "team":
            return (
              <DeckPage
                key={`${section.id}-${desc.proofIndex}`}
                {...pageProps}
                title={desc.proofIndex === 0 ? section.title : `${section.title} (Continued)`}
                subtitle="Uploaded proof photographs from the verification exercise"
                brandFooter
              >
                <ProofsPage images={desc.proofChunk || []} />
              </DeckPage>
            );
          default:
            return (
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title}>
                <p style={{ fontFamily: F, fontSize: "11px", color: DARK.text, lineHeight: 1.6 }}>
                  {section.notes || section.description || "Custom section."}
                </p>
              </DeckPage>
            );
        }
      })}
    </>
  );
}
