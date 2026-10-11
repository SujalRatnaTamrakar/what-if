/**
 * web/src/components/ScanningPhoto.tsx — the photo under an animated AI
 * "scan": a glowing sweep line, viewfinder corners and a status pill. Used
 * while the scene is analyzed and while a concept renders.
 */
import React from "react";
import { Img, Text, View, absoluteFill, styleSheet } from "../ui/primitives";
import { SparkleIcon } from "./icons";
import { theme } from "../theme";

interface Props {
  uri: string;
  aspectRatio: number;
  label: string;
  active?: boolean;
  tint?: "green" | "sun";
  children?: React.ReactNode;
}

const C = 26;
const CORNERS = {
  tl: { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 14, right: 14, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
} as const;

export function ScanningPhoto({ uri, aspectRatio, label, active = true, tint = "green", children }: Props) {
  const glow = tint === "sun" ? "232,163,61" : "127,214,170";

  return (
    <View role="img" aria-label={label} style={[styles.frame, { aspectRatio }]}>
      <Img src={uri} fill transition={200} />
      {children}
      {active ? (
        <>
          <View style={[absoluteFill, styles.dim]} />
          <View
            style={[
              styles.sweep,
              {
                background: `linear-gradient(to bottom, rgba(${glow},0), rgba(${glow},0.35), rgba(${glow},0))`,
                animation: "wi-sweep 2200ms ease-in-out infinite alternate",
              },
            ]}
          >
            <View style={[styles.line, { backgroundColor: `rgb(${glow})` }]} />
          </View>
          {(Object.keys(CORNERS) as (keyof typeof CORNERS)[]).map((c) => (
            <View key={c} style={[styles.corner, CORNERS[c]]} />
          ))}
          <View style={styles.pillWrap}>
            <View style={styles.pill}>
              <SparkleIcon size={14} color="#fff" />
              <Text style={styles.pillText}>{label}</Text>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = styleSheet({
  frame: { width: "100%", borderRadius: theme.radius.xl, overflow: "hidden", backgroundColor: theme.colors.paperDeep, maxHeight: 460 },
  dim: { backgroundColor: "rgba(10,30,20,0.18)" },
  sweep: { position: "absolute", left: 0, right: 0, height: 120, justifyContent: "center", pointerEvents: "none" },
  line: { height: 2, opacity: 0.9 },
  corner: { position: "absolute", width: C, height: C, borderColor: "#fff" },
  pillWrap: { position: "absolute", bottom: 22, left: 0, right: 0, alignItems: "center", pointerEvents: "none" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.scrim,
    borderRadius: 999,
    padding: "8px 14px",
    animation: "wi-pill 900ms ease-in-out infinite alternate",
  },
  pillText: { color: "#fff", fontWeight: 600, fontSize: 13 },
});
