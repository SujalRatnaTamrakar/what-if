/**
 * web/src/api/liveClient.ts — fetch-based ApiClient against the Django API.
 * Per §7.4: one request() helper, Authorization when a token exists,
 * error-envelope → ApiError, multipart upload without manual Content-Type,
 * one silent 401 refresh then onAuthRequired.
 * Framework-free: no React imports. Auth hooks are injected by AuthProvider.
 */
import { config } from "../config";
import type { ApiClient } from "./ApiClient";
import { ApiError, toApiError } from "./errors";
import type {
  CreateProposalInput,
  Job,
  MaskStrokes,
  Me,
  Page,
  Packet,
  Proposal,
  ProposalPatch,
  ProposalSummary,
  PublicConfig,
  PublishBody,
  SupportResult,
} from "./types";

interface AuthHooks {
  getToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
  onAuthRequired: () => void;
}

let hooks: AuthHooks = {
  getToken: async () => null,
  refreshToken: async () => null,
  onAuthRequired: () => {},
};

/** Called once by AuthProvider on mount. */
export function setAuthHooks(h: Partial<AuthHooks>): void {
  hooks = { ...hooks, ...h };
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown; // JSON-serializable, or FormData for multipart
  headers?: Record<string, string>;
  /** retry once after a silent refresh on 401 */
  _retried?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const token = await hooks.getToken().catch(() => null);
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const isFormData =
    typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body:
        opts.body === undefined
          ? undefined
          : isFormData
            ? (opts.body as FormData)
            : JSON.stringify(opts.body),
    });
  } catch (e) {
    // Network-level failure (offline, DNS, tunnel down, body couldn't be built)
    if (config.isDev) console.warn(`[api] ${method} ${path} failed before a response:`, e);
    throw new ApiError(0, "PROVIDER_UNAVAILABLE", "Couldn't reach the server. Check your connection and try again.", true, {}, true);
  }

  if (res.status === 401 && !opts._retried) {
    const refreshed = await hooks.refreshToken().catch(() => null);
    if (refreshed) {
      return request<T>(path, { ...opts, _retried: true });
    }
    hooks.onAuthRequired();
  }

  let body: unknown = null;
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

const photoName = (mimeType: string) =>
  `photo.${mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg"}`;

/**
 * The photo as a multipart part. The browser's fetch wants a real Blob:
 * use the picked File when we have it, otherwise read the object URL.
 */
async function photoPart(input: CreateProposalInput): Promise<Blob> {
  if (input.photoFile) return input.photoFile;
  const blob = await (await fetch(input.photoUri)).blob();
  return blob.type ? blob : new Blob([blob], { type: input.mimeType });
}

const q = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const liveClient: ApiClient = {
  getConfig: () => request<PublicConfig>("/config"),
  getMe: () => request<Me>("/me"),
  updateMe: (body) => request<Me>("/me", { method: "PATCH", body }),

  createProposal: async (input: CreateProposalInput) => {
    const form = new FormData();
    // Multipart photo: do NOT set Content-Type manually (boundary is auto-set).
    form.append("photo", await photoPart(input), photoName(input.mimeType));
    form.append("placeLabel", input.placeLabel);
    form.append("problemText", input.problemText);
    form.append("category", input.category);
    form.append("consent", "true");
    return request<{ proposal: Proposal; jobId: string }>("/proposals", {
      method: "POST",
      body: form,
    });
  },

  listProposals: ({ scope, cursor, limit }) =>
    request<Page<ProposalSummary>>(
      `/proposals${q({ scope, cursor, limit })}`
    ),

  getProposal: (id) => request<Proposal>(`/proposals/${encodeURIComponent(id)}`),

  updateProposal: (id, body: ProposalPatch & { expectedRevision: number }) =>
    request<Proposal>(`/proposals/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }),

  reanalyze: (id, expectedRevision) =>
    request<{ jobId: string; proposalId: string }>(
      `/proposals/${encodeURIComponent(id)}/analyze`,
      { method: "POST", body: { expectedRevision } }
    ),

  saveMask: (id, body: { expectedRevision: number; strokes: MaskStrokes }) =>
    request<{ assetId: string; revision: number }>(
      `/proposals/${encodeURIComponent(id)}/mask`,
      { method: "POST", body }
    ),

  requestPreview: (
    id,
    body: { optionId: string; maskAssetId: string; expectedRevision: number },
    idempotencyKey: string
  ) =>
    request<{ jobId: string; proposalId: string }>(
      `/proposals/${encodeURIComponent(id)}/preview`,
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
      }
    ),

  getJob: (id) => request<Job>(`/jobs/${encodeURIComponent(id)}`),

  publish: (id, body: PublishBody) =>
    request<Proposal>(`/proposals/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      body,
    }),

  support: (id) =>
    request<SupportResult>(`/proposals/${encodeURIComponent(id)}/support`, {
      method: "POST",
    }),

  unsupport: (id) =>
    request<SupportResult>(`/proposals/${encodeURIComponent(id)}/support`, {
      method: "DELETE",
    }),

  exportPacket: (id) =>
    request<Packet>(`/proposals/${encodeURIComponent(id)}/packet`, {
      method: "POST",
    }),
};
