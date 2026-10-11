/**
 * mobile/app/_layout.tsx — root layout per §7.3.
 * Providers: SafeArea, QueryClient, Auth, GestureHandlerRoot, FixtureBanner.
 * Poppins is loaded before first paint; if loading fails the app still
 * renders with system fonts rather than blocking.
 */
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
  Fraunces_800ExtraBold,
  Fraunces_800ExtraBold_Italic,
} from "@expo-google-fonts/fraunces";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../src/auth/AuthProvider";
import { AnimatedSplash } from "../src/components/AnimatedSplash";
import { FixtureBanner } from "../src/components/FixtureBanner";
import { ToastProvider } from "../src/ui/Toast";
import { hasSeenOnboarding } from "../src/lib/onboarding";
import { theme } from "../src/theme";

/** Sends first-time users to the onboarding story once. */
function OnboardingGate() {
  useEffect(() => {
    let alive = true;
    void hasSeenOnboarding().then((seen) => {
      if (alive && !seen) setTimeout(() => router.replace("/onboarding"), 0);
    });
    return () => {
      alive = false;
    };
  }, []);
  return null;
}

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
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Fraunces_800ExtraBold,
    Fraunces_800ExtraBold_Italic,
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
            <ToastProvider>
              <StatusBar style="dark" />
              <FixtureBanner />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.colors.background },
                  animation: "slide_from_right",
                }}
              >
                <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
                <Stack.Screen name="proposal/[id]/celebrate" options={{ animation: "fade", gestureEnabled: false }} />
              </Stack>
              <OnboardingGate />
              <AnimatedSplash ready={ready} />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
});
