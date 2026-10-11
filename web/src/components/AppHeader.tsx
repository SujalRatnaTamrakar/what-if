/**
 * web/src/components/AppHeader.tsx — brand header: sprout mark +
 * "WhatIf" wordmark (green "What", orange "If") + tagline; search and
 * "how it works" actions on the right.
 */
import React from "react";
import { Pressable, Text, View, styleSheet } from "../ui/primitives";
import { useRouter } from "../lib/nav";
import { theme } from "../theme";
import { BookIcon, SearchIcon, SproutIcon } from "./icons";

interface Props {
  onSearch?: () => void;
  title?: string;
}

export function AppHeader({ onSearch, title }: Props) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <SproutIcon size={34} />
      <View style={styles.titleWrap}>
        <Text as="h1" style={styles.wordmark}>
          <Text style={styles.place}>What</Text>
          <Text style={styles.patch}>If</Text>
          {title ? <Text style={styles.section}>  {title}</Text> : null}
        </Text>
        <Text style={styles.tagline}>People. Places. Brighter tomorrows.</Text>
      </View>
      <View style={styles.icons}>
        {onSearch ? (
          <Pressable onPress={onSearch} label="Search" feedback="bg" style={styles.iconBtn}>
            <SearchIcon size={22} color={theme.colors.text} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push("/onboarding")} label="How WhatIf works" feedback="bg" style={styles.iconBtn}>
          <BookIcon size={21} color={theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = styleSheet({
  wrap: { flexDirection: "row", alignItems: "center", paddingLeft: 2, paddingRight: 2, paddingBottom: 4 },
  titleWrap: { flex: 1, marginLeft: 8 },
  wordmark: { fontSize: 25, fontWeight: 700, letterSpacing: -0.6, lineHeight: "32px" },
  place: { color: theme.colors.accent },
  patch: { color: theme.colors.orange },
  section: { color: theme.colors.faint, fontSize: 16, fontWeight: 500 },
  tagline: { fontSize: 12, color: theme.colors.muted, marginTop: -2 },
  icons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
});
