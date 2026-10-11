/**
 * mobile/src/ui/Confetti.tsx — lightweight celebratory burst (Reanimated,
 * no dependency). Plays once on mount.
 */
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../theme";

const COLORS = [theme.colors.accent, theme.colors.orange, "#7FB89A", theme.colors.coral, "#F3D08A"];

function Piece({ i, w, h }: { i: number; w: number; h: number }) {
  const t = useSharedValue(0);
  const cfg = useMemo(() => {
    const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.4;
    const dist = 120 + Math.random() * Math.min(w, 420) * 0.45;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 80,
      fall: h * 0.35 + Math.random() * 120,
      rot: (Math.random() - 0.5) * 900,
      color: COLORS[i % COLORS.length],
      size: 7 + Math.random() * 7,
      round: i % 3 === 0,
      delay: Math.random() * 120,
    };
  }, [i, w, h]);

  useEffect(() => {
    t.value = withDelay(cfg.delay, withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }));
  }, [t, cfg.delay]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, t.value - 0.7) / 0.3,
    transform: [
      { translateX: cfg.dx * t.value },
      { translateY: cfg.dy * t.value + cfg.fall * t.value * t.value },
      { rotate: `${cfg.rot * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { width: cfg.size, height: cfg.round ? cfg.size : cfg.size * 1.6, backgroundColor: cfg.color, borderRadius: cfg.round ? cfg.size : 2 },
        style,
      ]}
    />
  );
}

export function Confetti() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.origin]}>
      {Array.from({ length: 28 }, (_, i) => (
        <Piece key={i} i={i} w={width} h={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { alignItems: "center", justifyContent: "center" },
  piece: { position: "absolute" },
});
