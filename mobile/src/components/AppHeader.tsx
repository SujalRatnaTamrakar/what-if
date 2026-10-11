/**
 * mobile/src/components/AppHeader.tsx — mockup header: sprout logo +
 * "PlacePatch" wordmark (green "Place", orange "Patch"), tagline
 * "People. Places. Brighter tomorrows.", search + kebab icons right.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { theme } from "../theme";
import { KebabIcon, SearchIcon, SproutIcon } from "./icons";

interface Props {
  onSearch?: () => void;
  onMenu?: () => void;
}

export function AppHeader({ onSearch, onMenu }: Props) {
  return (
    <View style={styles.wrap}>
      <SproutIcon size={36} />
      <View style={styles.titleWrap}>
        <Text style={styles.wordmark}>
          <Text style={styles.place}>Place</Text>
          <Text style={styles.patch}>Patch</Text>
        </Text>
        <Text style={styles.tagline}>People. Places. Brighter tomorrows.</Text>
      </View>
      <View style={styles.icons}>
        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={styles.iconBtn}
        >
          <SearchIcon size={22} color={theme.colors.text} />
        </Pressable>
        <Pressable
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel="More options"
          style={styles.iconBtn}
        >
          <KebabIcon size={22} color={theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  titleWrap: { flex: 1, marginLeft: 10 },
  wordmark: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  place: { color: theme.colors.accent },
  patch: { color: theme.colors.orange },
  tagline: { fontSize: 12, color: theme.colors.muted, marginTop: 1 },
  icons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { padding: 8 },
});
