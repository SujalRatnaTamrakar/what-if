/**
 * web/src/ui/Card.tsx — white rounded surface with a soft shadow.
 */
import React from "react";
import { View, type StyleInput } from "./primitives";
import { shadows, theme } from "../theme";

export function Card({
  children,
  style,
  tone = "white",
}: {
  children: React.ReactNode;
  style?: StyleInput;
  tone?: "white" | "mint" | "sun" | "coral" | "paper";
}) {
  const bg = {
    white: theme.colors.card,
    mint: theme.colors.accentSoft,
    sun: theme.colors.orangeSoft,
    coral: theme.colors.coralSoft,
    paper: theme.colors.paperDeep,
  }[tone];
  return (
    <View style={[{ borderRadius: theme.radius.xl, padding: theme.spacing.l, backgroundColor: bg }, tone === "white" && shadows.card, style]}>
      {children}
    </View>
  );
}
