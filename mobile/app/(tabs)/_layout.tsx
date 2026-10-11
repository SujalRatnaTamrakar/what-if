/**
 * mobile/app/(tabs)/_layout.tsx — tabs per §7.3:
 * Community · Create · Mine · Profile.
 * Screens: S7 Community (index), S1 Capture (create), S8 Mine, S9 Profile.
 */
import React from "react";
import { Tabs } from "expo-router";
import { TabBar } from "../../src/components/TabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Community" }} />
      <Tabs.Screen name="create" options={{ title: "Create" }} />
      <Tabs.Screen name="mine" options={{ title: "Mine" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
