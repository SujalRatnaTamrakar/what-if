/**
 * mobile/app/_layout.tsx — root layout per §7.3.
 * Providers: QueryClient, Auth, GestureHandlerRoot, FixtureBanner.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { Slot } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../src/auth/AuthProvider";
import { FixtureBanner } from "../src/components/FixtureBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Screens manage their own polling (useJobPolling); don't refetch
      // aggressively on focus during the demo.
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <FixtureBanner />
          <Slot />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
