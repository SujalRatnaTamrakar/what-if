/**
 * web/src/lib/nav.ts — expo-router's `router` verbs on react-router:
 * push / replace / back (back falls home when there is no in-app history).
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export function canGoBack(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (to: string) => navigate(to),
      replace: (to: string) => navigate(to, { replace: true }),
      back: (fallback = "/") => (canGoBack() ? navigate(-1) : navigate(fallback, { replace: true })),
      canGoBack,
    }),
    [navigate]
  );
}

/** Share text (and the current page link) via the Web Share API, or copy it. */
export async function shareText(message: string, url: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ text: message, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${message} ${url}`);
    return "copied";
  } catch (e) {
    // User closing the share sheet is not a failure worth a toast.
    if (e instanceof DOMException && e.name === "AbortError") return "shared";
    return "failed";
  }
}

export function randomId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Non-secure contexts (plain http on a LAN IP) lack randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
