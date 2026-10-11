/**
 * mobile/src/api/index.ts — the single `api` object every screen uses.
 * Switching fixture → live is ONE config change (EXPO_PUBLIC_API_MODE).
 */
import { config } from "../config";
import type { ApiClient } from "./ApiClient";
import { fixtureClient } from "./fixtureClient";
import { liveClient } from "./liveClient";

export const api: ApiClient = config.apiMode === "live" ? liveClient : fixtureClient;

export type { ApiClient } from "./ApiClient";
export { setFixtureFailure, getFixtureFailure } from "./fixtureClient";
export type { FixtureFailure } from "./fixtureClient";
export { setAuthHooks } from "./liveClient";
export { ApiError, toApiError, friendlyMessage, displayMessage } from "./errors";
