/**
 * mobile/src/components/ProposalCard.tsx — mockup feed card (§7.5 S7).
 * White rounded card: BEFORE/AFTER images side-by-side on top ("Before"/
 * "After" dark labels bottom-left of each; "✨ AI illustration" pill
 * top-right of the after image). Below: bold title, location row,
 * supporters row; right side shows a bookmark (supported) or a green
 * "Support" pill (not supported).
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import type { Page, ProposalSummary } from "../api/types";
import { shadows, theme } from "../theme";
import { AiLabel } from "./AiLabel";
import { BookmarkIcon, PeopleIcon, PinIcon } from "./icons";

interface Props {
  item: ProposalSummary;
  onPress: () => void;
  feedScope?: "public" | "mine";
}

export function ProposalCard({ item, onPress, feedScope = "public" }: Props) {
  const qc = useQueryClient();
  const { isLoggedIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const supported = item.viewerHasSupported;

  const patchFeed = (mut: (s: ProposalSummary) => ProposalSummary) => {
    qc.setQueriesData<InfiniteData<Page<ProposalSummary>>>(
      { queryKey: ["feed", feedScope] },
      (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((pg) => ({
            ...pg,
            items: pg.items.map((it) => (it.id === item.id ? mut(it) : it)),
          })),
        };
      }
    );
  };

  const toggleSupport = async () => {
    if (!isLoggedIn) {
      router.push("/(tabs)/profile");
      return;
    }
    if (busy) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Optimistic flip.
    patchFeed((s) => ({
      ...s,
      viewerHasSupported: !s.viewerHasSupported,
      supportCount: s.supportCount + (s.viewerHasSupported ? -1 : 1),
    }));
    try {
      const r = supported
        ? await api.unsupport(item.id)
        : await api.support(item.id);
      patchFeed((s) => ({
        ...s,
        viewerHasSupported: r.viewerHasSupported,
        supportCount: r.supportCount,
      }));
    } catch {
      // Roll back on failure; the detail screen surfaces errors.
      qc.invalidateQueries({ queryKey: ["feed", feedScope] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.placeLabel}, ${item.supportCount} supporters`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.images}>
          <View style={styles.half}>
            <Image
              source={{ uri: item.sourceThumbUrl }}
              style={styles.img}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`Before photo for ${item.title}`}
            />
            <View style={styles.darkLabel}>
              <Text style={styles.darkLabelText}>Before</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.half}>
            <Image
              source={{ uri: item.conceptThumbUrl ?? item.sourceThumbUrl }}
              style={styles.img}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`AI concept for ${item.title}`}
            />
            <AiLabel style={styles.chip} />
            <View style={styles.darkLabel}>
              <Text style={styles.darkLabelText}>After</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.row}>
            <PinIcon size={15} color={theme.colors.muted} />
            <Text style={styles.place} numberOfLines={1}>
              {item.placeLabel}
            </Text>
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
          <Pressable
            onPress={toggleSupport}
            accessibilityRole="button"
            accessibilityLabel="Remove your support"
            hitSlop={8}
            style={styles.bookmarkBtn}
          >
            <BookmarkIcon size={22} color={theme.colors.accent} filled />
          </Pressable>
        ) : (
          <Pressable
            onPress={toggleSupport}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Support ${item.title}`}
            style={({ pressed }) => [
              styles.supportPill,
              (busy || pressed) && styles.busy,
            ]}
          >
            <Text style={styles.supportPillText}>Support</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: theme.spacing.l,
    ...shadows.card,
  },
  divider: { width: 2, backgroundColor: theme.colors.card },
  pressed: { opacity: 0.88 },
  images: { flexDirection: "row", height: 170 },
  half: { flex: 1, position: "relative" },
  img: { width: "100%", height: "100%" },
  darkLabel: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(20, 20, 20, 0.72)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  darkLabelText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  chip: { position: "absolute", top: 8, right: 8 },
  body: { paddingHorizontal: theme.spacing.l, paddingTop: theme.spacing.m },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 6,
  },
  row: { flexDirection: "row", alignItems: "center" },
  place: {
    fontSize: 13,
    color: theme.colors.muted,
    marginLeft: 5,
    flex: 1,
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.l,
    paddingTop: 8,
    paddingBottom: theme.spacing.m,
    minHeight: 56,
  },
  supporters: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.accent,
    marginLeft: 6,
  },
  bookmarkBtn: { padding: 6 },
  supportPill: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  supportPillText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  busy: { opacity: 0.6 },
});
