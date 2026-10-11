/**
 * web/src/api/errors.ts — ApiError, parsed from the §5.6 error envelope.
 * Framework-free.
 */
import type { ErrorEnvelope } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly fieldErrors: Record<string, string[]>;
  /** True when the request never got an HTTP response (offline, tunnel down, upload failed). */
  readonly network: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    retryable: boolean,
    fieldErrors: Record<string, string[]> = {},
    network = false
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.fieldErrors = fieldErrors;
    this.network = network;
  }
}

/** Parse any response body into an ApiError. Never throws. */
export function toApiError(status: number, body: unknown): ApiError {
  const envelope = (body as ErrorEnvelope | null)?.error;
  if (envelope && typeof envelope.code === "string") {
    return new ApiError(
      status,
      envelope.code,
      envelope.message || "Something went wrong.",
      envelope.retryable === true,
      envelope.fieldErrors ?? {}
    );
  }
  // Non-envelope body (shouldn't happen per contract, but stay robust)
  const fallback: Record<number, [string, string]> = {
    400: ["VALIDATION_ERROR", "That didn't look right."],
    401: ["AUTH_REQUIRED", "Please sign in to continue."],
    403: ["SIGNATURE_INVALID", "That link expired. Reload and try again."],
    404: ["NOT_FOUND", "Not found."],
    409: ["INVALID_STATE", "This changed. Reload it."],
    429: ["RATE_LIMITED", "Too many requests. Wait a moment."],
  };
  const [code, message] = fallback[status] ?? ["INTERNAL", "Something went wrong."];
  return new ApiError(status, code, message, status === 429 || status >= 500);
}

/** Human-readable message for every §5.6 code (screen agents: use this). */
export function friendlyMessage(code: string): string {
  const map: Record<string, string> = {
    AUTH_REQUIRED: "Please sign in to continue.",
    NOT_FOUND: "Not found, or it isn't yours.",
    VALIDATION_ERROR: "Check the highlighted fields.",
    CONSENT_REQUIRED: "Please confirm the photo consent checkbox.",
    APPROVAL_REQUIRED: "Please tick both approval checkboxes.",
    UNSUPPORTED_IMAGE: "Use a JPEG, PNG, HEIC or WEBP photo.",
    IMAGE_TOO_LARGE: "That photo is too large (max 15 MB).",
    MASK_EMPTY: "Brush the area you'd like to change.",
    MASK_TOO_LARGE: "Brush a smaller area (max 60% of the photo).",
    MASK_SIZE_MISMATCH: "The brush data didn't match the photo. Try again.",
    REVISION_CONFLICT: "This proposal changed. Reloading it.",
    INVALID_STATE: "That action isn't available right now. Reloading.",
    JOB_IN_PROGRESS: "Already working on it — resuming.",
    REVIEW_BLOCKED: "This concept can't be published. Regenerate it.",
    FLAGS_NOT_ACKNOWLEDGED: "Please acknowledge every flagged item.",
    SIGNATURE_INVALID: "That link expired. Reloading for a fresh one.",
    RATE_LIMITED: "Too many requests. Backing off.",
    PROVIDER_UNAVAILABLE: "The AI service is down. Try again.",
    PROVIDER_TIMEOUT: "The AI service timed out. Try again.",
    INVALID_PROVIDER_OUTPUT: "The AI returned something odd. Try again.",
    RENDER_FAILED: "The image edit failed. Your brushwork is kept — retry.",
    STALE_RESULT: "That result was for an older draft. Reloading.",
    INTERNAL: "Something went wrong on our side. Try again.",
  };
  return map[code] ?? "Something went wrong. Try again.";
}

/** What to show the user for an error: network failures say so honestly. */
export function displayMessage(e: ApiError): string {
  return e.network ? e.message : friendlyMessage(e.code);
}
