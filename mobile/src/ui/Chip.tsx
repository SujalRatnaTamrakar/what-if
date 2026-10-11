/**
 * mobile/src/ui/Chip.tsx — selectable pill (filters, tools, sizes).
 */
import React from "react";
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "../components/Text";
import { theme } from "../theme";

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: (color: string) => React.ReactNode;
  tone?: "default" | "light";
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: "button" | "tab" | "radio";
}

export function Chip({ label, active, onPress, icon, tone = "default", style, accessibilityRole = "button" }: Props) {
  const fg = active ? "#fff" : theme.colors.text;
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        styles.chip,
        tone === "light" && styles.light,
        active && styles.active,
        pressed && !active && styles.pressed,
        style,
      ]}
    >
      {icon ? icon(fg) : null}
      <Text style={[styles.text, { color: fg }, icon ? { marginLeft: 6 } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.paperDeep,
  },
  light: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  active: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  pressed: { opacity: 0.75 },
  text: { fontSize: 14, fontWeight: "600" },
});
