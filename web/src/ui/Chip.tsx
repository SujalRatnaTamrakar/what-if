/**
 * web/src/ui/Chip.tsx — selectable pill (filters, tools, sizes).
 */
import React from "react";
import { Pressable, Text, styleSheet, type StyleInput } from "./primitives";
import { theme } from "../theme";

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: (color: string) => React.ReactNode;
  tone?: "default" | "light";
  style?: StyleInput;
  accessibilityRole?: "button" | "tab" | "radio";
}

export function Chip({ label, active, onPress, icon, tone = "default", style, accessibilityRole = "button" }: Props) {
  const fg = active ? "#fff" : theme.colors.text;
  return (
    <Pressable
      onPress={onPress}
      role={accessibilityRole}
      selected={!!active}
      feedback={active ? "none" : "opacity"}
      style={[styles.chip, tone === "light" && styles.light, active && styles.active, style]}
    >
      {icon ? icon(fg) : null}
      <Text style={[styles.text, { color: fg }, icon ? { marginLeft: 6 } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = styleSheet({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    paddingLeft: 15,
    paddingRight: 15,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.paperDeep,
    whiteSpace: "nowrap",
  },
  light: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  active: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  text: { fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" },
});
