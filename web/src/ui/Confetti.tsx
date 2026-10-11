/**
 * web/src/ui/Confetti.tsx — lightweight celebratory burst (Web Animations
 * API, no dependency). Plays once on mount.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { View, absoluteFill, useWindowHeight, useWindowWidth } from "./primitives";
import { theme } from "../theme";

const COLORS = [theme.colors.accent, theme.colors.orange, "#7FB89A", theme.colors.coral, "#F3D08A"];

function Piece({ i, w, h }: { i: number; w: number; h: number }) {
  const ref = useRef<HTMLDivElement>(null);
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
    // Randomized once per piece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    const el = ref.current;
    if (!el?.animate) return;
    // Sample the eased path (t' = easeOutCubic) so the parabola matches mobile.
    const frames: Keyframe[] = [];
    for (let k = 0; k <= 20; k++) {
      const p = k / 20;
      const t = 1 - Math.pow(1 - p, 3);
      frames.push({
        offset: p,
        opacity: 1 - Math.max(0, t - 0.7) / 0.3,
        transform: `translate(${cfg.dx * t}px, ${cfg.dy * t + cfg.fall * t * t}px) rotate(${cfg.rot * t}deg)`,
      });
    }
    const anim = el.animate(frames, { duration: 1600, delay: cfg.delay, fill: "both" });
    return () => anim.cancel();
  }, [cfg]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        width: cfg.size,
        height: cfg.round ? cfg.size : cfg.size * 1.6,
        backgroundColor: cfg.color,
        borderRadius: cfg.round ? cfg.size : 2,
      }}
    />
  );
}

export function Confetti() {
  const width = useWindowWidth();
  const height = useWindowHeight();
  return (
    <View aria-hidden style={[absoluteFill, { alignItems: "center", justifyContent: "center", pointerEvents: "none", overflow: "hidden", zIndex: 5 }]}>
      {Array.from({ length: 28 }, (_, i) => (
        <Piece key={i} i={i} w={width} h={height} />
      ))}
    </View>
  );
}
