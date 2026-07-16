"use client";

import React from "react";
import {
  ReportSection, CoverPageData, EditableContent, UploadedImage,
} from "@/types/preReport";
import {
  ReportNarrative, PreReportMetrics, fmtSAR, fmtPct,
} from "@/lib/report/insightEngine";
import { ReportAnalytics, buildReportAnalytics } from "@/lib/report/analytics";
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
  sections: ReportSection[];
  cover: CoverPageData;
  content: EditableContent;
  images: UploadedImage[];
  metrics: PreReportMetrics;
  narrative: ReportNarrative;
  reportMeta: ReportMeta;
  /** Raw formatted rows (already produced by the existing pipeline);
      used only for display-time grouping. Optional. */
  rows?: any[];
  /** Shared analytics object (single source of truth for every KPI).
      When omitted it is derived from `rows` with the same formulas. */
  analytics?: ReportAnalytics;
  /** Extra pages the host appends after this document (e.g. the
      builder's personnel appendix) so footers number correctly. */
  totalPagesOverride?: number;
}

/* ─── Layout (A4 landscape @96dpi) ─── */
export const CLIENT_PAGE_W = 1123;
export const CLIENT_PAGE_H = 794;
const PAD = "34px 52px 26px";

const PROOFS_PER_PAGE = 6;

