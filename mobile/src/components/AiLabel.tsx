/**
 * mobile/src/components/AiLabel.tsx — the "AI illustration" chip (§7.5 Global).
 * Overlaid on every concept image. Position it with a style prop.
 */
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { SparkleIcon } from "./icons";
import { theme } from "../theme";

export function AiLabel({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, style]}>
      <SparkleIcon size={13} color={theme.colors.accent} />
      <Text style={styles.text}>AI illustration</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(227, 240, 232, 0.95)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: { color: theme.colors.accent, fontSize: 11, fontWeight: "600", marginLeft: 4 },
});
