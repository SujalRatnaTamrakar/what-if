/**
 * web/src/ui/StepProgress.tsx — the 5-step create journey indicator
 * (Photo → Idea → Brush → Imagine → Publish). Animated fill on the current step.
 */
import React from "react";
import { COLUMN, Text, View, styleSheet } from "./primitives";
import { theme } from "../theme";

export const STEPS = ["Photo", "Idea", "Brush", "Imagine", "Publish"] as const;

export function StepProgress({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <View style={styles.wrap} role="group" aria-label={`Step ${step} of 5: ${STEPS[step - 1]}`}>
      <View style={styles.bars}>
        {STEPS.map((s, i) => {
          const idx = i + 1;
          return (
            <View key={s} style={styles.track}>
              {idx < step ? <View style={[styles.fill, { width: "100%" }]} /> : null}
              {idx === step ? <View key={step} style={[styles.fill, { animation: "wi-fill 650ms ease-in-out both" }]} /> : null}
            </View>
          );
        })}
      </View>
      <Text style={styles.caption}>
        Step {step} of 5 · <Text style={styles.captionStrong}>{STEPS[step - 1]}</Text>
      </Text>
    </View>
  );
}

const styles = styleSheet({
  wrap: { paddingLeft: 20, paddingRight: 20, paddingBottom: 10, width: "100%", maxWidth: COLUMN, alignSelf: "center" },
  bars: { flexDirection: "row", gap: 6 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2, backgroundColor: theme.colors.accent },
  caption: { marginTop: 8, fontSize: 12, color: theme.colors.muted, letterSpacing: 0.3 },
  captionStrong: { color: theme.colors.accent, fontWeight: 600 },
});
