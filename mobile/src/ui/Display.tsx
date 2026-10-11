/**
 * mobile/src/ui/Display.tsx — Fraunces display type for editorial headlines.
 * `italic` renders the signature "What if…" voice.
 */
import React, { createContext, useContext } from "react";
import { Text as RNText, type TextProps } from "react-native";
import { fonts, theme } from "../theme";

interface Props extends TextProps {
  size?: number;
  italic?: boolean;
  color?: string;
}

const Nested = createContext(false);

export function Display({ size = 30, italic, color = theme.colors.text, style, children, ...rest }: Props) {
  const nested = useContext(Nested);
  return (
    <RNText
      accessibilityRole={nested ? undefined : "header"}
      {...rest}
      style={[
        {
          fontFamily: italic ? fonts.displayItalic : fonts.display,
          fontSize: size,
          lineHeight: Math.round(size * 1.15),
          color,
          letterSpacing: -0.4,
        },
        style,
      ]}
    >
      <Nested.Provider value>{children}</Nested.Provider>
    </RNText>
  );
}
