/**
 * web/src/components/ProposalCard.tsx — feed card (§7.5 S7).
 * White rounded card: BEFORE/AFTER images side-by-side on top ("Before"/
 * "After" dark labels bottom-left of each; "AI illustration" pill
 * top-right of the after image). Below: bold title, location row,
 * supporters row; right side shows a bookmark (supported) or a green
 * "Support" pill (not supported).
 */
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { Img, Pressable, Text, View, styleSheet, type StyleInput } from "../ui/primitives";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { useRouter } from "../lib/nav";
import type { Page, ProposalSummary } from "../api/types";
import { shadows, theme } from "../theme";
import { AiLabel } from "./AiLabel";
import { BookmarkIcon, PeopleIcon, PinIcon } from "./icons";

interface Props {
  item: ProposalSummary;
  onPress: () => void;
  feedScope?: "public" | "mine";
  distanceLabel?: string | null;
  index?: number;
  style?: StyleInput;
}

export function ProposalCard({ item, onPress, feedScope = "public", distanceLabel, index = 0, style }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(0);
  const supported = item.viewerHasSupported;

  const patchFeed = (mut: (s: ProposalSummary) => ProposalSummary) => {
    qc.setQueriesData<InfiniteData<Page<ProposalSummary>>>({ queryKey: ["feed", feedScope] }, (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((pg) => ({
          ...pg,
          items: pg.items.map((it) => (it.id === item.id ? mut(it) : it)),
        })),
      };
    });
  };

  const toggleSupport = async () => {
    if (!isLoggedIn) {
      router.push("/profile");
      return;
    }
    if (busy) return;
    setBusy(true);
    setPop((n) => n + 1);
    // Optimistic flip.
    patchFeed((s) => ({
      ...s,
      viewerHasSupported: !s.viewerHasSupported,
      supportCount: s.supportCount + (s.viewerHasSupported ? -1 : 1),
    }));
    try {
      const r = supported ? await api.unsupport(item.id) : await api.support(item.id);
      patchFeed((s) => ({ ...s, viewerHasSupported: r.viewerHasSupported, supportCount: r.supportCount }));
    } catch {
      // Roll back on failure; the detail screen surfaces errors.
      qc.invalidateQueries({ queryKey: ["feed", feedScope] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      className="anim-fade-in-down"
      style={[styles.card, { animationDelay: `${Math.min(index, 6) * 70}ms` }, style]}
    >
      <Pressable
        onPress={onPress}
        label={`${item.title}, ${item.placeLabel}, ${item.supportCount} supporters`}
        feedback="soft"
        style={{ width: "100%" }}
      >
        <View style={styles.images}>
          <View style={styles.half}>
            <Img src={item.sourceThumbUrl} transition={200} alt={`Before photo for ${item.title}`} />
            <View style={styles.darkLabel}>
              <Text style={styles.darkLabelText}>Before</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.half}>
            <Img src={item.conceptThumbUrl ?? item.sourceThumbUrl} transition={200} alt={`AI concept for ${item.title}`} />
            <AiLabel style={styles.chip} />
            <View style={styles.darkLabel}>
              <Text style={styles.darkLabelText}>After</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} lines={2}>
            {item.title}
          </Text>
          <View style={styles.row}>
            <PinIcon size={15} color={theme.colors.muted} />
            <Text style={styles.place} lines={1}>
              {item.placeLabel}
            </Text>
            {distanceLabel ? <Text style={styles.distance}>· {distanceLabel}</Text> : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.supportRow}>
        <View style={styles.row}>
          <PeopleIcon size={16} color={theme.colors.accent} />
          <Text style={styles.supporters}>
            {item.supportCount} supporter{item.supportCount === 1 ? "" : "s"}
          </Text>
        </View>
        {supported ? (
          <Pressable onPress={toggleSupport} label="Remove your support" feedback="opacity" style={styles.bookmarkBtn}>
            <View key={pop} className={pop ? "anim-pop" : undefined}>
              <BookmarkIcon size={22} color={theme.colors.accent} filled />
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={toggleSupport}
            disabled={busy}
            label={`Support ${item.title}`}
            feedback="scale"
            style={[styles.supportPill, busy && styles.busy]}
          >
            <Text style={styles.supportPillText}>Support</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = styleSheet({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: theme.spacing.l,
    ...shadows.card,
  },
  divider: { width: 2, backgroundColor: theme.colors.card },
  images: { flexDirection: "row", height: 184, width: "100%" },
  half: { flex: 1, position: "relative", overflow: "hidden" },
  darkLabel: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(20, 20, 20, 0.72)",
    borderRadius: 999,
    padding: "4px 9px",
  },
  darkLabelText: { color: "#fff", fontSize: 11, fontWeight: 700 },
  chip: { position: "absolute", top: 8, right: 8 },
  body: { paddingLeft: theme.spacing.l, paddingRight: theme.spacing.l, paddingTop: theme.spacing.m },
  title: { fontSize: 18, fontWeight: 700, color: theme.colors.text, marginBottom: 6, lineHeight: "24px" },
  row: { flexDirection: "row", alignItems: "center", minWidth: 0 },
  distance: { fontSize: 13, color: theme.colors.accent, fontWeight: 600, marginLeft: 4, whiteSpace: "nowrap" },
  place: { fontSize: 13, color: theme.colors.muted, marginLeft: 5, flexShrink: 1 },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: theme.spacing.l,
    paddingRight: theme.spacing.l,
    paddingTop: 8,
    paddingBottom: theme.spacing.m,
    minHeight: 56,
  },
  supporters: { fontSize: 14, fontWeight: 700, color: theme.colors.accent, marginLeft: 6 },
  bookmarkBtn: { padding: 6, borderRadius: 999 },
  supportPill: { backgroundColor: theme.colors.accent, borderRadius: 999, padding: "10px 22px" },
  supportPillText: { color: "#fff", fontSize: 14, fontWeight: 700 },
  busy: { opacity: 0.6 },
});
