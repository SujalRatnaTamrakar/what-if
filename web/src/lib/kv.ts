/**
 * web/src/lib/kv.ts — tiny persistent key/value store for UI conveniences
 * (onboarding seen, where you took a photo). localStorage; every call is
 * failure-tolerant (private mode, blocked storage).
 */
const PREFIX = "whatif_";

export async function kvGet(key: string): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch {
    // Non-critical.
  }
}

export async function kvRemove(key: string): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(PREFIX + key);
  } catch {
    // Non-critical.
  }
}
