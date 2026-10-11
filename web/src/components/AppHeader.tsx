/**
 * web/src/components/AppHeader.tsx — brand header: sprout mark +
 * Fraunces wordmark (upright green "What", italic orange "If") + tagline; search and
 * "how it works" actions on the right.
 */
import React from "react";
import { Pressable, Text, View, styleSheet } from "../ui/primitives";
import { useRouter } from "../lib/nav";
import { theme } from "../theme";
import { BookIcon, SearchIcon, SproutIcon } from "./icons";
import { Wordmark } from "./Wordmark";

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
        <View style={styles.titleRow}>
          <Wordmark as="h1" size={27} />
          {title ? <Text style={styles.section}>{title}</Text> : null}
        </View>
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
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  section: { color: theme.colors.faint, fontSize: 16, fontWeight: 500 },
  tagline: { fontSize: 12, color: theme.colors.muted, marginTop: 1 },
  icons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
});
