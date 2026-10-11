/**
 * web/src/components/FixtureBanner.tsx (§7.5 Global).
 * - Pinned at top whenever apiMode==='fixture': "DEVELOPMENT FIXTURES — NOT LIVE AI"
 * - Second banner "Demo renderer (fake)" when config.providers.render==='fake'
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View, styleSheet } from "../ui/primitives";
import { api } from "../api";
import { config } from "../config";

export function FixtureBanner() {
  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: () => api.getConfig(),
    staleTime: 60_000,
    retry: false,
  });
  if (config.apiMode !== "fixture") return null;
  const fakeRender = data?.providers?.render === "fake";
  return (
    <View style={styles.wrap}>
      <View style={[styles.banner, { paddingTop: "calc(env(safe-area-inset-top) + 6px)" }]}>
        <Text style={styles.text}>DEVELOPMENT FIXTURES — NOT LIVE AI</Text>
      </View>
      {fakeRender ? (
        <View style={[styles.banner, styles.fake]}>
          <Text style={styles.text}>Demo renderer (fake)</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = styleSheet({
  wrap: { zIndex: 100 },
  banner: { backgroundColor: "#7c2d12", padding: "6px 12px", alignItems: "center" },
  fake: { backgroundColor: "#5b21b6" },
  text: { color: "#fff", fontSize: 12, fontWeight: 700 },
});
