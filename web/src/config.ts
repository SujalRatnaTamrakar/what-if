/**
 * web/src/config.ts — the ONLY place that reads env vars (§6.4).
 * Every other module imports from here; nothing else reads import.meta.env.
 * VITE_* values ship inside the bundle: NEVER put secrets here.
 */

export type ApiMode = "fixture" | "live";

const env = import.meta.env;

export const config = {
  apiMode: (env.VITE_API_MODE || "fixture") as ApiMode,
  apiBaseUrl: env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  auth0Domain: env.VITE_AUTH0_DOMAIN || "whatif.us.auth0.com",
  auth0ClientId: env.VITE_AUTH0_CLIENT_ID || "",
  auth0Audience: env.VITE_AUTH0_AUDIENCE || "https://api.whatif.dev",
  jobPollMs: parseInt(env.VITE_JOB_POLL_MS || "2000", 10),
  /** Map tiles for the Map tab ({z}/{x}/{y} template). */
  mapTileUrl: env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  /** Nominatim-compatible geocoder base URL; "" turns geocoding off. */
  geocoderUrl: env.VITE_GEOCODER_URL ?? "https://nominatim.openstreetmap.org",
  isDev: env.DEV,
  appVersion: "1.0.0",
};

export type AppConfig = typeof config;
