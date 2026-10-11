/**
 * mobile/src/components/Skeleton.tsx — pulsing placeholder shown while the
 * feed loads (replaces a bare spinner so layout doesn't jump).
 */
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { shadows, theme } from "../theme";

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.block, anim, style]} />;
}

export function ProposalCardSkeleton() {
  return (
    <View style={styles.card} accessibilityLabel="Loading proposal" accessible>
      <SkeletonBlock style={{ height: 170, borderRadius: 0 }} />
      <View style={{ padding: theme.spacing.l }}>
        <SkeletonBlock style={{ height: 18, width: "80%" }} />
        <SkeletonBlock style={{ height: 14, width: "55%", marginTop: 10 }} />
        <SkeletonBlock style={{ height: 14, width: "35%", marginTop: 14 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: "#E9E3D4", borderRadius: 8 },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: theme.spacing.l,
    ...shadows.card,
  },
});
