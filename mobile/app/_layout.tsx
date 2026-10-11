/**
 * mobile/app/_layout.tsx — root layout per §7.3.
 * Providers: SafeArea, QueryClient, Auth, GestureHandlerRoot, FixtureBanner.
 * Poppins is loaded before first paint; if loading fails the app still
 * renders with system fonts rather than blocking.
 */
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../src/auth/AuthProvider";
import { FixtureBanner } from "../src/components/FixtureBanner";
import { theme } from "../src/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const [loaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const ready = loaded || fontError != null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <FixtureBanner />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
                animation: "slide_from_right",
              }}
            />
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
});
