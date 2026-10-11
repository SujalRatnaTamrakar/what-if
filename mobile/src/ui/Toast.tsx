/**
 * mobile/src/ui/Toast.tsx — one app-wide toast. `useToast().show(msg)`.
 * Slides up above the tab bar / home indicator; auto-hides.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../components/Text";
import { theme } from "../theme";

type Tone = "default" | "success" | "error";
interface ToastState {
  id: number;
  message: string;
  tone: Tone;
}

const Ctx = createContext<{ show: (message: string, tone?: Tone) => void }>({ show: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, tone: Tone = "default") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const bg = toast?.tone === "error" ? theme.colors.coral : toast?.tone === "success" ? theme.colors.accent : theme.colors.text;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 92 }]}>
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInDown.springify().damping(18)}
            exiting={FadeOutDown.duration(180)}
            style={[styles.toast, { backgroundColor: bg }]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text style={styles.text}>{toast.message}</Text>
          </Animated.View>
        ) : null}
      </View>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 20, right: 20, alignItems: "center", zIndex: 999 },
  toast: { borderRadius: theme.radius.l, paddingVertical: 13, paddingHorizontal: 18, maxWidth: 480 },
  text: { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" },
});
