/**
 * web/src/components/MaskCanvas.tsx — brush canvas for S3 (§5.7, §12).
 *
 * Shows the sanitized source image (object-fit: contain) and lets the user
 * paint/erase strokes with mouse, touch or pen. Points are normalized to the
 * IMAGE CONTENT RECT (getBoundingClientRect + object-fit math — not the
 * element, not letterbox padding); presses outside the image are ignored.
 * Strokes render as a semi-transparent SVG overlay with round caps — the
 * same strokes JSON the mobile app sends.
 *
 * Performance: the stroke being drawn lives in a ref and only this canvas
 * re-renders while you drag (at most once per frame); the parent gets ONE
 * onStrokesChange when the pointer lifts.
 *
 * Limits per §5.7: ≤200 strokes, ≤5000 points total.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Img, View, absoluteFill } from "../ui/primitives";
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
    return <circle key={key} cx={r.x + nx * r.w} cy={r.y + ny * r.h} r={widthPx / 2} fill={color} />;
  }
  let d = "";
  for (let i = 0; i < s.points.length; i++) {
    const [nx, ny] = s.points[i];
    d += `${i === 0 ? "M" : " L"} ${(r.x + nx * r.w).toFixed(1)} ${(r.y + ny * r.h).toFixed(1)}`;
  }
  return <path key={key} d={d} stroke={color} strokeWidth={widthPx} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
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
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  /** Re-render tick for the in-progress stroke (batched per frame). */
  const [, setTick] = useState(0);
  const maskId = useMemo(() => `brush-${Math.random().toString(36).slice(2)}`, []);

  // Refs mirror the latest props so pointer handlers stay fresh.
  const strokesRef = useRef(strokes);
  const onChangeRef = useRef(onStrokesChange);
  const modeRef = useRef(mode);
  const brushRef = useRef(brushWidth);
  const liveRef = useRef<MaskStroke | null>(null);
  const pointerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  strokesRef.current = strokes;
  onChangeRef.current = onStrokesChange;
  modeRef.current = mode;
  brushRef.current = brushWidth;

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  // Track the element size (layout changes, window resizes).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Exact image content rect inside the element for object-fit: contain. */
  const rect: Rect | null = useMemo(() => {
    if (!view || imageWidth <= 0 || imageHeight <= 0) return null;
    const scale = Math.min(view.w / imageWidth, view.h / imageHeight);
    const w = imageWidth * scale;
    const h = imageHeight * scale;
    return { x: (view.w - w) / 2, y: (view.h - h) / 2, w, h };
  }, [view, imageWidth, imageHeight]);
  const rectRef = useRef<Rect | null>(null);
  rectRef.current = rect;

  const scheduleRender = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setTick((t) => t + 1);
    });
  }, []);

  /** Pointer position relative to the element's top-left. */
  const local = (e: React.PointerEvent) => {
    const b = box.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  const beginStroke = (x: number, y: number): boolean => {
    const r = rectRef.current;
    if (!r || r.w <= 0 || r.h <= 0) return false;
    const nx = (x - r.x) / r.w;
    const ny = (y - r.y) / r.h;
    // Presses outside the image are ignored (§5.7).
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false;
    const cur = strokesRef.current.strokes;
    if (cur.length >= MAX_STROKES || totalPoints(cur) >= MAX_POINTS) return false;
    liveRef.current = { mode: modeRef.current, width: brushRef.current, points: [[nx, ny]] };
    scheduleRender();
    return true;
  };

  const extendStroke = (x: number, y: number) => {
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
  };

  const endStroke = () => {
    pointerRef.current = null;
    const live = liveRef.current;
    liveRef.current = null;
    if (!live) return;
    const next: MaskStrokes = { version: 1, strokes: [...strokesRef.current.strokes, live] };
    strokesRef.current = next;
    onChangeRef.current(next);
    scheduleRender();
  };

  const live = liveRef.current;

  return (
    <View
      ref={box}
      role="img"
      aria-label="Brush the area to change"
      onPointerDown={(e) => {
        if (pointerRef.current != null || (e.pointerType === "mouse" && e.button !== 0)) return;
        const { x, y } = local(e);
        if (!beginStroke(x, y)) return;
        pointerRef.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pointerRef.current) return;
        // Coalesced events keep fast strokes smooth on high-rate pointers.
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        const b = box.current!.getBoundingClientRect();
        for (const ev of events.length ? events : [e.nativeEvent]) extendStroke(ev.clientX - b.left, ev.clientY - b.top);
      }}
      onPointerUp={(e) => {
        if (e.pointerId === pointerRef.current) endStroke();
      }}
      onPointerCancel={(e) => {
        if (e.pointerId === pointerRef.current) endStroke();
      }}
      style={{ flex: 1, backgroundColor: "#111", touchAction: "none", cursor: "crosshair", overflow: "hidden" }}
    >
      {/* The photo never takes pointer events (an <img> would start a native drag and cancel the brush). */}
      <View style={[absoluteFill, { pointerEvents: "none" }]}>
        <Img src={imageUrl} fill fit="contain" alt="Photo to edit" />
      </View>
      {overlayVisible && rect && view ? (
        <svg width={view.w} height={view.h} style={{ ...absoluteFill, pointerEvents: "none" }} aria-hidden="true">
          <defs>
            <mask id={maskId} x="0" y="0" width={view.w} height={view.h} maskUnits="userSpaceOnUse">
              <rect x="0" y="0" width={view.w} height={view.h} fill="#000" />
              <CommittedStrokes strokes={strokes.strokes} rect={rect} />
              {live ? strokeElement(live, rect, "live") : null}
            </mask>
          </defs>
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={PAINT_COLOR} opacity={PAINT_OPACITY} mask={`url(#${maskId})`} />
        </svg>
      ) : null}
    </View>
  );
}