/** Images that appear on Proofs & Site Photographs pages. */
export function getProofImages(images: UploadedImage[]): UploadedImage[] {
  return images.filter(img => !String(img.category || "").toLowerCase().includes("logo"));
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
}) {
  return (
    <div
      id={sectionId ? `page-${sectionId}` : undefined}
      className="pdf-report-page pdf-report-page--deck"
      style={{
        width: `${CLIENT_PAGE_W}px`, height: `${CLIENT_PAGE_H}px`,
        padding: PAD, boxSizing: "border-box",
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
        <div style={{ marginBottom: "14px" }}>
          {kicker && <span style={{ ...kickerStyle, display: "block" }}>{kicker}</span>}
          {title && <h2 style={titleStyle}>{title}</h2>}
          <div style={{ height: "1px", backgroundColor: DARK.divider, marginTop: "12px" }} />
          {subtitle && <span style={{ ...dimCaption, fontSize: "10px", display: "block", marginTop: "9px" }}>{subtitle}</span>}
        </div>
      )}

      <div style={{ flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>

      {notes && (
        <p style={{ fontFamily: F, fontSize: "8.5px", color: DARK.faint, fontStyle: "italic", margin: "8px 0 0" }}>{notes}</p>
      )}

      <div style={{ marginTop: "12px" }}>
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
  const dateLabel = (cover.reportingPeriod || "").trim()
    ? cover.reportingPeriod.toUpperCase()
    : new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  const title = (cover.reportTitle || "Physical Inventory Verification Report").toUpperCase();
  const words = title.split(/\s+/);
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(" ");
  const line2 = words.slice(mid).join(" ");

  return (
    <div
      id="page-cover"
      className="pdf-report-page pdf-report-page--deck"
      style={{
        width: `${CLIENT_PAGE_W}px`, height: `${CLIENT_PAGE_H}px`,
        padding: "40px 56px", boxSizing: "border-box",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        backgroundColor: DARK.pageBg,
        backgroundImage: `linear-gradient(165deg, ${DARK.pageBg} 0%, ${DARK.pageBgEnd} 100%)`,
        position: "relative", overflow: "hidden", fontFamily: F,
      }}
    >
      <span style={{ position: "absolute", top: "30px", right: "38px", fontFamily: F, fontSize: "12px", fontWeight: 800, color: DARK.gold }}>
        {pageNumber}
      </span>

      <div />

      <div>
        {cover.companyLogoUrl && (
          <img src={cover.companyLogoUrl} alt="Logo" style={{ maxHeight: "48px", objectFit: "contain", marginBottom: "22px" }} />
        )}
        <h1 style={{
          fontFamily: F, fontSize: "44px", fontWeight: 800, color: DARK.white,
          lineHeight: 1.25, letterSpacing: "0.005em", margin: 0,
        }}>
          {line1}
          <br />
          {line2}
        </h1>
        <div style={{
          display: "inline-block", marginTop: "26px",
          backgroundColor: DARK.gold, borderRadius: "5px", padding: "11px 30px",
        }}>
          <span style={{ fontFamily: F, fontSize: "12px", fontWeight: 800, color: "#102039", letterSpacing: "0.04em" }}>
            DATE: {dateLabel}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <span style={{
            fontFamily: F, fontSize: "13px", fontWeight: 800, letterSpacing: "0.28em",
            color: "#C6D2E4", display: "block",
          }}>
            {(cover.clientName || "GAS ARABIAN SERVICES").toUpperCase()}
          </span>
          <span style={{ ...dimCaption, display: "block", marginTop: "5px" }}>
            © {new Date().getFullYear()}  All Rights Reserved
          </span>
        </div>

        <div style={{
          border: `1.5px solid ${DARK.gold}`, borderRadius: "10px",
          padding: "20px 40px", textAlign: "center", marginBottom: "8px",
        }}>
          <span style={{ fontFamily: F, fontSize: "28px", fontWeight: 800, color: DARK.green, display: "block" }}>
            {metrics.healthScore}
          </span>
          <span style={{
            fontFamily: F, fontSize: "8.5px", fontWeight: 800, letterSpacing: "0.1em",
            color: DARK.white, textTransform: "uppercase", display: "block", marginTop: "8px",
          }}>
            Health Score · {metrics.inventoryHealthStatus}
          </span>
        </div>
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
            <div key={d.division} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
              <span style={{ fontFamily: F, fontSize: "8.5px", fontWeight: 700, color: DARK.white, width: "44px", flexShrink: 0, whiteSpace: "nowrap" }}>
                {trunc(d.division, 8)}
              </span>
              <div style={{ flexGrow: 1, height: "8px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, d.coverageRate))}%`, borderRadius: "2px", backgroundColor: covColor(d.coverageRate) }} />
              </div>
              <span style={{ fontFamily: F, fontSize: "8.5px", fontWeight: 800, color: DARK.white, width: "44px", flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
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
  const halves = [divQty.slice(0, Math.ceil(divQty.length / 2)), divQty.slice(Math.ceil(divQty.length / 2))];

  const cth: React.CSSProperties = { ...th, padding: "5px 9px", fontSize: "8.5px" };
  const ctd: React.CSSProperties = { ...td, padding: "3.5px 9px", fontSize: "8.5px" };

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
        <div style={{ display: "flex", gap: "20px", height: "150px" }}>
          {largest && (
            <div style={{
              width: "190px", flexShrink: 0, border: `1px solid ${DARK.cardBorder}`,
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
        <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
          {halves.map((half, hi) => (
            <table key={hi} style={{ width: "100%", borderCollapse: "collapse", flex: 1 }}>
              <thead>
                <tr>
                  <th style={cth}>Division</th>
                  <th style={{ ...cth, textAlign: "right" }}>Physical Count</th>
                  <th style={{ ...cth, textAlign: "right" }}>System On Hand</th>
                  <th style={{ ...cth, textAlign: "right" }}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {half.map((v) => (
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
  const list = a.suppliersByVariance.slice(0, 15);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>Supplier Name</th>
          <th style={th}>Items</th>
          <th style={th}>ERP Value</th>
          <th style={th}>Coverage</th>
          <th style={th}>Abs. Variance</th>
          <th style={th}>Match Rate</th>
        </tr>
      </thead>
      <tbody>
        {list.map((s) => (
          <tr key={s.supplier}>
            <td style={{ ...td, fontWeight: 700, color: DARK.white }}>{s.supplier}</td>
            <td style={td}>{s.itemCount.toLocaleString("en-US")}</td>
            <td style={td}>{money(s.erpValue)}</td>
            <td style={{ ...td, color: s.coverageRate >= 90 ? DARK.green : s.coverageRate >= 50 ? DARK.gold : DARK.orange }}>
              {fmtPct(s.coverageRate)}
            </td>
            <td style={{ ...td, color: s.absoluteVarianceValue > 1000 ? DARK.orange : DARK.text, fontWeight: s.absoluteVarianceValue > 1000 ? 800 : 400 }}>
              {money(s.absoluteVarianceValue)}
            </td>
            <td style={td}>{fmtPct(s.matchingRate)}</td>
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
          <div key={r.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "13px" }}>
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
  const cth: React.CSSProperties = { ...th, padding: "6px 10px", fontSize: "9px" };
  const ctd: React.CSSProperties = { ...td, padding: "4px 10px", fontSize: "9px" };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {rows.length === 0 ? (
        <p style={{ fontFamily: F, fontSize: "11px", color: DARK.dim }}>
          No applicable data was available for this reporting period.
        </p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cth}>Item Code</th>
                <th style={cth}>Supplier</th>
                <th style={cth}>Division</th>
                <th style={{ ...cth, textAlign: "right" }}>ERP Qty</th>
                <th style={{ ...cth, textAlign: "right" }}>Physical Qty</th>
                <th style={{ ...cth, textAlign: "right" }}>Variance Qty</th>
                <th style={{ ...cth, textAlign: "right" }}>Variance Value</th>
                <th style={cth}>Status</th>
                <th style={cth}>Action Priority</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, i: number) => {
                const level = riskLevelOf(r.absoluteVarianceValue ?? 0);
                const v = r.varianceValue ?? 0;
                return (
                  <tr key={i}>
                    <td style={{ ...ctd, fontWeight: 700, color: DARK.white }}>{r.itemCode || "N/A"}</td>
                    <td style={{ ...ctd, whiteSpace: "nowrap" }}>
                      {trunc(r.supplier || "Others", 22)}
                    </td>
                    <td style={ctd}>{r.org || "—"}</td>
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
  return (
    <div
      id="page-backcover"
      className="pdf-report-page pdf-report-page--deck"
      style={{
        width: `${CLIENT_PAGE_W}px`, height: `${CLIENT_PAGE_H}px`,
        padding: "40px 56px", boxSizing: "border-box",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        backgroundColor: DARK.pageBg,
        backgroundImage: `linear-gradient(165deg, ${DARK.pageBg} 0%, ${DARK.pageBgEnd} 100%)`,
        position: "relative", overflow: "hidden", fontFamily: F,
      }}
    >
      <span style={{ position: "absolute", top: "30px", right: "38px", fontFamily: F, fontSize: "12px", fontWeight: 800, color: DARK.gold }}>
        {pageNumber}
      </span>
      <div />
      <h1 style={{ fontFamily: F, fontSize: "48px", fontWeight: 800, color: DARK.white, margin: 0 }}>
        Thank You
      </h1>
      <div>
        <span style={{
          fontFamily: F, fontSize: "13px", fontWeight: 800, letterSpacing: "0.28em",
          color: "#C6D2E4", display: "block",
        }}>
          {(cover.clientName || "GAS ARABIAN SERVICES").toUpperCase()}
        </span>
        <span style={{ ...dimCaption, display: "block", marginTop: "5px" }}>
          © {new Date().getFullYear()}  All Rights Reserved
        </span>
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
  suppliersAll: "Supplier Analysis",
  workforce: "Workforce Analysis",
  leaderboard: "Workforce Analysis",
  risk: "Financial Risk",
  riskItems: "Financial Risk",
  validation: "Full Registry",
  actionItems: "Full Registry",
  team: "Verification Evidence",
};

export function ClientReportDocument({
  sections, cover, content, images, metrics, narrative, reportMeta, rows = [], analytics, totalPagesOverride,
}: ClientReportDocumentProps) {
  const enabled = [...sections].sort((a, b) => a.order - b.order).filter((s) => s.enabled);
  const proofs = getProofImages(images);
  const proofChunks: UploadedImage[][] = [];
  for (let i = 0; i < proofs.length; i += PROOFS_PER_PAGE) {
    proofChunks.push(proofs.slice(i, i + PROOFS_PER_PAGE));
  }

  // Single source of truth for every KPI (same object as the dashboard).
  const a = analytics ?? buildReportAnalytics(rows);
  const totalPages = totalPagesOverride ?? countClientReportPages(sections, images);

  // Flatten sections into page descriptors (team expands / collapses)
  type PageDesc = { section: ReportSection; proofChunk?: UploadedImage[]; proofIndex?: number };
  const pageDescs: PageDesc[] = [];
  for (const section of enabled) {
    if (section.type === "team") {
      proofChunks.forEach((chunk, i) => pageDescs.push({ section, proofChunk: chunk, proofIndex: i }));
      // no images -> section skipped entirely
    } else {
      pageDescs.push({ section });
    }
  }

  return (
    <>
      {pageDescs.map((desc, idx) => {
        const { section } = desc;
        const pageNumber = idx + 1;
        const kicker = SECTION_KICKERS[section.type] || section.title;

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
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={section.title} subtitle="Detailed inventory analytics for all resolved supplier entities" brandFooter>
                <SuppliersAllPage metrics={metrics} a={a} />
              </DeckPage>
            );
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
              <DeckPage key={`${section.id}-${idx}`} {...pageProps} title={`${section.title} (${a.actionRequiredCount.toLocaleString("en-US")})`} subtitle="High-risk open items — displaying top rows" brandFooter>
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
