/**
 * mobile/src/theme.ts — shared visual language: clean civic look, one deep-green accent.
 * Framework-free.
 */
export const theme = {
  colors: {
    accent: "#1d5c40",
    accentDark: "#12402C",
    accentSoft: "#E3F0E8",
    orange: "#e8a33d",
    background: "#f6f1e7",
    card: "#FFFFFF",
    text: "#1F2933",
    muted: "#6B7280",
    border: "#E7E1D3",
    danger: "#B3261E",
    dangerSoft: "#FDECEA",
    warning: "#8A5A00",
    warningSoft: "#FFF3D4",
    success: "#1E5B3F",
    successSoft: "#E8F1EA",
    info: "#2F5D8A",
    infoSoft: "#E9F1F9",
  },
  radius: { s: 8, m: 12, l: 16, pill: 999 },
  spacing: { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 },
  fontSize: { s: 13, m: 15, l: 17, xl: 21, xxl: 26 },
} as const;

export type Theme = typeof theme;
