/**
 * mobile/src/ui/Card.tsx — white rounded surface with a soft shadow.
 */
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { shadows, theme } from "../theme";

export function Card({
  children,
  style,
  tone = "white",
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: "white" | "mint" | "sun" | "coral" | "paper";
}) {
  const bg = {
    white: theme.colors.card,
    mint: theme.colors.accentSoft,
    sun: theme.colors.orangeSoft,
    coral: theme.colors.coralSoft,
    paper: theme.colors.paperDeep,
  }[tone];
  return <View style={[styles.card, { backgroundColor: bg }, tone === "white" && shadows.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: theme.radius.xl, padding: theme.spacing.l },
});
