/**
 * mobile/src/components/ScreenHeader.tsx — back arrow + title row used by the
 * proposal flow (mockups: "Proposal", "Brush the change", "Review & publish").
 * Applies the top safe-area inset so it never sits under the notch.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTopInset } from "../lib/useTopInset";
import { Text } from "./Text";
import { BackIcon } from "./icons";
import { theme } from "../theme";

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  accentTitle?: boolean;
}

export function ScreenHeader({ title, onBack, right, accentTitle }: Props) {
  const top = useTopInset();
  return (
    <View style={[styles.wrap, { paddingTop: top + 6 }]}>
      <Pressable
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <BackIcon size={24} color={theme.colors.text} />
      </Pressable>
      <Text
        style={[styles.title, accentTitle && { color: theme.colors.accent }]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: theme.colors.background,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: "rgba(0,0,0,0.06)" },
  title: { flex: 1, fontSize: 20, fontWeight: "600", color: theme.colors.text, marginLeft: 4 },
  right: { minWidth: 44, alignItems: "flex-end" },
});
