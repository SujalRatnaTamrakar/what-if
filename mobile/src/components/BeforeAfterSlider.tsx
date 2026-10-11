/**
 * mobile/src/components/BeforeAfterSlider.tsx — draggable before/after
 * comparison (§7.5 S5/S6). Pan gesture drives a shared value on the UI
 * thread so the divider tracks the finger at 60fps. The AI-illustration chip
 * is always shown on the concept side (§7.5 Global).
 */
import React from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { Text } from "./Text";
import { AiLabel } from "./AiLabel";
import { theme } from "../theme";
import { ACCENT } from "./PrimaryButton";

interface Props {
  beforeUri: string;
  afterUri: string;
  /** width / height of the images (same aspect ratio per §5.8) */
  aspectRatio: number;
  beforeLabel?: string;
  afterLabel?: string;
  /** Rounded card corners (review) vs full-bleed (detail). */
  rounded?: boolean;
}

export function BeforeAfterSlider({
  beforeUri,
  afterUri,
  aspectRatio,
  beforeLabel = "Before (your photo)",
  afterLabel = "AI concept",
  rounded = false,
}: Props) {
  const width = useSharedValue(0);
  const x = useSharedValue(0);
  const ready = useSharedValue(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Keep the divider at the same fraction when the width changes.
    x.value = ready.value && width.value > 0 ? (x.value / width.value) * w : w / 2;
    width.value = w;
    ready.value = true;
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      x.value = Math.min(width.value * 0.97, Math.max(width.value * 0.03, e.x));
    })
    .onUpdate((e) => {
      x.value = Math.min(width.value * 0.97, Math.max(width.value * 0.03, e.x));
    });

  const fullWidthStyle = useAnimatedStyle(() => ({ width: width.value }));
  const clipStyle = useAnimatedStyle(() => ({ width: x.value }));
  const dividerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - 1.5 }],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - 19 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.frame, { aspectRatio }, rounded && styles.rounded]}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Before and after comparison slider. Drag to compare."
      >
        <Image
          source={{ uri: afterUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel={afterLabel}
        />
        <Animated.View style={[styles.clip, clipStyle]}>
          <Animated.View style={[styles.beforeImg, fullWidthStyle]}>
            <Image
              source={{ uri: beforeUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={beforeLabel}
            />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.divider, dividerStyle]} pointerEvents="none" />
        <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
          <Text style={styles.knobText}>‹ ›</Text>
        </Animated.View>
        <AiLabel style={styles.ai} />
        <View style={[styles.tag, styles.tagLeft]} pointerEvents="none">
          <Text style={styles.tagText}>{beforeLabel}</Text>
        </View>
        <View style={[styles.tag, styles.tagRight]} pointerEvents="none">
          <Text style={styles.tagText}>{afterLabel}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: theme.colors.border,
  },
  rounded: { borderRadius: theme.radius.l },
  clip: { position: "absolute", top: 0, bottom: 0, left: 0, overflow: "hidden" },
  // Same width as the frame so both images align; clipped by `clip`.
  beforeImg: { position: "absolute", top: 0, bottom: 0, left: 0 },
  divider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: "#fff",
  },
  knob: {
    position: "absolute",
    top: "50%",
    left: 0,
    marginTop: -19,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  knobText: { fontSize: 14, fontWeight: "700", color: ACCENT },
  ai: { position: "absolute", top: 12, right: 12 },
  tag: {
    position: "absolute",
    bottom: 12,
    backgroundColor: "rgba(20, 20, 20, 0.72)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagLeft: { left: 12 },
  tagRight: { right: 12 },
  tagText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
