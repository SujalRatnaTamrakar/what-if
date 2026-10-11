/**
 * mobile/src/lib/useTopInset.ts — top safe-area inset for screen headers.
 * In fixture mode the FixtureBanner already consumes the status-bar inset,
 * so screens add none.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { config } from "../config";

export function useTopInset(): number {
  const { top } = useSafeAreaInsets();
  return config.apiMode === "fixture" ? 0 : top;
}
