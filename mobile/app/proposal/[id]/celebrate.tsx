/**
 * mobile/app/proposal/[id]/celebrate.tsx — published! Confetti, the final
 * before/after, and the next moves: share it, view it, start another.
 */
import React, { useEffect } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { Text } from "../../../src/components/Text";
import { Display } from "../../../src/ui/Display";
import { Button } from "../../../src/ui/Button";
import { Confetti } from "../../../src/ui/Confetti";
import { BeforeAfterSlider } from "../../../src/components/BeforeAfterSlider";
import { CheckIcon, ShareIcon } from "../../../src/components/icons";
import { useProposal } from "../../../src/hooks/useProposal";
import { shadows, theme } from "../../../src/theme";

export default function Celebrate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: p } = useProposal(id);

  useEffect(() => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const share = () =>
    void Share.share({
      message: `What if? ${p?.title ?? "A neighborhood idea"} — ${p?.placeLabel ?? ""}. Support it on WhatIf.`,
    }).catch(() => {});

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <Confetti />
      <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.badge}>
        <CheckIcon size={34} color="#fff" strokeWidth={3} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.center}>
        <Display size={32} style={styles.title}>
          It's live.
        </Display>
        <Display size={20} italic color={theme.colors.accent} style={styles.sub}>
          Now rally your neighbors.
        </Display>
      </Animated.View>

      {p?.concept ? (
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.card}>
          <BeforeAfterSlider
            beforeUri={p.source.url}
            afterUri={p.concept.url}
            aspectRatio={p.source.width / p.source.height}
            beforeLabel="Before"
            afterLabel="After"
            rounded
            intro
          />
          <Text style={styles.cardTitle} numberOfLines={2}>
            {p.title}
          </Text>
        </Animated.View>
      ) : null}

      <View style={styles.actions}>
        <Button title="Share with neighbors" onPress={share} icon={(c) => <ShareIcon size={18} color={c} />} />
        <Button title="View proposal" variant="secondary" onPress={() => router.replace(`/proposal/${id}`)} />
        <Text onPress={() => router.replace("/(tabs)")} style={styles.link} accessibilityRole="button">
          Back to community
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", paddingHorizontal: 24 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lift,
  },
  center: { alignItems: "center" },
  title: { marginTop: 18, textAlign: "center" },
  sub: { marginTop: 4, textAlign: "center" },
  card: {
    width: "72%",
    maxWidth: 300,
    marginTop: 22,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 10,
    ...shadows.card,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text, marginTop: 10, marginHorizontal: 4 },
  actions: { width: "100%", maxWidth: 420, gap: 10, marginTop: "auto", paddingTop: 18 },
  link: { textAlign: "center", color: theme.colors.muted, fontWeight: "600", padding: 10 },
});
