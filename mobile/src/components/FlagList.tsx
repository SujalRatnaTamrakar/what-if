/**
 * mobile/src/components/FlagList.tsx — review flags (§7.5 S5).
 * Severity badge + message; acknowledge checkbox for warnings ONLY.
 * Blocking/info flags are display-only.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import type { ReviewFlag } from "../api/types";
import { theme } from "../theme";

interface Props {
  flags: ReviewFlag[];
  acknowledged: string[];
  onToggle: (flagId: string) => void;
}

const SEVERITY_STYLE: Record<
  ReviewFlag["severity"],
  { label: string; bg: string; fg: string }
> = {
  info: { label: "Info", bg: theme.colors.infoSoft, fg: theme.colors.info },
  warning: {
    label: "Warning",
    bg: theme.colors.warningSoft,
    fg: theme.colors.warning,
  },
  blocking: {
    label: "Blocking",
    bg: theme.colors.dangerSoft,
    fg: theme.colors.danger,
  },
};

export function FlagList({ flags, acknowledged, onToggle }: Props) {
  if (flags.length === 0) return null;
  return (
    <View>
      {flags.map((flag) => {
        const sev = SEVERITY_STYLE[flag.severity];
        const isWarning = flag.severity === "warning";
        const checked = acknowledged.includes(flag.id);
        return (
          <View key={flag.id} style={styles.row}>
            <View style={[styles.badge, { backgroundColor: sev.bg }]}>
              <Text style={[styles.badgeText, { color: sev.fg }]}>
                {sev.label}
              </Text>
            </View>
            <Text style={styles.message}>{flag.message}</Text>
            {isWarning ? (
              <Pressable
                onPress={() => onToggle(flag.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`Acknowledge: ${flag.message}`}
                style={[styles.checkbox, checked && styles.checkboxChecked]}
              >
                {checked ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.m,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.s,
  },
  badge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: theme.spacing.s,
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
  message: { flex: 1, fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.s,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  check: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
