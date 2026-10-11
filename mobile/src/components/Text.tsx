/**
 * mobile/src/components/Text.tsx — drop-in replacement for react-native Text.
 * Maps `fontWeight` to the matching Poppins face (custom fonts ignore
 * fontWeight on Android) so existing styles keep working unchanged.
 */
import React from "react";
import { StyleSheet, Text as RNText, type TextProps } from "react-native";
import { fontForWeight } from "../theme";

export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const family = flat.fontFamily ?? fontForWeight(flat.fontWeight);
  return (
    <RNText
      {...rest}
      style={[style, { fontFamily: family, fontWeight: undefined }]}
    />
  );
}
