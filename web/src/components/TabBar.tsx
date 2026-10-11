/**
 * web/src/components/TabBar.tsx — bottom bar: Community · Map · (Create) ·
 * Mine · Profile. Active tab gets a mint pill; Create is a raised forest
 * button (the app's main action). Bottom safe-area aware.
 */
import React from "react";
import { useLocation } from "react-router-dom";
import { COLUMN, Pressable, Text, View, styleSheet } from "../ui/primitives";
import { useRouter } from "../lib/nav";
import { HomeIcon, MapIcon, StackIcon, UserIcon } from "./icons";
import { shadows, theme } from "../theme";

const TABS = [
  { name: "index", path: "/", title: "Community" },
  { name: "map", path: "/map", title: "Map" },
  { name: "create", path: "/create", title: "Create" },
  { name: "mine", path: "/mine", title: "Mine" },
  { name: "profile", path: "/profile", title: "Profile" },
] as const;

const ICONS: Record<string, (p: { color: string; active: boolean }) => React.ReactElement> = {
  index: ({ color, active }) => <HomeIcon size={23} color={color} filled={active} />,
  map: ({ color }) => <MapIcon size={23} color={color} />,
  mine: ({ color }) => <StackIcon size={23} color={color} />,
  profile: ({ color, active }) => <UserIcon size={23} color={color} filled={active} />,
};

function Pill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.pillWrap}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: active ? theme.colors.accentSoft : "transparent",
            transform: `scaleX(${active ? 1 : 0.6})`,
          },
        ]}
      />
      <View style={styles.iconLayer}>{children}</View>
    </View>
  );
}

export function TabBar() {
  const router = useRouter();
  const { pathname } = useLocation();
  return (
    <View role="navigation" aria-label="Main" style={styles.bar}>
      <View style={styles.inner}>
        {TABS.map((tab) => {
          const active = pathname === tab.path;
          const color = active ? theme.colors.accentDark : theme.colors.muted;
          const onPress = () => {
            if (!active) router.push(tab.path);
          };
          if (tab.name === "create") {
            return (
              <View key={tab.name} style={styles.item}>
                <Pressable onPress={onPress} label="Create a proposal" selected={active} feedback="scale-lg" style={styles.fab}>
                  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </Pressable>
                <Text style={[styles.label, { color }, active && styles.labelActive]}>{tab.title}</Text>
              </View>
            );
          }
          return (
            <Pressable key={tab.name} onPress={onPress} role="tab" selected={active} label={tab.title} feedback="none" style={styles.item}>
              <Pill active={active}>{ICONS[tab.name]({ color, active })}</Pill>
              <Text style={[styles.label, { color }, active && styles.labelActive]}>{tab.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = styleSheet({
  bar: {
    backgroundColor: "#FBF8F1",
    borderTop: `1px solid ${theme.colors.border}`,
    paddingTop: 8,
    paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
    zIndex: 30,
  },
  inner: { flexDirection: "row", width: "100%", maxWidth: COLUMN, alignSelf: "center" },
  item: { flex: 1, alignItems: "center", justifyContent: "flex-end", minHeight: 56 },
  pillWrap: { width: 58, height: 32, alignItems: "center", justifyContent: "center" },
  pill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    transition: "transform 260ms cubic-bezier(0.3, 1.5, 0.5, 1), background-color 200ms ease",
  },
  iconLayer: { position: "relative", zIndex: 1 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -24,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FBF8F1",
    ...shadows.lift,
  },
  label: { fontSize: 11, fontWeight: 500, marginTop: 3 },
  labelActive: { fontWeight: 700 },
});
