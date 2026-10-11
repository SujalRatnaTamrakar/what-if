/**
 * web/src/components/ScreenHeader.tsx — back arrow + title row used by the
 * proposal flow ("Proposal", "Brush the change", "Review & publish").
 */
import React from "react";
import { COLUMN, Pressable, Text, View, styleSheet } from "../ui/primitives";
import { useRouter } from "../lib/nav";
import { BackIcon } from "./icons";
import { theme } from "../theme";

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  accentTitle?: boolean;
  /** Content width (defaults to the app column). */
  maxWidth?: number;
}

export function ScreenHeader({ title, onBack, right, accentTitle, maxWidth = COLUMN }: Props) {
  const router = useRouter();
  return (
    <View style={styles.outer}>
      <View style={[styles.wrap, { maxWidth }]}>
        <Pressable onPress={onBack ?? (() => router.back())} label="Go back" feedback="bg" style={styles.back}>
          <BackIcon size={24} color={theme.colors.text} />
        </Pressable>
        <Text as="h1" style={[styles.title, accentTitle && { color: theme.colors.accent }]} lines={1}>
          {title}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = styleSheet({
  outer: { backgroundColor: theme.colors.background, paddingTop: 6 },
  wrap: { flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 12, paddingBottom: 10, width: "100%", alignSelf: "center" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: 600, color: theme.colors.text, marginLeft: 4 },
  right: { minWidth: 44, alignItems: "flex-end" },
});
