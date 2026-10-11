/**
 * mobile/src/components/Text.tsx — drop-in replacement for react-native Text.
 * Maps `fontWeight` to the matching Poppins face (custom fonts ignore
 * fontWeight on Android). Nested Text without its own weight/family inherits
 * the parent's face instead of resetting to Regular.
 */
import React, { createContext, useContext } from "react";
import { StyleSheet, Text as RNText, type TextProps } from "react-native";
import { fontForWeight } from "../theme";

const InsideText = createContext(false);

export function Text({ style, ...rest }: TextProps) {
  const nested = useContext(InsideText);
  const flat = StyleSheet.flatten(style) ?? {};
  const explicit = flat.fontFamily != null || flat.fontWeight != null;
  const fontStyle = nested && !explicit ? null : { fontFamily: flat.fontFamily ?? fontForWeight(flat.fontWeight), fontWeight: undefined };
  return (
    <InsideText.Provider value>
      <RNText {...rest} style={[style, fontStyle]} />
    </InsideText.Provider>
  );
}
