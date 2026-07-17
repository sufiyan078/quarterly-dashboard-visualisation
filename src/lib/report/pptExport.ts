import { ReportSection, CoverPageData, EditableContent, UploadedImage } from "@/types/preReport";
import { ReportAnalytics } from "@/lib/report/analytics";
import { ReportNarrative, fmtSAR, fmtPct } from "@/lib/report/insightEngine";
import { getProofImages } from "@/components/pre-report/ClientReportDocument";
import { DARK } from "@/lib/report/designTokens";

/* ════════════════════════════════════════════════════════════════
   EDITABLE POWERPOINT EXPORT
   Builds a genuine .pptx deck mirroring the client-blueprint report:
   real text boxes, real tables, native editable charts — all sourced
   from the SAME shared analytics object as the dashboard and PDF.
   Runs fully client-side via pptxgenjs (zero-cost, Spark friendly).
   ════════════════════════════════════════════════════════════════ */

// A4 landscape in inches
const PW = 11.69;
const PH = 8.27;
const MX = 0.55;          // side margin
const CW = PW - MX * 2;   // content width

const hex = (c: string) => c.replace("#", "");
const C = {
  bg: hex(DARK.pageBg),
  card: hex(DARK.card),
  cardSoft: hex(DARK.cardSoft),
  border: hex(DARK.cardBorder),
  divider: hex(DARK.divider),
  tableHeader: hex(DARK.tableHeader),
  gold: hex(DARK.gold),
  white: "FFFFFF",
  text: hex(DARK.text),
  dim: hex(DARK.dim),
  green: hex(DARK.green),
  orange: hex(DARK.orange),
  blue: hex(DARK.blue),
  red: hex(DARK.red),
  goldSoft: hex(DARK.goldSoft),
};

