/**
 * web/src/components/AiLabel.tsx — the "AI illustration" chip (§7.5 Global).
 * Overlaid on every concept image. Position it with a style prop.
 */
import React from "react";
import { Text, View, type StyleInput } from "../ui/primitives";
import { SparkleIcon } from "./icons";
import { theme } from "../theme";

export function AiLabel({ style }: { style?: StyleInput }) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "rgba(227, 240, 232, 0.95)",
          borderRadius: 999,
          padding: "5px 10px",
        },
        style,
      ]}
    >
      <SparkleIcon size={13} color={theme.colors.accent} />
      <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: 600, marginLeft: 4, whiteSpace: "nowrap" }}>AI illustration</Text>
    </View>
  );
}
