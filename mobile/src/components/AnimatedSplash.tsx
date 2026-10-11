/**
 * mobile/src/components/AnimatedSplash.tsx — brand overlay that continues the
 * native splash (same image/background) with a short settle + fade, so the
 * hand-off into the app doesn't flash.
 */
import React, { useEffect, useState } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const BG = "#f6f1e7";

export function AnimatedSplash({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!ready) return;
    scale.value = withSequence(
      withTiming(1.06, { duration: 350, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 250 })
    );
    opacity.value = withDelay(
      600,
      withTiming(0, { duration: 350 }, (done) => {
        if (done) runOnJS(setGone)(true);
      })
    );
    // Fallback: never let the overlay block the app if an animation
    // callback doesn't fire (e.g. backgrounded or throttled frames).
    const t = setTimeout(() => setGone(true), 1600);
    return () => clearTimeout(t);
  }, [ready, opacity, scale]);

  const wrap = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (gone) return null;
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.wrap, wrap]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={logo}>
        <Image
          source={require("../../assets/splash-icon.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="WhatIf"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: BG, alignItems: "center", justifyContent: "center", zIndex: 1000 },
  logo: { width: 240, height: 240 },
});
