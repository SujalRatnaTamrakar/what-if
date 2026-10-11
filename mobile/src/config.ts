/**
 * mobile/src/config.ts — the ONLY place that reads env vars (§6.2).
 * Every other module imports from here; nothing else reads process.env.
 * EXPO_PUBLIC_* values ship inside the app bundle: NEVER put secrets here.
 * If env vars are unavailable (e.g. Rork preview), the constants below apply.
 */

export type ApiMode = "fixture" | "live";

// Expo only inlines public environment variables referenced with dot notation.
export const config = {
  apiMode: (process.env.EXPO_PUBLIC_API_MODE || "fixture") as ApiMode,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1",
  auth0Domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN || "whatif.us.auth0.com",
  auth0ClientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || "",
  auth0Audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE || "https://api.whatif.dev",
  auth0Scheme: process.env.EXPO_PUBLIC_AUTH0_SCHEME || "whatif",
  jobPollMs: parseInt(process.env.EXPO_PUBLIC_JOB_POLL_MS || "2000", 10),
  /** OpenStreetMap-style tile template for the Map tab ({z}/{x}/{y}). */
  mapTileUrl: process.env.EXPO_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  appVersion: "1.0.0",
};

export type AppConfig = typeof config;
