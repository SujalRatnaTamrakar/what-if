/**
 * mobile/src/lib/kv.ts — tiny persistent key/value store for UI conveniences
 * (onboarding seen, where you took a photo). SecureStore on device,
 * localStorage on web; every call is failure-tolerant.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const PREFIX = "whatif_";

export async function kvGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
    return await SecureStore.getItemAsync(PREFIX + key);
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(PREFIX + key, value);
    else await SecureStore.setItemAsync(PREFIX + key, value);
  } catch {
    // Non-critical.
  }
}
