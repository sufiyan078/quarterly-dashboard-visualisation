/**
 * Design tokens for the Enterprise Report Builder.
 * centralizing color palette, typography system, spacing, and layout metrics.
 * 
 * IMPORTANT: Because html2canvas does not support modern CSS color functions or variables,
 * all colors are defined as raw hexadecimal strings for inline-style compatibility.
 */

export const C = {
  // Brand Colors — taken directly from the GAS Arabian Services master
  // report template (page 4 "Colour Palette & Typography" reference):
  //   Primary Navy #12283C · Accent Teal #3FC9A4
  //   Neutral Grey #AEB6C0 · Background #F3F5F7
  brand: {
    primary: "#12283C",    // Primary Navy (headings, cover background)
    secondary: "#2E5771",  // Mid navy-slate (from the template's colour ramp)
    accent: "#3FC9A4",     // Accent Teal (overlines, highlights, title accents)
    accentDark: "#1E9B7C", // Darker teal for small text on white (contrast)
    dark: "#0C1B2A",       // Deepest navy (cover gradient end)
    light: "#F3F5F7",      // Template background tint
    white: "#FFFFFF",
  },

  // Neutral Typography Colors
  text: {
    primary: "#1A2733",    // Near-navy charcoal for body text
    secondary: "#44546A",  // Slate for subheadings and details
    muted: "#7A8694",      // Cool gray for captions and footnotes
    faint: "#AEB6C0",      // Template Neutral Grey — borders / disabled
  },

  // Alert & Priority Status Colors (Premium tints)
  status: {
    good: "#059669",       // Positive/On-track (Emerald)
    goodSoft: "#ECFDF5",
    bad: "#DC2626",        // Shortage/Issue (Red)
    badSoft: "#FEF2F2",
    warn: "#D97706",       // Excess/Warning (Amber)
    warnSoft: "#FFFBEB",
    info: "#2B6CB0",       // Contextual info (Blue)
    infoSoft: "#EBF8FF",
    critical: "#991B1B",   // Extreme risk
    criticalSoft: "#FEE2E2",
  },

  // Structural Elements
  border: "#E1E6EB",
  borderSoft: "#F3F5F7",
  panel: "#F8FAFB",
};

export const TYPOGRAPHY = {
  // Template typography: Poppins — Headings · Inter — Body Text.
  // next/font registers these under generated family names, so we reference
  // the CSS variables; the browser resolves them in computed styles, which
  // is what html2canvas reads during PDF export.
  fontFamily: "var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headingFamily: "var(--font-poppins), Poppins, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  sizes: {
    title: "32px",
    sectionTitle: "20px",
    subheading: "14px",
    body: "11px",
    bodyLarge: "11.5px",
    label: "8.5px",
    tableHeader: "8.5px",
    tableCell: "10px",
    code: "9.5px",
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  }
};

export const LAYOUT = {
  width: "794px",      // A4 width in pixels at 96 DPI
  height: "1123px",    // A4 height in pixels at 96 DPI
  padding: {
    top: "56px",
    bottom: "44px",
    left: "68px",
    right: "68px",
  }
};
