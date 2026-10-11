/**
 * mobile/src/components/TabBar.tsx — bottom bar: Community · Map · (Create) ·
 * Mine · Profile. Active tab gets a mint pill; Create is a raised forest
 * button (the app's main action). Bottom safe-area aware; haptic on change.
 */
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Text } from "./Text";
import { HomeIcon, MapIcon, StackIcon, UserIcon } from "./icons";
import { shadows, theme } from "../theme";
import Svg, { Path } from "react-native-svg";

const ICONS: Record<string, (p: { color: string; active: boolean }) => React.ReactElement> = {
  index: ({ color, active }) => <HomeIcon size={23} color={color} filled={active} />,
  map: ({ color }) => <MapIcon size={23} color={color} />,
  mine: ({ color }) => <StackIcon size={23} color={color} />,
  profile: ({ color, active }) => <UserIcon size={23} color={color} filled={active} />,
};

function Pill({ active, children }: { active: boolean; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: active ? theme.colors.accentSoft : "transparent",
    transform: [{ scaleX: withSpring(active ? 1 : 0.6, { damping: 18, stiffness: 220 }) }],
  }));
  return (
    <View style={styles.pillWrap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.pill, style]} />
      <View style={styles.iconLayer}>{children}</View>
    </View>
  );
}

function CreateButton({ onPress, active }: { onPress: () => void; active: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Create a proposal"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round">
        <Path d="M12 5v14M5 12h14" />
      </Svg>
    </Pressable>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.title ?? route.name) as string;
        const active = state.index === index;
        const color = active ? theme.colors.accentDark : theme.colors.muted;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) {
            if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
            navigation.navigate(route.name, route.params);
          }
        };
        if (route.name === "create") {
          return (
            <View key={route.key} style={styles.item}>
              <CreateButton onPress={onPress} active={active} />
              <Text style={[styles.label, { color }, active && styles.labelActive]}>{label}</Text>
            </View>
          );
        }
        const renderIcon = ICONS[route.name];
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={styles.item}
          >
            <Pill active={active}>{renderIcon?.({ color, active })}</Pill>
            <Text style={[styles.label, { color }, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#FBF8F1",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "flex-end", minHeight: 56 },
  pillWrap: { width: 58, height: 32, alignItems: "center", justifyContent: "center" },
  pill: { borderRadius: 16 },
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
  label: { fontSize: 11, fontWeight: "500", marginTop: 3 },
  labelActive: { fontWeight: "700" },
});
