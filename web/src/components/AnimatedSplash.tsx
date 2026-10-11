/**
 * web/src/components/AnimatedSplash.tsx — brand overlay on first paint
 * (same image/background as the native splash) with a short settle + fade.
 */
import React, { useEffect, useState } from "react";
import { View, absoluteFill } from "../ui/primitives";

const BG = "#f6f1e7";

export function AnimatedSplash() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGone(true), 950);
    return () => clearTimeout(t);
  }, []);

  if (gone) return null;
  return (
    <View
      aria-hidden
      style={[
        absoluteFill,
        {
          position: "fixed",
          backgroundColor: BG,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          pointerEvents: "none",
          animation: "wi-splash-out 350ms ease 600ms both",
        },
      ]}
    >
      <img src="/splash-icon.png" alt="" style={{ width: 240, height: 240, objectFit: "contain", animation: "wi-splash 600ms ease-out both" }} />
    </View>
  );
}
