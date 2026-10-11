/**
 * web/src/components/BeforeAfterSlider.tsx — draggable before/after
 * comparison (§7.5 S5/S6). Pointer drag (mouse, touch, pen) or arrow keys
 * move the divider; `intro` plays a one-time sweep that teaches the drag;
 * press-and-hold shows the full original ("hold to compare").
 * The AI-illustration chip is always on the concept side (§7.5 Global).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Img, Text, View, absoluteFill, styleSheet } from "../ui/primitives";
import { AiLabel } from "./AiLabel";
import { theme } from "../theme";

interface Props {
  beforeUri: string;
  afterUri: string;
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

const HOLD_MS = 380;
const HOLD_SLOP = 8;
const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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
  const frame = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0.5);
  const posRef = useRef(0.5);
  const [holding, setHolding] = useState(false);
  const anim = useRef<number | null>(null);
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);

  const set = useCallback((p: number) => {
    posRef.current = p;
    setPos(p);
  }, []);

  const stopAnim = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  /** 0.82 → 0.18 → 0.5, the same sweep as mobile. */
  const sweep = useCallback(
    (delay: number) => {
      stopAnim();
      const legs = [
        { to: 0.82, ms: 900 },
        { to: 0.18, ms: 1100 },
        { to: 0.5, ms: 800 },
      ];
      let leg = 0;
      let from = posRef.current;
      let start = performance.now() + delay;
      const step = (now: number) => {
        if (now < start) {
          anim.current = requestAnimationFrame(step);
          return;
        }
        const { to, ms } = legs[leg];
        const t = Math.min(1, (now - start) / ms);
        set(from + (to - from) * easeInOutCubic(t));
        if (t >= 1) {
          leg += 1;
          if (leg >= legs.length) {
            anim.current = null;
            return;
          }
          from = to;
          start = now;
        }
        anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [set]
  );

  useEffect(() => {
    if (!intro && !autoplay) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    if (autoplay) {
      sweep(600);
      const t = setInterval(() => sweep(600), 4200);
      return () => {
        clearInterval(t);
        stopAnim();
      };
    }
    sweep(450);
    return stopAnim;
  }, [intro, autoplay, sweep]);

  const fromEvent = (clientX: number) => {
    const r = frame.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return posRef.current;
    return clamp((clientX - r.left) / r.width);
  };

  const endPress = () => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
    setHolding(false);
  };

  const interactive = !autoplay;

  return (
    <View
      ref={frame}
      role={interactive ? "slider" : "img"}
      tabIndex={interactive ? 0 : undefined}
      className={interactive ? "focusable" : undefined}
      aria-label={`${beforeLabel} and ${afterLabel} comparison. Drag to compare, hold to see the original.`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(pos * 100) : undefined}
      onPointerDown={
        interactive
          ? (e) => {
              stopAnim();
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              set(fromEvent(e.clientX));
              press.current = {
                x: e.clientX,
                y: e.clientY,
                timer: setTimeout(() => setHolding(true), HOLD_MS),
              };
            }
          : undefined
      }
      onPointerMove={
        interactive
          ? (e) => {
              if (!press.current) return;
              if (press.current.timer && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > HOLD_SLOP) {
                clearTimeout(press.current.timer);
                press.current.timer = null;
              }
              set(fromEvent(e.clientX));
            }
          : undefined
      }
      onPointerUp={interactive ? endPress : undefined}
      onPointerCancel={interactive ? endPress : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                stopAnim();
                set(clamp(posRef.current + (e.key === "ArrowLeft" ? -0.05 : 0.05)));
              }
            }
          : undefined
      }
      style={[
        styles.frame,
        { aspectRatio, cursor: interactive ? "ew-resize" : "default", touchAction: interactive ? "pan-y" : "auto" },
        rounded && styles.rounded,
      ]}
    >
      <Img src={afterUri} fill transition={250} />
      <View style={[absoluteFill, { clipPath: holding ? "none" : `inset(0 ${(1 - pos) * 100}% 0 0)` }]}>
        <Img src={beforeUri} fill transition={250} />
      </View>
      {!holding ? (
        <>
          <View style={[styles.divider, { left: `calc(${pos * 100}% - 1.5px)` }]} />
          <View style={[styles.knob, { left: `calc(${pos * 100}% - 20px)` }]}>
            <Text style={styles.knobText}>‹ ›</Text>
          </View>
        </>
      ) : null}
      {showAiLabel && !holding ? <AiLabel style={styles.ai} /> : null}
      <View style={[styles.tag, styles.tagLeft]}>
        <Text style={styles.tagText}>{holding ? "Original photo" : beforeLabel}</Text>
      </View>
      {!holding ? (
        <View style={[styles.tag, styles.tagRight]}>
          <Text style={styles.tagText}>{afterLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = styleSheet({
  frame: { width: "100%", overflow: "hidden", backgroundColor: theme.colors.paperDeep, userSelect: "none" },
  rounded: { borderRadius: theme.radius.xl },
  divider: { position: "absolute", top: 0, bottom: 0, width: 3, backgroundColor: "#fff", pointerEvents: "none" },
  knob: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
    pointerEvents: "none",
  },
  knobText: { fontSize: 15, fontWeight: 700, color: theme.colors.accent, marginTop: -1, lineHeight: "18px" },
  ai: { position: "absolute", top: 12, right: 12, pointerEvents: "none" },
  tag: {
    position: "absolute",
    bottom: 12,
    backgroundColor: "rgba(20, 20, 20, 0.68)",
    borderRadius: theme.radius.pill,
    padding: "6px 12px",
    pointerEvents: "none",
  },
  tagLeft: { left: 12 },
  tagRight: { right: 12 },
  tagText: { color: "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
});
