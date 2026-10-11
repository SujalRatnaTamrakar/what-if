/**
 * web/src/theme.ts — WhatIf visual language (same tokens as mobile/src/theme.ts).
 * Editorial civic look: cream paper, forest green, sun orange; Fraunces for
 * display headlines, Poppins for UI. Framework-free.
 */
export const theme = {
  colors: {
    accent: "#1D5C40",
    accentDark: "#0F3B2A",
    accentSoft: "#E3F0E8",
    accentLine: "#BFDCCB",
    orange: "#E8A33D",
    orangeSoft: "#FBEBD0",
    background: "#F6F1E7",
    paperDeep: "#EFE8DA",
    card: "#FFFFFF",
    text: "#1A2320",
    muted: "#6B7268",
    faint: "#9AA095",
    border: "#E7E1D3",
    danger: "#B3261E",
    dangerSoft: "#FDECEA",
    coral: "#D2603F",
    coralSoft: "#FBE7E0",
    warning: "#8A5A00",
    warningSoft: "#FFF3D4",
    success: "#1E5B3F",
    successSoft: "#E8F1EA",
    info: "#2F5D8A",
    infoSoft: "#E9F1F9",
    scrim: "rgba(15, 25, 20, 0.62)",
  },
  radius: { s: 8, m: 12, l: 16, xl: 22, pill: 999 },
  spacing: { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 },
  fontSize: { s: 13, m: 15, l: 17, xl: 21, xxl: 26 },
} as const;

export const fonts = {
  ui: "'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
} as const;

/** Native shadow presets as CSS box-shadows. */
export const shadows = {
  card: { boxShadow: "0 5px 14px rgba(26, 35, 32, 0.07)" },
  lift: { boxShadow: "0 8px 18px rgba(15, 59, 42, 0.18)" },
} as const;

export type Theme = typeof theme;
