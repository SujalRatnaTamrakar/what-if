/**
 * mobile/app/onboarding.tsx — first-launch story (3 pages): imagine with a
 * live before/after made by WhatIf's own pipeline, brush the change, rally
 * neighbors. Skippable; reopenable from Profile → "How WhatIf works".
 */
import React, { useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { Text } from "../src/components/Text";
import { Display } from "../src/ui/Display";
import { Button } from "../src/ui/Button";
import { BeforeAfterSlider } from "../src/components/BeforeAfterSlider";
import { PeopleIcon, DownloadIcon, SproutIcon } from "../src/components/icons";
import { markOnboardingSeen } from "../src/lib/onboarding";
import { shadows, theme } from "../src/theme";

const BEFORE = require("../assets/demo/before.jpg");
const AFTER = require("../assets/demo/after.jpg");

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const pageW = Math.min(width, 520);

  const finish = async () => {
    await markOnboardingSeen();
    router.replace("/(tabs)");
  };

  const next = () => {
    if (page >= 2) return void finish();
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const art = pageW - 64;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <SproutIcon size={28} />
          <Text style={styles.brandText}>
            <Text style={{ color: theme.colors.accent }}>What</Text>
            <Text style={{ color: theme.colors.orange }}>If</Text>
          </Text>
        </View>
        {page < 2 ? (
          <Text onPress={finish} style={styles.skip} accessibilityRole="button">
            Skip
          </Text>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {/* 1 — Imagine */}
        <View style={[styles.page, { width }]}>
          <View style={[styles.artCard, { width: art }]}>
            <BeforeAfterSlider
              beforeUri={BEFORE}
              afterUri={AFTER}
              aspectRatio={493 / 659}
              beforeLabel="Today"
              afterLabel="What if…"
              rounded
              autoplay
            />
          </View>
          <Display size={34} italic style={styles.title}>
            What if this corner had shade?
          </Display>
          <Text style={styles.body}>
            Snap a photo of a place you care about. WhatIf's AI imagines a small, realistic improvement — right in your photo.
          </Text>
        </View>

        {/* 2 — Brush */}
        <View style={[styles.page, { width }]}>
          <View style={[styles.artCard, { width: art, aspectRatio: 493 / 659 }]}>
            <Image source={BEFORE} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 140" preserveAspectRatio="none">
              <Path
                d="M8 36 C 25 28, 50 26, 72 32"
                stroke="rgba(232,163,61,0.62)"
                strokeWidth={14}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
            <View style={styles.brushTag}>
              <Text style={styles.brushTagText}>Brush the change</Text>
            </View>
          </View>
          <Display size={34} style={styles.title}>
            You decide where.
          </Display>
          <Text style={styles.body}>
            Brush exactly the area to change. Everything outside your brush stays as it is — and an AI reviewer checks the result for you.
          </Text>
        </View>

        {/* 3 — Rally */}
        <View style={[styles.page, { width }]}>
          <Animated.View entering={FadeIn} style={[styles.rally, { width: art }]}>
            <View style={styles.rallyRow}>
              <View style={[styles.rallyIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <PeopleIcon size={26} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rallyTitle}>Neighbors support it</Text>
                <Text style={styles.rallySub}>One tap. Counts are honest — no double votes.</Text>
              </View>
            </View>
            <View style={styles.rallyDivider} />
            <View style={styles.rallyRow}>
              <View style={[styles.rallyIcon, { backgroundColor: theme.colors.orangeSoft }]}>
                <DownloadIcon size={24} color={theme.colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rallyTitle}>Download a request packet</Text>
                <Text style={styles.rallySub}>A tidy PDF with the before/after and your request, ready for the city.</Text>
              </View>
            </View>
          </Animated.View>
          <Display size={34} style={styles.title}>
            Small changes, rallied together.
          </Display>
          <Text style={styles.body}>
            AI images are illustrations, not engineering designs — always labeled, always yours to approve.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, page === i && styles.dotOn]} />
          ))}
        </View>
        <Button title={page === 2 ? "Get started" : "Next"} onPress={next} style={styles.cta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, height: 44 },
  brand: { flexDirection: "row", alignItems: "center" },
  brandText: { fontSize: 22, fontWeight: "700", marginLeft: 6, letterSpacing: -0.4 },
  skip: { fontSize: 15, color: theme.colors.muted, fontWeight: "600", padding: 8 },
  pager: { flex: 1 },
  page: { alignItems: "center", paddingHorizontal: 32, paddingTop: 12 },
  artCard: {
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    maxHeight: 400,
    backgroundColor: theme.colors.paperDeep,
    ...shadows.lift,
  },
  title: { textAlign: "center", marginTop: 26, maxWidth: 420 },
  body: { fontSize: 15, lineHeight: 23, color: theme.colors.muted, textAlign: "center", marginTop: 12, maxWidth: 400 },
  brushTag: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  brushTagText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  rally: { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, padding: 20, ...shadows.card },
  rallyRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  rallyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rallyTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  rallySub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, lineHeight: 19 },
  rallyDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  footer: { paddingHorizontal: 24, alignItems: "center" },
  dots: { flexDirection: "row", gap: 8, marginBottom: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.border },
  dotOn: { width: 24, backgroundColor: theme.colors.accent },
  cta: { alignSelf: "stretch", maxWidth: 480, width: "100%" },
});
