/** web/src/lib/onboarding.ts — first-launch flag. */
import { kvGet, kvSet } from "./kv";

export async function hasSeenOnboarding(): Promise<boolean> {
  return (await kvGet("onboarded")) === "1";
}

export async function markOnboardingSeen(): Promise<void> {
  await kvSet("onboarded", "1");
}
