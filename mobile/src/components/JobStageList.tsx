/**
 * mobile/src/components/JobStageList.tsx — real stage names, never fake
 * percentages (§7.5 Global). Current stage highlighted, finished get a check.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import type { JobStage } from "../api/types";
import { ACCENT, INK, MUTED } from "./PrimaryButton";

const LABELS: Record<JobStage, string> = {
  queued: "Queued",
  analyze: "Analyzing photo",
  prompt: "Writing edit prompt",
  render: "Rendering edit",
  review: "Reviewing concept",
  draft: "Drafting request",
  finalize: "Finalizing",
  done: "Done",
};

interface Props {
  stages: JobStage[];
  current: JobStage;
}

export function JobStageList({ stages, current }: Props) {
  const currentIdx = stages.indexOf(current);
  return (
    <View style={styles.list} accessibilityRole="list">
      {stages.map((stage, i) => {
        const done = currentIdx === -1 || i < currentIdx || current === "done";
        const isCurrent = i === currentIdx && current !== "done";
        return (
          <View key={stage} style={styles.row}>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                isCurrent && styles.dotCurrent,
              ]}
            >
              {done ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text
              style={[
                styles.label,
                isCurrent && styles.labelCurrent,
                !done && !isCurrent && styles.labelTodo,
              ]}
            >
              {LABELS[stage]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  dotDone: { backgroundColor: ACCENT, borderColor: ACCENT },
  dotCurrent: { borderColor: ACCENT },
  check: { color: "#fff", fontWeight: "800", fontSize: 14 },
  label: { fontSize: 15, color: INK },
  labelCurrent: { fontWeight: "700", color: ACCENT },
  labelTodo: { color: MUTED },
});
