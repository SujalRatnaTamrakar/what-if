/**
 * mobile/src/components/AiLabel.tsx — the "AI illustration" chip (§7.5 Global).
 * Overlaid on every concept image. Position it with a style prop.
 */
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export function AiLabel({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, style]}>
      <Text style={styles.text}>✨ AI illustration</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "rgba(27, 94, 63, 0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
