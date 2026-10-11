/**
 * mobile/src/components/ScanningPhoto.tsx — the photo under an animated AI
 * "scan": a glowing sweep line, viewfinder corners and a status pill. Used
 * while the scene is analyzed and while a concept renders.
 */
import React, { useEffect } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Text } from "./Text";
import { SparkleIcon } from "./icons";
import { theme } from "../theme";

interface Props {
  uri: string;
  aspectRatio: number;
  label: string;
  active?: boolean;
  tint?: "green" | "sun";
  children?: React.ReactNode;
}

export function ScanningPhoto({ uri, aspectRatio, label, active = true, tint = "green", children }: Props) {
  const h = useSharedValue(0);
  const t = useSharedValue(0);
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    if (!active) return;
    t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [active, t, pulse]);

  const line = useAnimatedStyle(() => ({ transform: [{ translateY: t.value * h.value - 60 }] }));
  const pill = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const glow = tint === "sun" ? "232,163,61" : "127,214,170";

  return (
    <View
      style={[styles.frame, { aspectRatio }]}
      onLayout={(e: LayoutChangeEvent) => (h.value = e.nativeEvent.layout.height)}
      accessible
      accessibilityLabel={label}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      {children}
      {active ? (
        <>
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
          <Animated.View style={[styles.sweep, line]} pointerEvents="none">
            <LinearGradient
              colors={[`rgba(${glow},0)`, `rgba(${glow},0.35)`, `rgba(${glow},0)`]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.line, { backgroundColor: `rgb(${glow})` }]} />
          </Animated.View>
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c]]} />
          ))}
          <Animated.View style={[styles.pill, pill]}>
            <SparkleIcon size={14} color="#fff" />
            <Text style={styles.pillText}>{label}</Text>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const C = 26;
const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: theme.radius.xl, overflow: "hidden", backgroundColor: theme.colors.paperDeep, maxHeight: 460 },
  dim: { backgroundColor: "rgba(10,30,20,0.18)" },
  sweep: { position: "absolute", left: 0, right: 0, top: 0, height: 120, justifyContent: "center" },
  line: { height: 2, opacity: 0.9 },
  corner: { position: "absolute", width: C, height: C, borderColor: "#fff" },
  tl: { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 14, right: 14, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  pill: {
    position: "absolute",
    bottom: 22,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.scrim,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
