/**
 * mobile/src/components/AppHeader.tsx — brand header: sprout mark +
 * Fraunces wordmark (upright green "What", italic orange "If") + tagline; search and
 * "how it works" actions on the right.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Text } from "./Text";
import { theme } from "../theme";
import { BookIcon, SearchIcon, SproutIcon } from "./icons";
import { Wordmark } from "./Wordmark";

interface Props {
  onSearch?: () => void;
  title?: string;
}

export function AppHeader({ onSearch, title }: Props) {
  return (
    <View style={styles.wrap}>
      <SproutIcon size={34} />
      <View style={styles.titleWrap}>
        <View style={styles.titleRow}>
          <Wordmark size={27} />
          {title ? <Text style={styles.section}>{title}</Text> : null}
        </View>
        <Text style={styles.tagline}>People. Places. Brighter tomorrows.</Text>
      </View>
      <View style={styles.icons}>
        {onSearch ? (
          <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel="Search" style={styles.iconBtn}>
            <SearchIcon size={22} color={theme.colors.text} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push("/onboarding")}
          accessibilityRole="button"
          accessibilityLabel="How WhatIf works"
          style={styles.iconBtn}
        >
          <BookIcon size={21} color={theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 2, paddingBottom: 4 },
  titleWrap: { flex: 1, marginLeft: 8 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  section: { color: theme.colors.faint, fontSize: 16, fontWeight: "500" },
  tagline: { fontSize: 12, color: theme.colors.muted, marginTop: 1 },
  icons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
});