/**
 * web/src/ui/Dock.tsx — sticky bottom action area with a soft paper
 * backdrop. Content is held to the app column on wide screens.
 */
import React from "react";
import { COLUMN, View } from "./primitives";
import { theme } from "../theme";

export function Dock({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: "calc(max(env(safe-area-inset-bottom), 12px) + 6px)",
        backgroundColor: "rgba(246,241,231,0.97)",
        borderTop: `1px solid ${theme.colors.border}`,
        backdropFilter: "blur(6px)",
        zIndex: 20,
      }}
    >
      <View style={{ width: "100%", maxWidth: COLUMN - 40, alignSelf: "center", gap: 10 }}>{children}</View>
    </View>
  );
}
