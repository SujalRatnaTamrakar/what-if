/**
 * mobile/src/auth/tokenStore.ts — token persistence.
 * SecureStore on native, in-memory on web (no secure storage there).
 * Framework-free.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms when the access token expires */
  expiresAt: number;
}

const KEY = "whatif.tokens";
let memoryTokens: TokenSet | null = null;
const isWeb = Platform.OS === "web";

export async function saveTokens(tokens: TokenSet): Promise<void> {
  if (isWeb) {
    memoryTokens = tokens;
    return;
  }
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
}

export async function getTokens(): Promise<TokenSet | null> {
  if (isWeb) return memoryTokens;
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenSet;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  if (isWeb) {
    memoryTokens = null;
    return;
  }
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
}
