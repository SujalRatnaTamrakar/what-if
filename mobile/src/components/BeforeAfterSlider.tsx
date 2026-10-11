/**
 * mobile/src/components/BeforeAfterSlider.tsx — draggable before/after
 * comparison (§7.5 S5/S6). Slider mode (draggable divider) + side-by-side
 * toggle. Labels: "Before (your photo)" / "AI concept".
 */
import React, { useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { theme } from "../theme";
import { ACCENT } from "./PrimaryButton";

interface Props {
  beforeUri: string;
  afterUri: string;
  /** width / height of the images (same aspect ratio per §5.8) */
  aspectRatio: number;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterSlider({
  beforeUri,
  afterUri,
  aspectRatio,
  beforeLabel = "Before (your photo)",
  afterLabel = "AI concept",
}: Props) {
  const [mode, setMode] = useState<"slider" | "side">("slider");
  const [divider, setDivider] = useState(0.5);
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const setFromX = (x: number) => {
    if (width <= 0) return;
    setDivider(Math.min(0.97, Math.max(0.03, x / width)));
  };

  return (
    <View>
      <View style={styles.toggleRow} accessibilityRole="tablist">
        <Pressable
          onPress={() => setMode("slider")}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === "slider" }}
          style={[styles.toggle, mode === "slider" && styles.toggleActive]}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "slider" && styles.toggleTextActive,
            ]}
          >
            Slider
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("side")}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === "side" }}
          style={[styles.toggle, mode === "side" && styles.toggleActive]}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "side" && styles.toggleTextActive,
            ]}
          >
            Side by side
          </Text>
        </Pressable>
      </View>

      {mode === "slider" ? (
        <View
          style={[styles.frame, { aspectRatio }]}
          onLayout={onLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => setFromX(e.nativeEvent.locationX)}
          onResponderMove={(e) => setFromX(e.nativeEvent.locationX)}
          accessibilityRole="adjustable"
          accessibilityLabel="Before and after comparison slider. Drag to compare."
          accessibilityValue={{ now: Math.round(divider * 100), min: 0, max: 100 }}
        >
          <Image
            source={{ uri: afterUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel={afterLabel}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { width: width * divider, overflow: "hidden" },
            ]}
          >
            {width > 0 && (
              <Image
                source={{ uri: beforeUri }}
                style={{ width, aspectRatio }}
                contentFit="cover"
                accessibilityLabel={beforeLabel}
              />
            )}
          </View>
          <View style={[styles.divider, { left: width * divider }]} />
          <View style={[styles.knob, { left: width * divider }]}>
            <Text style={styles.knobText}>‹ ›</Text>
          </View>
          <View style={[styles.tag, styles.tagTopLeft]}>
            <Text style={styles.tagText}>{beforeLabel}</Text>
          </View>
          <View style={[styles.tag, styles.tagTopRight]}>
            <Text style={styles.tagText}>{afterLabel}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.frame, { aspectRatio }]}>
          <View style={styles.sideRow}>
            <View style={styles.sideHalf}>
              <Image
                source={{ uri: beforeUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityLabel={beforeLabel}
              />
              <View style={[styles.tag, styles.tagBottomLeft]}>
                <Text style={styles.tagText}>{beforeLabel}</Text>
              </View>
            </View>
            <View style={styles.sideHalf}>
              <Image
                source={{ uri: afterUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityLabel={afterLabel}
              />
              <View style={[styles.tag, styles.tagBottomRight]}>
                <Text style={styles.tagText}>{afterLabel}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    padding: 3,
    marginBottom: theme.spacing.s,
    alignSelf: "flex-start",
  },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
  },
  toggleActive: { backgroundColor: theme.colors.card },
  toggleText: { fontSize: 13, fontWeight: "600", color: theme.colors.muted },
  toggleTextActive: { color: ACCENT },
  frame: {
    width: "100%",
    borderRadius: theme.radius.m,
    overflow: "hidden",
    backgroundColor: theme.colors.border,
  },
  divider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 3,
    marginLeft: -1.5,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  knob: {
    position: "absolute",
    top: "50%",
    marginTop: -19,
    marginLeft: -19,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  knobText: { fontSize: 16, fontWeight: "800", color: ACCENT },
  tag: {
    position: "absolute",
    backgroundColor: "rgba(20, 20, 20, 0.72)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagTopLeft: { top: 10, left: 10 },
  tagTopRight: { top: 10, right: 10 },
  tagBottomLeft: { bottom: 10, left: 10 },
  tagBottomRight: { bottom: 10, right: 10 },
  tagText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  sideRow: { flex: 1, flexDirection: "row" },
  sideHalf: { flex: 1, overflow: "hidden" },
});
