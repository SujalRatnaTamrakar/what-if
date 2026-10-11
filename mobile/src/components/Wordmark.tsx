/**
 * mobile/src/components/Wordmark.tsx — the WhatIf wordmark: Fraunces
 * ExtraBold, "What" upright in forest green, "If" italic in sun orange (the
 * same "what if…" voice as the editorial headlines). Matches the splash
 * lockup in assets/splash-icon.png and the web header.
 */
import React from "react";
import { Text as RNText, type StyleProp, type TextStyle } from "react-native";
import { fonts, theme } from "../theme";

export function Wordmark({ size = 26, style }: { size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <RNText
      accessibilityRole="header"
      accessibilityLabel="WhatIf"
      allowFontScaling={false}
      style={[
        {
          fontFamily: fonts.displayBlack,
          fontSize: size,
          lineHeight: Math.round(size * 1.12),
          letterSpacing: -size * 0.035,
          color: theme.colors.accent,
        },
        style,
      ]}
    >
      What
      <RNText style={{ fontFamily: fonts.displayBlackItalic, color: theme.colors.orange, letterSpacing: -size * 0.02 }}>
        {" "}If
      </RNText>
    </RNText>
  );
}
