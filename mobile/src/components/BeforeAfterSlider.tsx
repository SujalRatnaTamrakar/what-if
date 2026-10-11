/**
 * mobile/src/components/BeforeAfterSlider.tsx — draggable before/after
 * comparison (§7.5 S5/S6, reference mockups). Pan gesture drives a shared
 * value on the UI thread (60fps). `intro` plays a one-time sweep that teaches
 * the drag; long-press anywhere shows the full original ("hold to compare").
 * The AI-illustration chip is always on the concept side (§7.5 Global).
 */
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Text } from "./Text";
import { AiLabel } from "./AiLabel";
import { theme } from "../theme";

interface Props {
  /** Remote URL, or a bundled require() asset. */
  beforeUri: string | number | object;
  afterUri: string | number | object;
  /** width / height of the images (same aspect ratio per §5.8) */
  aspectRatio: number;
  beforeLabel?: string;
  afterLabel?: string;
  rounded?: boolean;
  intro?: boolean;
  /** Loop the sweep forever (decorative hero use). */
  autoplay?: boolean;
  showAiLabel?: boolean;
}

// require() yields a number on native and an object on web; pass those through.
const src = (s: string | number | object) => (typeof s === "string" ? { uri: s } : s) as never;

export function BeforeAfterSlider({
  beforeUri,
  afterUri,
  aspectRatio,
  beforeLabel = "Before (your photo)",
  afterLabel = "AI concept",
  rounded = false,
  intro = false,
  autoplay = false,
  showAiLabel = true,
}: Props) {
  const width = useSharedValue(0);
  const x = useSharedValue(0);
  const ready = useSharedValue(false);
  const [measured, setMeasured] = useState(0);
  const [holding, setHolding] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    x.value = ready.value && width.value > 0 ? (x.value / width.value) * w : w / 2;
    width.value = w;
    ready.value = true;
    setMeasured(w);
  };

  useEffect(() => {
    if (!measured || (!intro && !autoplay)) return;
    const w = measured;
    const ease = Easing.inOut(Easing.cubic);
    const sweep = () =>
      withSequence(
        withTiming(w * 0.82, { duration: 900, easing: ease }),
        withTiming(w * 0.18, { duration: 1100, easing: ease }),
        withTiming(w * 0.5, { duration: 800, easing: ease })
      );
    if (autoplay) {
      let alive = true;
      const loop = () => {
        if (!alive) return;
        x.value = withDelay(600, sweep());
      };
      loop();
      const t = setInterval(loop, 4200);
      return () => {
        alive = false;
        clearInterval(t);
      };
    }
    x.value = withDelay(450, sweep());
  }, [measured, intro, autoplay, x]);

  const clamp = (v: number) => {
    "worklet";
    return Math.min(width.value * 0.98, Math.max(width.value * 0.02, v));
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      x.value = clamp(e.x);
    })
    .onUpdate((e) => {
      x.value = clamp(e.x);
    });

  const hold = Gesture.LongPress()
    .minDuration(380)
    .maxDistance(8)
    .onStart(() => {
      runOnJS(setHolding)(true);
      if (Platform.OS !== "web") runOnJS(Haptics.selectionAsync)();
    })
    .onFinalize(() => {
      runOnJS(setHolding)(false);
    });

  const gesture = autoplay ? Gesture.Tap() : Gesture.Simultaneous(pan, hold);

  const fullWidthStyle = useAnimatedStyle(() => ({ width: width.value }));
  const clipStyle = useAnimatedStyle(() => ({ width: x.value }));
  const dividerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - 1.5 }] }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - 20 }] }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.frame, { aspectRatio }, rounded && styles.rounded]}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${beforeLabel} and ${afterLabel} comparison. Drag to compare, hold to see the original.`}
      >
        <Image source={src(afterUri)} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        <Animated.View style={[styles.clip, holding ? { width: "100%" } : clipStyle]}>
          <Animated.View style={[styles.beforeImg, fullWidthStyle]}>
            <Image source={src(beforeUri)} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          </Animated.View>
        </Animated.View>
        {!holding ? (
          <>
            <Animated.View style={[styles.divider, dividerStyle]} pointerEvents="none" />
            <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
              <Text style={styles.knobText}>‹ ›</Text>
            </Animated.View>
          </>
        ) : null}
        {showAiLabel && !holding ? <AiLabel style={styles.ai} /> : null}
        <View style={[styles.tag, styles.tagLeft]} pointerEvents="none">
          <Text style={styles.tagText}>{holding ? "Original photo" : beforeLabel}</Text>
        </View>
        {!holding ? (
          <View style={[styles.tag, styles.tagRight]} pointerEvents="none">
            <Text style={styles.tagText}>{afterLabel}</Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", overflow: "hidden", backgroundColor: theme.colors.paperDeep },
  rounded: { borderRadius: theme.radius.xl },
  clip: { position: "absolute", top: 0, bottom: 0, left: 0, overflow: "hidden" },
  beforeImg: { position: "absolute", top: 0, bottom: 0, left: 0 },
  divider: { position: "absolute", top: 0, bottom: 0, left: 0, width: 3, backgroundColor: "#fff" },
  knob: {
    position: "absolute",
    top: "50%",
    left: 0,
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  knobText: { fontSize: 15, fontWeight: "700", color: theme.colors.accent, marginTop: -1 },
  ai: { position: "absolute", top: 12, right: 12 },
  tag: {
    position: "absolute",
    bottom: 12,
    backgroundColor: "rgba(20, 20, 20, 0.68)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagLeft: { left: 12 },
  tagRight: { right: 12 },
  tagText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
