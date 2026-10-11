/**
 * web/src/components/Skeleton.tsx — pulsing placeholder shown while the
 * feed loads (replaces a bare spinner so layout doesn't jump).
 */
import React from "react";
import { View, type StyleInput } from "../ui/primitives";
import { shadows, theme } from "../theme";

export function SkeletonBlock({ style }: { style?: StyleInput }) {
  return (
    <View
      style={[
        { backgroundColor: "#E9E3D4", borderRadius: 8, animation: "wi-pulse 800ms ease-in-out infinite alternate" },
        style,
      ]}
    />
  );
}

export function ProposalCardSkeleton() {
  return (
    <View
      role="status"
      aria-label="Loading proposal"
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: theme.spacing.l,
        ...shadows.card,
      }}
    >
      <SkeletonBlock style={{ height: 170, borderRadius: 0 }} />
      <View style={{ padding: theme.spacing.l }}>
        <SkeletonBlock style={{ height: 18, width: "80%" }} />
        <SkeletonBlock style={{ height: 14, width: "55%", marginTop: 10 }} />
        <SkeletonBlock style={{ height: 14, width: "35%", marginTop: 14 }} />
      </View>
    </View>
  );
}
