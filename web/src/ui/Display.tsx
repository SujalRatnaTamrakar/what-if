/**
 * web/src/ui/Display.tsx — Fraunces display type for editorial headlines.
 * `italic` renders the signature "What if…" voice. Nested Displays render
 * inline (one heading element).
 */
import React, { createContext, useContext } from "react";
import { Text, type StyleInput } from "./primitives";
import { fonts, theme } from "../theme";

interface Props {
  size?: number;
  italic?: boolean;
  color?: string;
  style?: StyleInput;
  children?: React.ReactNode;
}

const Nested = createContext(false);

export function Display({ size = 30, italic, color = theme.colors.text, style, children }: Props) {
  const nested = useContext(Nested);
  return (
    <Text
      as={nested ? "span" : "h2"}
      style={[
        {
          fontFamily: fonts.display,
          fontWeight: 600,
          fontStyle: italic ? "italic" : "normal",
          fontSize: size,
          lineHeight: `${Math.round(size * 1.15)}px`,
          color,
          letterSpacing: -0.4,
          fontVariationSettings: '"opsz" 72',
        },
        style,
      ]}
    >
      <Nested.Provider value>{children}</Nested.Provider>
    </Text>
  );
}
