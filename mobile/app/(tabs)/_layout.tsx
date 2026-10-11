/**
 * mobile/app/(tabs)/_layout.tsx — tabs per §7.3:
 * Community · Create · Mine · Profile.
 * Screens: S7 Community (index), S1 Capture (create), S8 Mine, S9 Profile.
 * (Text glyphs for tab icons — @expo/vector-icons is not installed.)
 */
import React from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router";
import { ACCENT, PAPER } from "../../src/components/PrimaryButton";

function Glyph({ children, color }: { children: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{children}</Text>;
}

function icon(glyph: string) {
  return ({ color }: { color: unknown }) => (
    <Glyph color={String(color)}>{glyph}</Glyph>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: "#8A8A8A",
        tabBarStyle: { backgroundColor: PAPER, borderTopWidth: 0 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Community",
          tabBarIcon: icon("🏠"),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: icon("➕"),
        }}
      />
      <Tabs.Screen
        name="mine"
        options={{
          title: "Mine",
          tabBarIcon: icon("🗂️"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: icon("👤"),
        }}
      />
    </Tabs>
  );
}
