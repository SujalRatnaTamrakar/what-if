/**
 * mobile/src/components/FlagList.tsx — the AI reviewer's verdict (§7.5 S5).
 * Verdict header (Clear / Needs review / Blocked), "% untouched" honesty
 * stat, then each flag with severity; warnings need an "I've seen this"
 * acknowledgement, blocking/info flags are display-only.
 */
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "./Text";
import { AlertIcon, CheckIcon, ShieldIcon } from "./icons";
import type { Review, ReviewFlag } from "../api/types";
import { theme } from "../theme";

interface Props {
  review: Review;
  acknowledged: string[];
  onToggle: (flagId: string) => void;
}

const SEV: Record<ReviewFlag["severity"], { label: string; bg: string; fg: string }> = {
  info: { label: "Note", bg: theme.colors.infoSoft, fg: theme.colors.info },
  warning: { label: "Needs a look", bg: theme.colors.warningSoft, fg: theme.colors.warning },
  blocking: { label: "Blocking", bg: theme.colors.coralSoft, fg: theme.colors.coral },
};

const VERDICT = {
  clear: { title: "Looks good", sub: "The AI reviewer found no problems.", bg: theme.colors.accentSoft, fg: theme.colors.accent },
  needs_review: { title: "Needs your review", sub: "Check each note below before publishing.", bg: theme.colors.warningSoft, fg: theme.colors.warning },
  blocked: { title: "Can't be published", sub: "Regenerate or adjust the brushed area.", bg: theme.colors.coralSoft, fg: theme.colors.coral },
} as const;

export function FlagList({ review, acknowledged, onToggle }: Props) {
  const v = VERDICT[review.verdict];
  const untouched = Math.max(0, Math.min(100, 100 - review.outsideMaskChange * 100));
  return (
    <View style={styles.card}>
      <View style={[styles.verdict, { backgroundColor: v.bg }]}>
        {review.verdict === "clear" ? <ShieldIcon size={24} color={v.fg} /> : <AlertIcon size={24} color={v.fg} />}
        <View style={{ flex: 1 }}>
          <Text style={[styles.vTitle, { color: v.fg }]}>{v.title}</Text>
          <Text style={styles.vSub}>{v.sub}</Text>
        </View>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statBig}>{untouched.toFixed(1)}%</Text>
        <Text style={styles.statText}>of your photo outside the brush is unchanged</Text>
      </View>
      {review.flags.map((f) => {
        const s = SEV[f.severity];
        const isWarning = f.severity === "warning";
        const acked = acknowledged.includes(f.id);
        return (
          <View key={f.id} style={styles.flag}>
            <View style={styles.flagTop}>
              <View style={[styles.badge, { backgroundColor: s.bg }]}>
                <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
              </View>
            </View>
            <Text style={styles.msg}>{f.message}</Text>
            {isWarning ? (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
                  onToggle(f.id);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acked }}
                accessibilityLabel={`I've seen this: ${f.message}`}
                style={styles.ack}
              >
                <View style={[styles.box, acked && styles.boxOn]}>{acked ? <CheckIcon size={14} color="#fff" strokeWidth={3} /> : null}</View>
                <Text style={[styles.ackText, acked && { color: theme.colors.accent }]}>I've seen this</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Text style={styles.by}>
        Reviewed by {review.provider} · {review.model}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, padding: 14, gap: 10 },
  verdict: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: theme.radius.l, padding: 14 },
  vTitle: { fontSize: 16, fontWeight: "700" },
  vSub: { fontSize: 13, color: theme.colors.muted, marginTop: 1 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 },
  statBig: { fontSize: 20, fontWeight: "700", color: theme.colors.accent },
  statText: { flex: 1, fontSize: 13, color: theme.colors.muted, lineHeight: 18 },
  flag: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: 10, paddingHorizontal: 4 },
  flagTop: { flexDirection: "row" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  msg: { fontSize: 15, color: theme.colors.text, marginTop: 6, lineHeight: 21 },
  ack: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, marginTop: 2 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: theme.colors.faint, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  ackText: { fontSize: 14, fontWeight: "600", color: theme.colors.muted },
  by: { fontSize: 11, color: theme.colors.faint, textAlign: "right", paddingHorizontal: 4 },
});