const money2 = (n: number) =>
  `SAR ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) =>
  `${n < 0 ? "-" : n > 0 ? "+" : ""}SAR ${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const nfmt = (n: number) => Number(n || 0).toLocaleString("en-US");
const trunc = (s: any, max: number) => {
  const str = String(s ?? "");
  return str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str;
};

export interface PptExportInput {
  sections: ReportSection[];
  cover: CoverPageData;
  content: EditableContent;
  images: UploadedImage[];
  analytics: ReportAnalytics;
  narrative: ReportNarrative;
  reportMeta: { quarter: string; year: number | string; location: string };
  fileName: string;
}

export async function exportReportPpt(input: PptExportInput): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4L", width: PW, height: PH });
  pptx.layout = "A4L";

  const { cover, content, images, analytics: a, narrative, reportMeta } = input;
  const m = a.metrics;
  const enabled = [...input.sections].sort((x, y) => x.order - y.order).filter(s => s.enabled);

  let pageNo = 0;

  const newSlide = () => {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    pageNo++;
    s.addText(String(pageNo), { x: PW - 0.7, y: 0.18, w: 0.5, h: 0.3, fontSize: 11, bold: true, color: C.gold, align: "right" });
    return s;
  };

  /* ─── shared building blocks ─── */
  const header = (s: any, kicker: string, title: string, subtitle?: string) => {
    s.addText(kicker.toUpperCase(), { x: MX, y: 0.28, w: CW - 0.8, h: 0.28, fontSize: 10, bold: true, color: C.gold, charSpacing: 4 });
    s.addText(title, { x: MX, y: 0.55, w: CW, h: 0.5, fontSize: 21, bold: true, color: C.white });
    s.addShape(pptx.ShapeType.line, { x: MX, y: 1.12, w: CW, h: 0, line: { color: C.divider, width: 1 } });
    if (subtitle) s.addText(subtitle, { x: MX, y: 1.16, w: CW, h: 0.25, fontSize: 8.5, color: C.dim });
    s.addText("Physical Inventory Verification & Reconciliation Report  ·  Gas Arabian Services © " + new Date().getFullYear(), {
      x: MX, y: PH - 0.35, w: CW, h: 0.25, fontSize: 7.5, color: C.dim,
    });
    return subtitle ? 1.48 : 1.28; // content start Y
  };

  const panel = (s: any, x: number, y: number, w: number, h: number, title?: string, subtitle?: string) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.06, fill: { color: C.card }, line: { color: C.border, width: 1 } });
    if (title) s.addText(title, { x: x + 0.18, y: y + 0.1, w: w - 0.36, h: 0.28, fontSize: 10.5, bold: true, color: C.white });
    if (subtitle) s.addText(subtitle, { x: x + 0.18, y: y + 0.36, w: w - 0.36, h: 0.22, fontSize: 7.5, color: C.dim });
  };

  const kpiCard = (s: any, x: number, y: number, w: number, label: string, value: string, color: string, caption?: string) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.95, rectRadius: 0.06, fill: { color: C.card }, line: { color: C.border, width: 1 } });
    s.addText(label.toUpperCase(), { x: x + 0.14, y: y + 0.08, w: w - 0.28, h: 0.2, fontSize: 7.5, bold: true, color: C.gold, charSpacing: 1.5 });
    s.addText(trunc(value, 26), { x: x + 0.14, y: y + 0.3, w: w - 0.28, h: 0.34, fontSize: 15, bold: true, color });
    if (caption) s.addText(caption, { x: x + 0.14, y: y + 0.66, w: w - 0.28, h: 0.2, fontSize: 7, color: C.dim });
  };

  const kpiRow = (s: any, y: number, cards: Array<[string, string, string, string?]>) => {
    const gap = 0.18;
    const w = (CW - gap * (cards.length - 1)) / cards.length;
    cards.forEach((c, i) => kpiCard(s, MX + i * (w + gap), y, w, c[0], c[1], c[2], c[3]));
    return y + 1.12;
  };

  const wwwCards = (s: any, y: number, what: string, where: string, why: string) => {
    const items: Array<[string, string, string]> = [
      ["WHAT HAPPENED?", C.green, what], ["WHERE DID IT HAPPEN?", C.blue, where], ["WHY IS IT IMPORTANT?", C.gold, why],
    ];
    const gap = 0.18;
    const w = (CW - gap * 2) / 3;
    items.forEach(([t, col, body], i) => {
      const x = MX + i * (w + gap);
      s.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.92, rectRadius: 0.06, fill: { color: C.card }, line: { color: C.border, width: 1 } });
      s.addText(t, { x: x + 0.14, y: y + 0.07, w: w - 0.28, h: 0.2, fontSize: 7.5, bold: true, color: col });
      s.addText(body, { x: x + 0.14, y: y + 0.28, w: w - 0.28, h: 0.58, fontSize: 8, color: C.text, valign: "top" });
    });
    return y + 1.08;
  };

  const tableOpts = (x: number, y: number, w: number, colW: number[], fontSize = 8) => ({
    x, y, w, colW,
    fontSize, color: C.text, fontFace: "Calibri",
    fill: { color: C.cardSoft },
    border: { type: "solid" as const, color: C.border, pt: 0.5 },
    valign: "middle" as const,
    margin: 0.04,
  });

  const thRow = (labels: string[]) =>
    labels.map(t => ({ text: t, options: { bold: true, color: C.gold, fill: { color: C.tableHeader }, fontSize: 8 } }));

  const riskLevelOf = (v: number) => (v >= 10000 ? "HIGH" : v >= 1000 ? "MEDIUM" : "LOW");
  const riskColorOf = (l: string) => (l === "HIGH" ? C.red : l === "MEDIUM" ? C.gold : C.green);

  /* ═══ Slides (mirror the report page sequence) ═══ */
  for (const section of enabled) {
    switch (section.type) {
      case "cover": {
        const s = newSlide();
        const title = (cover.reportTitle || "Physical Inventory Verification Report").toUpperCase();
        const words = title.split(/\s+/);
        const mid = Math.ceil(words.length / 2);
        s.addText(`${words.slice(0, mid).join(" ")}\n${words.slice(mid).join(" ")}`, {
          x: MX, y: 2.5, w: CW, h: 1.7, fontSize: 34, bold: true, color: C.white, lineSpacing: 44,
        });
        const dateLabel = (cover.reportingPeriod || "").trim()
          ? cover.reportingPeriod.toUpperCase()
          : new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
        s.addShape(pptx.ShapeType.roundRect, { x: MX, y: 4.5, w: 2.9, h: 0.5, rectRadius: 0.06, fill: { color: C.gold } });
        s.addText(`DATE: ${dateLabel}`, { x: MX, y: 4.5, w: 2.9, h: 0.5, fontSize: 10, bold: true, color: "102039", align: "center" });
        s.addText((cover.clientName || "GAS ARABIAN SERVICES").toUpperCase(), { x: MX, y: PH - 0.85, w: 6, h: 0.3, fontSize: 11, bold: true, color: "C6D2E4", charSpacing: 4 });
        s.addText(`© ${new Date().getFullYear()}  All Rights Reserved`, { x: MX, y: PH - 0.55, w: 6, h: 0.25, fontSize: 8, color: C.dim });
        s.addShape(pptx.ShapeType.roundRect, { x: PW - 3.4, y: PH - 1.7, w: 2.8, h: 1.1, rectRadius: 0.09, fill: { color: C.bg }, line: { color: C.gold, width: 1.5 } });
        s.addText(String(m.healthScore), { x: PW - 3.4, y: PH - 1.62, w: 2.8, h: 0.5, fontSize: 22, bold: true, color: C.green, align: "center" });
        s.addText(`HEALTH SCORE · ${m.inventoryHealthStatus.toUpperCase()}`, { x: PW - 3.4, y: PH - 1.08, w: 2.8, h: 0.3, fontSize: 7.5, bold: true, color: C.white, align: "center", charSpacing: 1.5 });
        break;
      }

      case "executive": {
        const s = newSlide();
        let y = header(s, "System Generated · 100% Deterministic", section.title);
        y = kpiRow(s, y, [
          ["Total Asset Value", fmtSAR(m.totalInventoryValue), C.white],
          ["Verified Coverage", fmtPct(m.coverageRate), C.green],
          ["Count Match Rate", fmtPct(m.matchRate), C.green],
          ["Total Absolute Risk", fmtSAR(m.totalRiskValue), C.orange],
        ]);
        panel(s, MX, y, 3.1, 4.4, "OPERATIONAL CONCENTRATION");
        s.addText("Highest Risk Cost Center", { x: MX + 0.18, y: y + 0.7, w: 2.7, h: 0.22, fontSize: 8, color: C.dim });
        s.addText(m.highestRiskDivision || "—", { x: MX + 0.18, y: y + 0.92, w: 2.7, h: 0.4, fontSize: 17, bold: true, color: C.white });
        s.addText("Highest Risk Supplier", { x: MX + 0.18, y: y + 1.55, w: 2.7, h: 0.22, fontSize: 8, color: C.dim });
        s.addText(trunc(m.highestRiskSupplier || "—", 24), { x: MX + 0.18, y: y + 1.77, w: 2.7, h: 0.4, fontSize: 13, bold: true, color: C.orange });

        const ox = MX + 3.3;
        panel(s, ox, y, CW - 3.3, 4.4, "KEY OBSERVATIONS");
        const unverified = Math.max(0, m.totalInventoryValue - m.verifiedValue);
        const obs = [
          `Inventory health is calculated at ${m.healthScore} (${m.inventoryHealthStatus}).`,
          ...(m.remainingLines > 0 ? [`Unverified stock represents ${fmtSAR(unverified)} across ${nfmt(m.remainingLines)} remaining items.`] : []),
          `Audit opinion: "${m.auditConclusion.split(" - ")[0]}".`,
          ...narrative.risks.slice(0, 2).map(r => `${r.title} — ${r.impact}`),
        ];
        s.addText(obs.map(t => ({ text: t, options: { bullet: { characterCode: "2022", indent: 12 }, breakLine: true } })), {
          x: ox + 0.18, y: y + 0.55, w: CW - 3.3 - 0.4, h: 3.2, fontSize: 9.5, color: C.text, lineSpacingMultiple: 1.5, valign: "top",
        });
        break;
      }

      case "kpi": {
        const s = newSlide();
        let y = header(s, "Portfolio Overview", section.title);
        y = kpiRow(s, y, [
          ["Total Inventory Value", fmtSAR(m.totalInventoryValue), C.white, "Gross asset valuation under audit"],
          ["Verified Value", fmtSAR(m.verifiedValue), C.green, `Physically confirmed (${fmtPct(m.coverageRate)})`],
          ["Total Financial Risk", fmtSAR(m.totalRiskValue), C.orange, "Sum of absolute variances"],
          ["Accuracy Match Rate", fmtPct(m.matchRate), C.green, "Zero-variance line items"],
        ]);
        panel(s, MX, y, 3.4, 4.3, "HEALTH SCORE");
        s.addChart(pptx.ChartType.doughnut, [{
          name: "Health", labels: ["Score", "Remaining"], values: [m.healthScore, Math.max(0, 100 - m.healthScore)],
        }], { x: MX + 0.35, y: y + 0.55, w: 2.7, h: 2.9, chartColors: [C.green, "24354F"], holeSize: 65, showLegend: false, showValue: false, dataLabelColor: C.white });
        s.addText(`${m.healthScore}\n${m.inventoryHealthStatus.toUpperCase()}`, { x: MX + 0.35, y: y + 1.55, w: 2.7, h: 0.9, fontSize: 15, bold: true, color: C.green, align: "center" });

        const ax = MX + 3.6;
        const totalCat = Math.max(a.accuracy.matchedCount + a.accuracy.shortageCount + a.accuracy.excessCount, 1);
        panel(s, ax, y, CW - 3.6, 4.3, "ACCURACY BREAKDOWN", "Percentage of verified line items by discrepancy category");
        s.addChart(pptx.ChartType.doughnut, [{
          name: "Accuracy",
          labels: ["Matches (Zero Variance)", "Shortage (Negative Variance)", "Excess (Positive Variance)"],
          values: [a.accuracy.matchedCount, a.accuracy.shortageCount, a.accuracy.excessCount],
        }], { x: ax + 0.2, y: y + 0.7, w: 3.1, h: 3.2, chartColors: [C.green, C.orange, C.blue], holeSize: 62, showLegend: false, showValue: false });
        s.addText("TOTAL\n100", { x: ax + 0.2, y: y + 1.8, w: 3.1, h: 0.9, fontSize: 13, bold: true, color: C.white, align: "center" });
        const legend = [
          [`Matches (Zero Variance) — ${fmtPct((a.accuracy.matchedCount / totalCat) * 100)} · ${nfmt(a.accuracy.matchedCount)} items`, C.green],
          [`Shortage (Negative Variance) — ${fmtPct((a.accuracy.shortageCount / totalCat) * 100)} · ${nfmt(a.accuracy.shortageCount)} items`, C.orange],
          [`Excess (Positive Variance) — ${fmtPct((a.accuracy.excessCount / totalCat) * 100)} · ${nfmt(a.accuracy.excessCount)} items`, C.blue],
        ];
        legend.forEach(([t, col], i) => {
          s.addShape(pptx.ShapeType.ellipse, { x: ax + 3.5, y: y + 1.15 + i * 0.55, w: 0.12, h: 0.12, fill: { color: col as string } });
          s.addText(t as string, { x: ax + 3.7, y: y + 1.02 + i * 0.55, w: CW - 3.6 - 3.9, h: 0.4, fontSize: 8.5, color: C.text });
        });
        break;
      }

      case "coverage": {
        const s = newSlide();
        const y = header(s, "Coverage & Variance", section.title);
        const topDivs = m.divisions.slice(0, 5);
        const topSups = a.suppliersByVariance.slice(0, 5);
        const pw = (CW - 0.2) / 2;
        panel(s, MX, y, pw, 2.9, "Division Coverage Rate", "Verification completion rate by operational cost center");
        s.addChart(pptx.ChartType.bar, [{
          name: "Coverage %", labels: topDivs.map(d => d.division).reverse(), values: topDivs.map(d => d.coverageRate).reverse(),
        }], { x: MX + 0.15, y: y + 0.6, w: pw - 0.3, h: 2.15, barDir: "bar", chartColors: [C.green], showValue: true, dataLabelColor: C.white, dataLabelFontSize: 8, valAxisHidden: true, catAxisLabelColor: C.white, catAxisLabelFontSize: 8, showLegend: false });
        panel(s, MX + pw + 0.2, y, pw, 2.9, "Top 5 Suppliers by Absolute Variance", "Suppliers associated with highest financial risk");
        s.addChart(pptx.ChartType.bar, [{
          name: "Abs Variance", labels: topSups.map(x => trunc(x.supplier, 18)).reverse(), values: topSups.map(x => Math.round(x.absoluteVarianceValue)).reverse(),
        }], { x: MX + pw + 0.35, y: y + 0.6, w: pw - 0.3, h: 2.15, barDir: "bar", chartColors: [C.orange], showValue: true, dataLabelColor: C.white, dataLabelFontSize: 8, valAxisHidden: true, catAxisLabelColor: C.white, catAxisLabelFontSize: 8, showLegend: false });

        const sy = y + 3.1;
        panel(s, MX, sy, CW, 1.9, "STOCK COUNT PERFORMANCE", "Progress rate of physical item verification lines");
        s.addShape(pptx.ShapeType.roundRect, { x: PW - MX - 2.1, y: sy + 0.12, w: 1.9, h: 0.4, rectRadius: 0.2, fill: { color: hex(DARK.greenDeep) } });
        s.addText(`${fmtPct(m.coverageRate)} COVERED`, { x: PW - MX - 2.1, y: sy + 0.12, w: 1.9, h: 0.4, fontSize: 8.5, bold: true, color: C.white, align: "center" });
        s.addText(`Verified Count Lines:  ${nfmt(m.verifiedLines)} / ${nfmt(m.totalLines)}      Remaining: ${nfmt(m.remainingLines)} lines`, { x: MX + 0.18, y: sy + 0.7, w: 5.6, h: 0.3, fontSize: 10, bold: true, color: C.white });
        s.addText(`Physical inventory audit has covered ${nfmt(m.verifiedLines)} unique catalog entries out of ${nfmt(m.totalLines)}. Total quantities verified reach ${nfmt(m.verifiedQuantity)} units out of ${nfmt(m.totalQuantity)}.`, { x: MX + 0.18, y: sy + 1.05, w: CW - 0.5, h: 0.6, fontSize: 8.5, color: C.text });
        break;
      }

      case "divisions": {
        const s = newSlide();
        let y = header(s, "Division Analysis", section.title);
        y = wwwCards(s, y,
          `Reconciliation performance audit across ${m.divisions.length} distinct organizational divisions.`,
          "Grouped based on item organization cost codes and original Excel sheets.",
          "Identifies divisions with verification coverage gaps or net adjustment risks to guide operational remediation.");
        y = kpiRow(s, y, [
          ["Total Divisions", String(m.divisions.length), C.white, "Active cost centers under audit"],
          ["Highest Coverage", a.highestCoverageDivision?.name || "N/A", C.green, a.highestCoverageDivision ? `(${a.highestCoverageDivision.coverageRate.toFixed(1)}% verified)` : undefined],
          ["Highest Risk Division", m.highestRiskDivision || "—", C.orange, "Highest variance cost center"],
          ["Net Ops Variance", signed(m.varianceValue), C.orange, "Total operational variance"],
        ]);
        const ph2 = PH - y - 0.55;
        panel(s, MX, y, CW * 0.55, ph2, "Division Verification Rates", "Percentage of ERP ledger value verified physically");
        s.addChart(pptx.ChartType.bar, [{
          name: "Coverage %", labels: m.divisions.map(d => d.division).reverse(), values: m.divisions.map(d => d.coverageRate).reverse(),
        }], { x: MX + 0.15, y: y + 0.55, w: CW * 0.55 - 0.3, h: ph2 - 0.7, barDir: "bar", chartColors: [C.green], showValue: false, valAxisHidden: true, catAxisLabelColor: C.white, catAxisLabelFontSize: 6.5, showLegend: false });
        const perfect = m.divisions.filter(d => d.coverageRate >= 100).length;
        panel(s, MX + CW * 0.55 + 0.2, y, CW * 0.45 - 0.2, ph2);
        s.addText(
          `Division reconciliation covers all ${m.divisions.length} cost centers with a blended verification coverage of ${fmtPct(m.coverageRate)} and a net operational variance of ${signed(m.varianceValue)}. ${perfect} of ${m.divisions.length} divisions have reached 100% count coverage; the remaining carry the bulk of open verification work and financial risk.`,
          { x: MX + CW * 0.55 + 0.38, y: y + 0.2, w: CW * 0.45 - 0.56, h: ph2 - 0.4, fontSize: 10, color: C.text, lineSpacingMultiple: 1.4, valign: "top" });
        break;
      }

      case "divisionItems": {
        const s = newSlide();
        const y = header(s, "Division Analysis", section.title);
        const byItems = [...m.divisions].sort((x, z) => z.itemCount - x.itemCount);
        panel(s, MX, y, CW * 0.55, PH - y - 0.55, "Division Items Mapped", "Total item catalog counts under cost centers");
        s.addChart(pptx.ChartType.bar, [{
          name: "Items", labels: byItems.slice(0, 12).map(d => d.division), values: byItems.slice(0, 12).map(d => d.itemCount),
        }], { x: MX + 0.15, y: y + 0.6, w: CW * 0.55 - 0.3, h: PH - y - 1.35, barDir: "col", chartColors: [C.blue], showValue: false, valAxisLabelColor: C.dim, valAxisLabelFontSize: 7, catAxisLabelColor: C.white, catAxisLabelFontSize: 7, showLegend: false });
        const rx = MX + CW * 0.55 + 0.2;
        const topVar = [...m.divisions].sort((x, z) => Math.abs(z.varianceValue) - Math.abs(x.varianceValue)).slice(0, 3);
        panel(s, rx, y, CW * 0.45 - 0.2, PH - y - 0.55, "Top 3 Variance Divisions");
        s.addTable([
          thRow(["Division", "Items", "Coverage", "Net Variance"]),
          ...topVar.map(d => ([
            { text: d.division, options: { bold: true, color: C.white } },
            { text: nfmt(d.itemCount) },
            { text: fmtPct(d.coverageRate) },
            { text: signed(d.varianceValue), options: { bold: true, color: d.varianceValue < 0 ? C.red : C.green } },
          ])),
        ] as any, tableOpts(rx + 0.15, y + 0.55, CW * 0.45 - 0.5, [1.4, 0.9, 1.0, 1.5]));
        break;
      }

      case "workbooks": {
        const s = newSlide();
        const y = header(s, "Data Sources", section.title);
        s.addTable([
          thRow(["Sheet Name", "Items Count", "ERP Value", "Verified Value", "Coverage Rate", "Net Variance"]),
          ...m.subDivisions.slice(0, 3).map(sh => ([
            { text: sh.subDivision }, { text: nfmt(sh.itemCount) }, { text: fmtSAR(sh.erpValue) }, { text: fmtSAR(sh.verifiedValue) },
            { text: fmtPct(sh.coverageRate), options: { color: C.green } },
            { text: money2(sh.varianceValue), options: { bold: true, color: sh.varianceValue < 0 ? C.red : C.text } },
          ])),
        ] as any, tableOpts(MX, y, CW, [2.2, 1.4, 1.9, 1.9, 1.5, 1.7]));

        const cy = y + 1.5;
        panel(s, MX, cy, CW, PH - cy - 0.55, "Physical Count vs System On Hand by Division", "Same values as the division comparison table");
        const rest = a.divisionQty.slice(1, 13);
        s.addChart(pptx.ChartType.bar, [
          { name: "Physical Count", labels: rest.map(d => d.division), values: rest.map(d => d.physicalCount) },
          { name: "System On Hand", labels: rest.map(d => d.division), values: rest.map(d => d.systemOnHand) },
        ], { x: MX + 0.15, y: cy + 0.55, w: CW * 0.55, h: PH - cy - 1.35, barDir: "col", chartColors: [C.green, C.blue], showLegend: true, legendPos: "t", legendColor: C.text, valAxisLabelColor: C.dim, valAxisLabelFontSize: 7, catAxisLabelColor: C.white, catAxisLabelFontSize: 6.5, showValue: false });
        const half = a.divisionQty.slice(0, 8);
        s.addTable([
          thRow(["Division", "Physical", "System", "Diff"]),
          ...half.map(d => ([
            { text: d.division, options: { bold: true, color: C.white } },
            { text: nfmt(d.physicalCount) }, { text: nfmt(d.systemOnHand) },
            { text: `${d.difference > 0 ? "+" : ""}${nfmt(d.difference)}`, options: { bold: true, color: d.difference < 0 ? C.red : d.difference > 0 ? C.green : C.text } },
          ])),
        ] as any, { ...tableOpts(MX + CW * 0.58, cy + 0.55, CW * 0.42 - 0.3, [1.0, 1.15, 1.15, 0.9], 7), rowH: 0.24 });
        break;
      }

      case "suppliers": {
        const s = newSlide();
        let y = header(s, "Supplier Analysis", section.title);
        y = wwwCards(s, y,
          `Audit reconciliations mapped across ${m.suppliers.length} resolved supplier entities.`,
          "Discrepancy levels tracked by grouping parsed rows to supplier names.",
          "Enables vendor delivery auditing, contract review, and identification of supply chains with material risk.");
        y = kpiRow(s, y, [
          ["Mapped Suppliers", String(m.suppliers.length), C.white, "Resolved suppliers in file"],
          ["Top Exposure Supplier", trunc(m.highestRiskSupplier || "—", 20), C.orange, "Supplier with highest variance"],
          ["Supplier Abs Variance", fmtSAR(a.supplierAbsVarianceTotal), C.orange, "Total supplier absolute risk"],
          ["Average Match Rate", fmtPct(a.avgSupplierMatchRate), C.green, "Average supplier line matching"],
        ]);
        const top5 = a.suppliersByVariance.slice(0, 5);
        const pw2 = (CW - 0.2) / 2;
        const ph3 = PH - y - 0.55;
        panel(s, MX, y, pw2, ph3, "Top 5 Suppliers by Absolute Variance");
        s.addChart(pptx.ChartType.bar, [{
          name: "Abs Variance", labels: top5.map(x => trunc(x.supplier, 18)).reverse(), values: top5.map(x => Math.round(x.absoluteVarianceValue)).reverse(),
        }], { x: MX + 0.15, y: y + 0.5, w: pw2 - 0.3, h: ph3 - 0.65, barDir: "bar", chartColors: [C.orange], showValue: true, dataLabelColor: C.white, dataLabelFontSize: 7.5, valAxisHidden: true, catAxisLabelColor: C.white, catAxisLabelFontSize: 7.5, showLegend: false });
        const top3 = a.suppliersByVariance.slice(0, 3);
        const others = Math.max(a.supplierAbsVarianceTotal - top3.reduce((t, x) => t + x.absoluteVarianceValue, 0), 0);
        panel(s, MX + pw2 + 0.2, y, pw2, ph3, "Variance Share of Top Suppliers");
        s.addChart(pptx.ChartType.doughnut, [{
          name: "Variance Share",
          labels: [...top3.map(x => trunc(x.supplier, 20)), "All Others"],
          values: [...top3.map(x => Math.round(x.absoluteVarianceValue)), Math.round(others)],
        }], { x: MX + pw2 + 0.4, y: y + 0.5, w: pw2 - 0.6, h: ph3 - 0.7, chartColors: [C.orange, C.goldSoft, C.blue, "3A4A63"], holeSize: 60, showLegend: true, legendPos: "r", legendColor: C.text, legendFontSize: 7.5, showValue: false });
        s.addText(`TOTAL\nSAR ${(a.supplierAbsVarianceTotal / 1000).toFixed(1)}K`, { x: MX + pw2 + 0.4, y: y + ph3 / 2 - 0.35, w: (pw2 - 0.6) * 0.62, h: 0.7, fontSize: 9, bold: true, color: C.white, align: "center" });
        break;
      }

      case "suppliersAll": {
        const s = newSlide();
        const y = header(s, "Supplier Analysis", section.title, "Detailed inventory analytics for all resolved supplier entities · Top 15 by absolute variance");
        s.addTable([
          thRow(["Supplier Name", "Items", "ERP Value", "Coverage", "Abs. Variance", "Match Rate"]),
          ...a.suppliersByVariance.slice(0, 15).map(x => ([
            { text: trunc(x.supplier, 36), options: { bold: true, color: C.white } },
            { text: nfmt(x.itemCount) }, { text: money2(x.erpValue) },
            { text: fmtPct(x.coverageRate), options: { color: x.coverageRate >= 90 ? C.green : x.coverageRate >= 50 ? C.gold : C.orange } },
            { text: money2(x.absoluteVarianceValue), options: { bold: x.absoluteVarianceValue > 1000, color: x.absoluteVarianceValue > 1000 ? C.orange : C.text } },
            { text: fmtPct(x.matchingRate) },
          ])),
        ] as any, { ...tableOpts(MX, y, CW, [3.4, 0.95, 1.95, 1.15, 1.95, 1.19], 7.5), rowH: 0.32 });
        break;
      }

      case "workforce": {
        const s = newSlide();
        let y = header(s, "Workforce Analysis", section.title);
        const counters = a.counters;
        const top = counters[0];
        const totalCounted = counters.reduce((t, c) => t + c.itemsCounted, 0);
        const avgAcc = counters.length ? counters.reduce((t, c) => t + c.accuracyRate, 0) / counters.length : 100;
        y = wwwCards(s, y,
          `Reconciliation performance tracked for ${counters.length} active count specialists.`,
          "Physical stock bins and count tags on the warehouse floor.",
          "Evaluates speed, productivity and accuracy rate per counter to ensure verification process data integrity.");
        y = kpiRow(s, y, [
          ["Active Counters", String(counters.length), C.white, "Physical count specialists"],
          ["Top Counter", top?.name || "—", C.green, top ? `${nfmt(top.itemsCounted)} items counted` : undefined],
          ["Lines Attributed", nfmt(totalCounted), C.white, "Count lines with a named counter"],
          ["Average Accuracy", fmtPct(avgAcc), avgAcc >= 95 ? C.green : C.gold, "Mean zero-variance rate across team"],
        ]);
        panel(s, MX, y, CW, PH - y - 0.55, "Productivity Share", "Portion of attributed count lines completed per specialist");
        s.addChart(pptx.ChartType.bar, [{
          name: "Items Counted", labels: counters.map(c => c.name).reverse(), values: counters.map(c => c.itemsCounted).reverse(),
        }], { x: MX + 0.15, y: y + 0.55, w: CW - 0.3, h: PH - y - 1.3, barDir: "bar", chartColors: [C.blue], showValue: true, dataLabelColor: C.white, dataLabelFontSize: 7.5, valAxisHidden: true, catAxisLabelColor: C.white, catAxisLabelFontSize: 8, showLegend: false });
        break;
      }

      case "leaderboard": {
        const s = newSlide();
        const y = header(s, "Workforce Analysis", section.title, "Verification speed and accuracy performance metrics for field counters");
        s.addTable([
          thRow(["Rank", "Counter", "Items Counted", "Physical Qty", "Verified Value", "Productivity", "Accuracy"]),
          ...a.counters.map((c, i) => ([
            { text: String(i + 1) },
            { text: c.name, options: { bold: true, color: C.white } },
            { text: nfmt(c.itemsCounted) }, { text: nfmt(c.verifiedQty) }, { text: money2(c.verifiedValue) },
            { text: fmtPct(c.productivityRate) },
            { text: fmtPct(c.accuracyRate), options: { color: c.accuracyRate >= 95 ? C.green : c.accuracyRate >= 80 ? C.gold : C.red } },
          ])),
        ] as any, { ...tableOpts(MX, y, CW, [0.7, 1.7, 1.6, 1.5, 2.1, 1.5, 1.49], 8), rowH: 0.34 });
        break;
      }

      case "risk": {
        const s = newSlide();
        let y = header(s, "Financial Risk", section.title);
        y = wwwCards(s, y,
          `Identified absolute financial risk of ${fmtSAR(m.totalRiskValue)} across ${nfmt(m.totalLines)} inventory line items.`,
          "Concentrated within high-variance line items across divisions.",
          "Provides core write-off analysis to proactively isolate high-risk asset records and support financial provisioning.");
        y = kpiRow(s, y, [
          ["Total Absolute Risk", fmtSAR(m.totalRiskValue), C.orange, "Sum of absolute variances"],
          ["Net Variance", signed(m.varianceValue), m.varianceValue < 0 ? C.orange : C.green, "Excess offset against shortage"],
          ["Shortage Value", fmtSAR(m.totalShortageValue), C.orange, "Physically missing vs ERP"],
          ["Excess Value", fmtSAR(m.totalExcessValue), C.green, "Surplus stock discovered"],
        ]);
        panel(s, MX, y, CW, PH - y - 0.55, "Top 5 High-Risk Discrepancy Items", "Sorted by absolute variance descending");
        s.addTable([
          thRow(["Item Code", "Supplier", "Organization", "ERP Qty", "Physical Qty", "Variance Value", "Status"]),
          ...m.highestRiskItems.slice(0, 5).map((it: any) => ([
            { text: it.itemCode || "N/A", options: { bold: true, color: C.white } },
            { text: trunc(it.supplier || it.supplierName || "Others", 22) },
            { text: it.org || "—" },
            { text: nfmt(it.erpQty ?? 0) }, { text: nfmt(it.physicalQty ?? 0) },
            { text: money2(it.varianceValue ?? 0), options: { bold: true, color: (it.varianceValue ?? 0) < 0 ? C.red : C.green } },
            { text: (it.status || "open").toUpperCase(), options: { bold: true, color: C.orange } },
          ])),
        ] as any, { ...tableOpts(MX + 0.15, y + 0.55, CW - 0.3, [1.5, 2.2, 1.3, 1.0, 1.2, 1.9, 1.0], 7.5), rowH: 0.3 });
        break;
      }

      case "riskItems": {
        const s = newSlide();
        const y = header(s, "Financial Risk", section.title, "Specific item rows that represent the highest financial vulnerability");
        s.addTable([
          thRow(["Item Code", "Supplier", "Org", "ERP / Phys", "Variance Value", "Status"]),
          ...m.highestRiskItems.slice(0, 10).map((it: any) => ([
            { text: it.itemCode || "N/A", options: { bold: true, color: C.white } },
            { text: trunc(it.supplier || it.supplierName || "Others", 26) },
            { text: it.org || "—" },
            { text: `${nfmt(it.erpQty ?? 0)} / ${nfmt(it.physicalQty ?? 0)}` },
            { text: money2(it.varianceValue ?? 0), options: { bold: true, color: (it.varianceValue ?? 0) < 0 ? C.red : C.green } },
            { text: (it.status || "open").toUpperCase(), options: { bold: true, color: C.orange } },
          ])),
        ] as any, { ...tableOpts(MX, y, CW, [1.7, 2.9, 1.0, 1.6, 2.2, 1.19], 8), rowH: 0.36 });
        break;
      }

      case "validation": {
        const s = newSlide();
        let y = header(s, "Full Registry", section.title);
        y = wwwCards(s, y,
          `Displaying detailed reconciliation registry for ${nfmt(m.totalLines)} matching items.`,
          "Spanning all worksheets, warehouse cost organizations, and suppliers.",
          "Provides the ultimate trace utility for individual discrepancies, with sortable, filterable, multi-field query support.");
        y = kpiRow(s, y, [
          ["Filtered Items", nfmt(m.totalLines), C.white],
          ["Action Required", nfmt(a.actionRequiredCount), C.gold],
          ["Filtered Abs Risk", fmtSAR(m.totalRiskValue), C.orange],
          ["Filtered Net Variance", signed(m.varianceValue), C.orange],
        ]);
        panel(s, MX, y, CW, PH - y - 0.55, "Registry Scope");
        s.addText(
          `The registry supports responsive headers, column sorting, pagination, and multi-field query inputs — spanning all ${m.divisions.length} divisions and ${m.suppliers.length} supplier entities.`,
          { x: MX + 0.18, y: y + 0.5, w: CW - 0.4, h: 0.8, fontSize: 10, color: C.text });
        break;
      }

      case "actionItems": {
        const s = newSlide();
        const y = header(s, "Full Registry", `${section.title} (${nfmt(a.actionRequiredCount)})`, "High-risk open items — top 15 by absolute variance");
        s.addTable([
          thRow(["Item Code", "Supplier", "Division", "ERP Qty", "Phys Qty", "Var Qty", "Variance Value", "Status", "Priority"]),
          ...a.actionItems.slice(0, 15).map((r: any) => {
            const level = riskLevelOf(r.absoluteVarianceValue ?? 0);
            return [
              { text: r.itemCode || "N/A", options: { bold: true, color: C.white } },
              { text: trunc(r.supplier || "Others", 20) },
              { text: r.org || "—" },
              { text: nfmt(r.erpQty ?? 0) }, { text: nfmt(r.physicalQty ?? 0) },
              { text: `${(r.differenceQty ?? 0) > 0 ? "+" : ""}${nfmt(r.differenceQty ?? 0)}`, options: { color: (r.differenceQty ?? 0) < 0 ? C.red : C.green } },
              { text: money2(r.varianceValue ?? 0), options: { bold: true, color: (r.varianceValue ?? 0) < 0 ? C.red : C.green } },
              { text: (r.status || "open").toUpperCase(), options: { bold: true, color: C.orange } },
              { text: level, options: { bold: true, color: riskColorOf(level) } },
            ];
          }),
        ] as any, { ...tableOpts(MX, y, CW, [1.25, 1.9, 0.8, 0.85, 0.85, 0.85, 1.75, 0.85, 1.49], 7), rowH: 0.3 });
        break;
      }

      case "team": {
        const proofs = getProofImages(images);
        if (proofs.length === 0) break;
        for (let i = 0; i < proofs.length; i += 6) {
          const chunk = proofs.slice(i, i + 6);
          const s = newSlide();
          const y = header(s, "Verification Evidence", i === 0 ? section.title : `${section.title} (Continued)`, "Uploaded proof photographs from the verification exercise");
          chunk.forEach((img, idx) => {
            const col = idx % 3, row = Math.floor(idx / 3);
            const w = (CW - 0.4) / 3, h = (PH - y - 0.75) / 2 - 0.1;
            const x = MX + col * (w + 0.2), iy = y + row * (h + 0.2);
            panel(s, x, iy, w, h);
            try {
              s.addImage({ data: img.url, x: x + 0.1, y: iy + 0.1, w: w - 0.2, h: h - 0.45, sizing: { type: "contain", w: w - 0.2, h: h - 0.45 } });
            } catch { /* skip unloadable image */ }
            s.addText(trunc(img.caption || img.name || "Site photograph", 40), { x: x + 0.1, y: iy + h - 0.32, w: w - 0.2, h: 0.25, fontSize: 7.5, color: C.text });
          });
        }
        break;
      }

      case "backcover": {
        const s = newSlide();
        s.addText("Thank You", { x: MX, y: PH / 2 - 0.6, w: CW, h: 1, fontSize: 40, bold: true, color: C.white });
        s.addText((cover.clientName || "GAS ARABIAN SERVICES").toUpperCase(), { x: MX, y: PH - 0.85, w: 6, h: 0.3, fontSize: 11, bold: true, color: "C6D2E4", charSpacing: 4 });
        s.addText(`© ${new Date().getFullYear()}  All Rights Reserved`, { x: MX, y: PH - 0.55, w: 6, h: 0.25, fontSize: 8, color: C.dim });
        break;
      }

      default: {
        const s = newSlide();
        const y = header(s, section.title, section.title);
        s.addText(section.notes || section.description || "Custom section.", { x: MX, y, w: CW, h: 1, fontSize: 10, color: C.text });
      }
    }
  }

  await pptx.writeFile({ fileName: input.fileName });
}
