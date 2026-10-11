import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";

/**
 * OAuth callback route. Auth0 redirects here with ?code= (or ?error=).
 * In Expo Go the redirect arrives as a deep link (exp://.../--/auth?...),
 * which expo-router would otherwise render as "Unmatched Route".
 * Completes the PKCE code exchange, then sends the user to their profile.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    state?: string | string[];
  }>();
  const { exchangeCode } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const code = Array.isArray(params.code) ? params.code[0] : params.code;
      const state = Array.isArray(params.state) ? params.state[0] : params.state;
      if (code) {
        await exchangeCode(code, state ?? null);
      }
      router.replace("/(tabs)/profile");
    })();
    // Run once on mount; params are fixed for this navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f6f1e7",
      }}
    >
      <ActivityIndicator size="large" color="#1d5c40" />
      <Text style={{ marginTop: 12, color: "#1d5c40", fontSize: 16 }}>
        Signing you in…
      </Text>
    </View>
  );
}
