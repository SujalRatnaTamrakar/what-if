/**
 * mobile/src/config.ts — the ONLY place that reads env vars (§6.2).
 * Every other module imports from here; nothing else reads process.env.
 * EXPO_PUBLIC_* values ship inside the app bundle: NEVER put secrets here.
 * If env vars are unavailable (e.g. Rork preview), the constants below apply.
 */

function readEnv(name: string, fallback: string): string {
  try {
    const v =
      typeof process !== "undefined" &&
      (process as unknown as { env?: Record<string, string | undefined> }).env?.[name];
    return v && v.length > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

export type ApiMode = "fixture" | "live";

export const config = {
  apiMode: readEnv("EXPO_PUBLIC_API_MODE", "fixture") as ApiMode,
  apiBaseUrl: readEnv("EXPO_PUBLIC_API_BASE_URL", "http://localhost:8000/api/v1"),
  auth0Domain: readEnv("EXPO_PUBLIC_AUTH0_DOMAIN", "placepatch.us.auth0.com"),
  auth0ClientId: readEnv("EXPO_PUBLIC_AUTH0_CLIENT_ID", ""),
  auth0Audience: readEnv("EXPO_PUBLIC_AUTH0_AUDIENCE", "https://api.placepatch.dev"),
  auth0Scheme: readEnv("EXPO_PUBLIC_AUTH0_SCHEME", "placepatch"),
  jobPollMs: parseInt(readEnv("EXPO_PUBLIC_JOB_POLL_MS", "2000"), 10),
  appVersion: "1.0.0",
};

export type AppConfig = typeof config;
