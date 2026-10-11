/**
 * mobile/src/ui/CheckRow.tsx — accessible checkbox row with an animated tick.
 */
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "../components/Text";
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
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
        onToggle();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.row}
      hitSlop={4}
    >
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

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, minHeight: 48 },
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
  },
  boxOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  body: { flex: 1, marginLeft: 12 },
  label: { fontSize: 15, color: theme.colors.text, lineHeight: 22 },
  sub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, lineHeight: 19 },
});
