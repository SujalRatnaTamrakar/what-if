/**
 * mobile/src/components/MaskCanvas.tsx — brush canvas for S3 (§5.7, §7.5).
 *
 * Shows the sanitized source image (contentFit="contain") and lets the user
 * paint/erase strokes. Points are normalized to the IMAGE CONTENT RECT
 * (not the view, not letterbox padding); touches outside the image are
 * ignored. Strokes render as a semi-transparent SVG overlay with round caps.
 *
 * Limits per §5.7: ≤200 strokes, ≤5000 points total.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Path } from "react-native-svg";
import type { MaskStroke, MaskStrokes } from "../api/types";

const MAX_STROKES = 200;
const MAX_POINTS = 5000;
const PAINT_COLOR = "rgba(232, 163, 61, 0.55)";
const ERASE_COLOR = "rgba(31, 41, 51, 0.55)";

interface Props {
  imageUrl: string;
  /** source asset pixel size (for aspect ratio) */
  imageWidth: number;
  imageHeight: number;
  strokes: MaskStrokes;
  onStrokesChange: (s: MaskStrokes) => void;
  mode: "paint" | "erase";
  /** brush diameter as a fraction of image width */
  brushWidth: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function totalPoints(strokes: MaskStroke[]): number {
  return strokes.reduce((n, s) => n + s.points.length, 0);
}

export function MaskCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  strokes,
  onStrokesChange,
  mode,
  brushWidth,
}: Props) {
  const [view, setView] = useState<{ w: number; h: number } | null>(null);

  // Refs mirror the latest props so gesture callbacks (JS thread) stay fresh.
  const strokesRef = useRef(strokes);
  const onChangeRef = useRef(onStrokesChange);
  const modeRef = useRef(mode);
  const brushRef = useRef(brushWidth);
  const activeRef = useRef(false);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  useEffect(() => {
    onChangeRef.current = onStrokesChange;
  }, [onStrokesChange]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    brushRef.current = brushWidth;
  }, [brushWidth]);

  /** Exact image content rect inside the view for contentFit="contain". */
  const rect: Rect | null = useMemo(() => {
    if (!view || imageWidth <= 0 || imageHeight <= 0) return null;
    const scale = Math.min(view.w / imageWidth, view.h / imageHeight);
    const w = imageWidth * scale;
    const h = imageHeight * scale;
    return { x: (view.w - w) / 2, y: (view.h - h) / 2, w, h };
  }, [view, imageWidth, imageHeight]);
  const rectRef = useRef<Rect | null>(null);
  useEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  /** Touch → normalized coords, or null when outside the image. */
  const toNorm = (x: number, y: number): [number, number] | null => {
    const r = rectRef.current;
    if (!r || r.w <= 0 || r.h <= 0) return null;
    const nx = (x - r.x) / r.w;
    const ny = (y - r.y) / r.h;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
    return [nx, ny];
  };

  const beginStroke = (x: number, y: number) => {
    const p = toNorm(x, y);
    if (!p) return; // touches outside the image are ignored (§5.7)
    const cur = strokesRef.current;
    if (cur.strokes.length >= MAX_STROKES) return;
    activeRef.current = true;
    const next: MaskStrokes = {
      version: 1,
      strokes: [
        ...cur.strokes,
        { mode: modeRef.current, width: brushRef.current, points: [p] },
      ],
    };
    strokesRef.current = next;
    onChangeRef.current(next);
  };

  const extendStroke = (x: number, y: number) => {
    if (!activeRef.current) return;
    const r = rectRef.current;
    if (!r) return;
    // Clamp: the outside portion of a drag is ignored.
    const nx = Math.min(1, Math.max(0, (x - r.x) / r.w));
    const ny = Math.min(1, Math.max(0, (y - r.y) / r.h));
    const cur = strokesRef.current;
    if (cur.strokes.length === 0) return;
    if (totalPoints(cur.strokes) >= MAX_POINTS) return;
    const last = cur.strokes[cur.strokes.length - 1];
    const next: MaskStrokes = {
      version: 1,
      strokes: [
        ...cur.strokes.slice(0, -1),
        { ...last, points: [...last.points, [nx, ny]] },
      ],
    };
    strokesRef.current = next;
    onChangeRef.current(next);
  };

  const endStroke = () => {
    activeRef.current = false;
  };

  const pan = Gesture.Pan()
    .onBegin((e) => beginStroke(e.x, e.y))
    .onUpdate((e) => extendStroke(e.x, e.y))
    .onEnd(() => endStroke())
    .onFinalize(() => endStroke());

  const paths = useMemo(() => {
    const r = rect;
    if (!r) return [];
    return strokes.strokes.map((s, i) => {
      const pts = s.points.map(
        ([nx, ny]) => [r.x + nx * r.w, r.y + ny * r.h] as const
      );
      const widthPx = Math.max(2, s.width * r.w);
      const color = s.mode === "paint" ? PAINT_COLOR : ERASE_COLOR;
      if (pts.length === 1) {
        const [cx, cy] = pts[0];
        return (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={widthPx / 2}
            fill={color}
          />
        );
      }
      const d =
        "M " + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");
      return (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={widthPx}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    });
  }, [strokes, rect]);

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.container}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setView({ w: width, h: height });
        }}
        accessibilityRole="image"
        accessibilityLabel="Brush the area to change"
      >
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessibilityLabel="Photo to edit"
        />
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {paths}
        </Svg>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
});
