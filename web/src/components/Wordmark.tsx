/**
 * web/src/components/Wordmark.tsx — the WhatIf wordmark: Fraunces
 * ExtraBold, "What" upright in forest green, "If" italic in sun orange (the
 * same "what if…" voice as the editorial headlines). Matches the splash
 * lockup in public/splash-icon.png and the mobile header.
 */
import React from "react";
import { Text, type StyleInput } from "../ui/primitives";
import { fonts, theme } from "../theme";

export function Wordmark({ size = 26, as = "span", style }: { size?: number; as?: "span" | "h1"; style?: StyleInput }) {
  return (
    <Text
      as={as}
      aria-label="WhatIf"
      style={[
        {
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: size,
          lineHeight: `${Math.round(size * 1.12)}px`,
          letterSpacing: "-0.035em",
          fontVariationSettings: '"opsz" 72',
          color: theme.colors.accent,
          whiteSpace: "nowrap",
        },
        style,
      ]}
    >
      What
      <Text style={{ fontStyle: "italic", color: theme.colors.orange, letterSpacing: "-0.02em", marginLeft: "0.05em" }}>If</Text>
    </Text>
  );
}
