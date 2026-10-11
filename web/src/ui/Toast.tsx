/**
 * web/src/ui/Toast.tsx — one app-wide toast. `useToast().show(msg)`.
 * Slides up above the tab bar; auto-hides.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Text, View } from "./primitives";
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

  const show = useCallback((message: string, tone: Tone = "default") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  const value = useMemo(() => ({ show }), [show]);

  const bg = toast?.tone === "error" ? theme.colors.coral : toast?.tone === "success" ? theme.colors.accent : theme.colors.text;

  return (
    <Ctx.Provider value={value}>
      {children}
      <View
        aria-live="polite"
        style={{
          position: "fixed",
          left: 20,
          right: 20,
          bottom: "calc(env(safe-area-inset-bottom) + 92px)",
          alignItems: "center",
          zIndex: 999,
          pointerEvents: "none",
        }}
      >
        {toast ? (
          <View
            key={toast.id}
            role="alert"
            className="anim-fade-in-up"
            style={{ borderRadius: theme.radius.l, padding: "13px 18px", maxWidth: 480, backgroundColor: bg, boxShadow: "0 8px 18px rgba(15,59,42,0.18)" }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: 600, textAlign: "center" }}>{toast.message}</Text>
          </View>
        ) : null}
      </View>
    </Ctx.Provider>
  );
}
