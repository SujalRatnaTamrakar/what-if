/**
 * web/src/ui/CheckRow.tsx — accessible checkbox row with a tick.
 */
import React from "react";
import { Pressable, Text, View, styleSheet } from "./primitives";
import { CheckIcon } from "../components/icons";
import { theme } from "../theme";

export function CheckRow({
  checked,
  onToggle,
  label,
  sub,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <Pressable onPress={onToggle} role="checkbox" checked={checked} label={label} feedback="none" style={styles.row}>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <CheckIcon size={16} color="#fff" strokeWidth={3} /> : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = styleSheet({
  row: { flexDirection: "row", alignItems: "flex-start", paddingTop: 10, paddingBottom: 10, minHeight: 48, width: "100%" },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.faint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    backgroundColor: theme.colors.card,
    transition: "background-color 140ms ease, border-color 140ms ease",
  },
  boxOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  body: { flex: 1, marginLeft: 12 },
  label: { fontSize: 15, color: theme.colors.text, lineHeight: "22px" },
  sub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, lineHeight: "19px" },
});
