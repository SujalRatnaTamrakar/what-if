/**
 * mobile/src/components/JobStageList.tsx — live AI pipeline timeline.
 * Done stages get a tick, the running stage pulses, pending stages are faint.
 * Human copy per stage so people know what the AI is doing.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Text } from "./Text";
import { CheckIcon } from "./icons";
import type { JobStage, JobStatus } from "../api/types";
import { theme } from "../theme";

const COPY: Record<JobStage, string> = {
  queued: "Waiting for a free AI worker",
  analyze: "Reading the scene — what's there, what to keep",
  prompt: "Turning your idea into an edit plan",
  render: "Painting the change inside your brush",
  review: "AI reviewer checking the result",
  draft: "Drafting your request to the city",
  finalize: "Matching size and blending edges",
  done: "Done",
};

function Pulse() {
  const s = useSharedValue(0.4);
  useEffect(() => {
    s.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [s]);
  const st = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: 0.7 + s.value * 0.3 }] }));
  return <Animated.View style={[styles.pulse, st]} />;
}

export function JobStageList({
  stages,
  current,
  status,
}: {
  stages: JobStage[];
  current: JobStage | undefined;
  status: JobStatus | undefined;
}) {
  const visible = stages.filter((s) => s !== "done");
  const idx = current ? stages.indexOf(current) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`AI progress: ${current ? COPY[current] : "starting"}`}>
      {visible.map((s, i) => {
        const done = status === "succeeded" || i < idx;
        const running = !done && i === idx && status !== "failed";
        const failed = status === "failed" && i === idx;
        return (
          <View key={s} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, done && styles.dotDone, failed && styles.dotFail]}>
                {done ? <CheckIcon size={12} color="#fff" strokeWidth={3} /> : running ? <Pulse /> : null}
              </View>
              {i < visible.length - 1 ? <View style={[styles.bar, done && styles.barDone]} /> : null}
            </View>
            <Text style={[styles.label, done && styles.labelDone, running && styles.labelRun, failed && styles.labelFail]}>
              {COPY[s]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", minHeight: 40 },
  rail: { width: 28, alignItems: "center" },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  dotFail: { borderColor: theme.colors.coral },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.orange },
  bar: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 2 },
  barDone: { backgroundColor: theme.colors.accent },
  label: { flex: 1, marginLeft: 10, fontSize: 14, color: theme.colors.faint, paddingTop: 1, lineHeight: 20 },
  labelDone: { color: theme.colors.muted },
  labelRun: { color: theme.colors.text, fontWeight: "600" },
  labelFail: { color: theme.colors.coral, fontWeight: "600" },
});
