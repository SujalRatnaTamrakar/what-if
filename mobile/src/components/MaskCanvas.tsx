/**
 * mobile/src/components/MaskCanvas.tsx — brush canvas for S3 (§5.7, §7.5).
 *
 * Shows the sanitized source image (contentFit="contain") and lets the user
 * paint/erase strokes. Points are normalized to the IMAGE CONTENT RECT
 * (not the view, not letterbox padding); touches outside the image are
 * ignored. Strokes render as a semi-transparent SVG overlay with round caps.
 *
 * Performance: the stroke being drawn lives in a ref and only this canvas
 * re-renders while you drag (at most once per frame); the parent gets ONE
 * onStrokesChange when the finger lifts. Gesture callbacks run on the JS
 * thread (runOnJS) because they touch refs and React state.
 *
 * Limits per §5.7: ≤200 strokes, ≤5000 points total.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Defs, Mask, Path, Rect as SvgRect } from "react-native-svg";
import type { MaskStroke, MaskStrokes } from "../api/types";

const MAX_STROKES = 200;
const MAX_POINTS = 5000;
/** Skip points closer than this (fraction of image width) — keeps strokes light. */
const MIN_STEP = 0.004;
const PAINT_COLOR = "rgb(240, 160, 40)";
const PAINT_OPACITY = 0.58;

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
  /** Hide the brush overlay to look at the bare photo. */
  overlayVisible?: boolean;
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

function strokeElement(s: MaskStroke, r: Rect, key: string | number) {
  const widthPx = Math.max(2, s.width * r.w);
  // Drawn inside the SVG mask: white reveals paint, black removes it.
  const color = s.mode === "paint" ? "#fff" : "#000";
  if (s.points.length === 1) {
    const [nx, ny] = s.points[0];
    return <Circle key={key} cx={r.x + nx * r.w} cy={r.y + ny * r.h} r={widthPx / 2} fill={color} />;
  }
  let d = "";
  for (let i = 0; i < s.points.length; i++) {
    const [nx, ny] = s.points[i];
    d += `${i === 0 ? "M" : " L"} ${(r.x + nx * r.w).toFixed(1)} ${(r.y + ny * r.h).toFixed(1)}`;
  }
  return (
    <Path
      key={key}
      d={d}
      stroke={color}
      strokeWidth={widthPx}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

/** Finished strokes; only re-renders when the committed list changes. */
const CommittedStrokes = memo(function CommittedStrokes({ strokes, rect }: { strokes: MaskStroke[]; rect: Rect }) {
  return <>{strokes.map((s, i) => strokeElement(s, rect, i))}</>;
});

export function MaskCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  strokes,
  onStrokesChange,
  mode,
  brushWidth,
  overlayVisible = true,
}: Props) {
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  /** Re-render tick for the in-progress stroke (batched per frame). */
  const [, setTick] = useState(0);

  // Refs mirror the latest props so gesture callbacks stay fresh.
  const strokesRef = useRef(strokes);
  const onChangeRef = useRef(onStrokesChange);
  const modeRef = useRef(mode);
  const brushRef = useRef(brushWidth);
  const liveRef = useRef<MaskStroke | null>(null);
  const frameRef = useRef<number | null>(null);
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
  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    },
    []
  );

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

  const scheduleRender = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setTick((t) => t + 1);
    });
  }, []);

  const beginStroke = useCallback(
    (x: number, y: number) => {
      const r = rectRef.current;
      if (!r || r.w <= 0 || r.h <= 0) return;
      const nx = (x - r.x) / r.w;
      const ny = (y - r.y) / r.h;
      // Touches outside the image are ignored (§5.7).
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
      const cur = strokesRef.current.strokes;
      if (cur.length >= MAX_STROKES || totalPoints(cur) >= MAX_POINTS) return;
      liveRef.current = { mode: modeRef.current, width: brushRef.current, points: [[nx, ny]] };
      scheduleRender();
    },
    [scheduleRender]
  );

  const extendStroke = useCallback(
    (x: number, y: number) => {
      const live = liveRef.current;
      const r = rectRef.current;
      if (!live || !r) return;
      // Clamp: the outside portion of a drag is ignored.
      const nx = Math.min(1, Math.max(0, (x - r.x) / r.w));
      const ny = Math.min(1, Math.max(0, (y - r.y) / r.h));
      const [px, py] = live.points[live.points.length - 1];
      if (Math.hypot(nx - px, (ny - py) * (r.h / r.w)) < MIN_STEP) return;
      if (totalPoints(strokesRef.current.strokes) + live.points.length >= MAX_POINTS) return;
      live.points.push([nx, ny]);
      scheduleRender();
    },
    [scheduleRender]
  );

  const endStroke = useCallback(() => {
    const live = liveRef.current;
    liveRef.current = null;
    if (!live) return;
    const next: MaskStrokes = { version: 1, strokes: [...strokesRef.current.strokes, live] };
    strokesRef.current = next;
    onChangeRef.current(next);
    scheduleRender();
  }, [scheduleRender]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .maxPointers(1)
        .onBegin((e) => beginStroke(e.x, e.y))
        .onUpdate((e) => extendStroke(e.x, e.y))
        .onFinalize(() => endStroke()),
    [beginStroke, extendStroke, endStroke]
  );

  const live = liveRef.current;

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
        {/* The photo never takes touches (on web an <img> would start a native drag and cancel the brush). */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Photo to edit" />
        </View>
        {overlayVisible && rect ? (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <Mask id="brush" x="0" y="0" width="100%" height="100%" maskUnits="userSpaceOnUse">
                <SvgRect x="0" y="0" width="100%" height="100%" fill="#000" />
                <CommittedStrokes strokes={strokes.strokes} rect={rect} />
                {live ? strokeElement(live, rect, "live") : null}
              </Mask>
            </Defs>
            <SvgRect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              fill={PAINT_COLOR}
              opacity={PAINT_OPACITY}
              mask="url(#brush)"
            />
          </Svg>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
});
