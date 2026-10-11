/**
 * mobile/src/theme.ts — WhatIf visual language.
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
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_600SemiBold_Italic",
  displayBlack: "Fraunces_800ExtraBold",
} as const;

/** Maps a style fontWeight onto the matching Poppins face. */
export function fontForWeight(weight?: string | number): string {
  const w =
    typeof weight === "string"
      ? parseInt(weight, 10) || (weight === "bold" ? 700 : 400)
      : (weight ?? 400);
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

export const shadows = {
  card: {
    shadowColor: "#1A2320",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  lift: {
    shadowColor: "#0F3B2A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

export type Theme = typeof theme;
