/**
 * Design tokens for the Enterprise Report Builder.
 * centralizing color palette, typography system, spacing, and layout metrics.
 * 
 * IMPORTANT: Because html2canvas does not support modern CSS color functions or variables,
 * all colors are defined as raw hexadecimal strings for inline-style compatibility.
 */

export const C = {
  // Brand Colors (GAS Arabian Services design language)
  brand: {
    primary: "#1B3A5C",    // Dark Navy
    secondary: "#2E75B6",  // Corporate Blue
    accent: "#C4A265",     // Premium Gold
    dark: "#0D1B2A",       // Cover page background / headers
    light: "#F4F6F8",      // Faint page/panel background
    white: "#FFFFFF",
  },
  
  // Neutral Typography Colors
  text: {
    primary: "#1A1A2E",    // Dark charcoal for body text
    secondary: "#4A5568",  // Slate for subheadings and details
    muted: "#718096",      // Cool gray for captions and footnotes
    faint: "#A0AEC0",      // Light line borders or disabled states
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
  border: "#E2E8F0",
  borderSoft: "#F1F5F9",
  panel: "#F8FAFC",
};

export const TYPOGRAPHY = {
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
