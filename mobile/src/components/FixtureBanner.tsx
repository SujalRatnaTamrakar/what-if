/**
 * Placeholder FixtureBanner (§7.5 Global). Screens agent: flesh out styling.
 * - Pinned at top whenever apiMode==='fixture': "DEVELOPMENT FIXTURES — NOT LIVE AI"
 * - Second banner "Demo renderer (fake)" when config.providers.render==='fake'
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { config } from "../config";

export function FixtureBanner() {
  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: () => api.getConfig(),
    staleTime: 60_000,
    retry: false,
  });
  const { top } = useSafeAreaInsets();
  if (config.apiMode !== "fixture") return null;
  const fakeRender = data?.providers?.render === "fake";
  return (
    <View style={styles.wrap}>
      <View style={[styles.banner, { paddingTop: top + 6 }]}>
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

const styles = StyleSheet.create({
  wrap: { zIndex: 100 },
  banner: {
    backgroundColor: "#7c2d12",
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  fake: { backgroundColor: "#5b21b6" },
  text: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
