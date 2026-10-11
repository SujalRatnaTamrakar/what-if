/**
 * mobile/src/api/types.ts — TypeScript mirrors of the §5 contract objects.
 * Field names, enum values and shapes match §5.2/§5.3 EXACTLY. Do not rename.
 * Framework-free: no React imports (the web app reuses this file verbatim).
 */

// ---------------------------------------------------------------- enums (§5.2)
export type ProposalStatus = "draft" | "ready" | "published";
export type Category = "shade";
export type AssetKind = "source" | "mask" | "concept";
export type JobKind = "scene" | "preview";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type JobStage =
  | "queued"
  | "analyze"
  | "prompt"
  | "render"
  | "review"
  | "draft"
  | "finalize"
  | "done";
export type ReviewVerdict = "clear" | "needs_review" | "blocked";
export type FlagSeverity = "info" | "warning" | "blocking";
export type FlagCode =
  | "UNMASKED_CHANGE"
  | "REQUEST_MISMATCH"
  | "IMPLAUSIBLE_STRUCTURE"
  | "PEOPLE_VISIBLE"
  | "PLATE_VISIBLE"
  | "PRIVATE_INFO_VISIBLE"
  | "SAFETY_OR_COMPLIANCE_CLAIM"
  | "LOW_QUALITY_EDIT"
  | "REVIEW_UNAVAILABLE";
export type ProviderName = "ollama" | "gemini" | "comfyui" | "gemini_image" | "fake";

// ---------------------------------------------------------------- objects (§5.3)
export interface Asset {
  id: string;
  kind: AssetKind;
  width: number;
  height: number;
  mimeType: string;
  sha256: string;
  url: string;
  urlExpiresAt: string;
}

export interface Option {
  id: string;
  category: Category;
  title: string;
  description: string;
  editGoal: string;
  maskHint: string;
  requestDraft: string;
}

export interface Uncertainty {
  id: string;
  question: string;
}

export interface Scene {
  summary: string;
  observations: string[];
  uncertainties: Uncertainty[];
  preserve: string[];
  options: Option[];
  provider: string;
  model: string;
  analyzedAt: string;
}

export interface ReviewFlag {
  id: string;
  code: FlagCode;
  severity: FlagSeverity;
  message: string;
}

export interface Review {
  verdict: ReviewVerdict;
  flags: ReviewFlag[];
  outsideMaskChange: number;
  provider: string;
  model: string;
  reviewedAt: string;
}

export interface Generation {
  provider: string;
  model: string;
  seed: number | null;
  durationMs: number;
  workflowVersion: string;
  optionId: string;
  createdAt: string;
}

/** JobRef (embedded in Proposal) and Job (from GET /jobs/{id}) share this shape. */
export interface Job {
  id: string;
  proposalId: string;
  kind: JobKind;
  status: JobStatus;
  stage: JobStage;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  error: ErrorBody | null;
}

export interface Author {
  displayName: string;
  isViewer: boolean;
}

export interface Proposal {
  id: string;
  revision: number;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  author: Author;
  category: Category;
  placeLabel: string;
  problemText: string;
  title: string;
  changeRequest: string;
  recipientLabel: string;
  selectedOptionId: string | null;
  source: Asset;
  concept: Asset | null;
  maskAssetId: string | null;
  scene: Scene | null;
  review: Review | null;
  generation: Generation | null;
  activeJob: Job | null;
  aiDisclosure: string;
  supportCount: number;
  viewerHasSupported: boolean;
}

export interface ProposalSummary {
  id: string;
  status: ProposalStatus;
  title: string;
  placeLabel: string;
  category: Category;
  publishedAt: string | null;
  updatedAt: string;
  sourceThumbUrl: string;
  conceptThumbUrl: string | null;
  supportCount: number;
  viewerHasSupported: boolean;
  author: Author;
}

export interface SupportResult {
  proposalId: string;
  supportCount: number;
  viewerHasSupported: boolean;
  alreadySupported: boolean;
}

export interface Packet {
  url: string;
  expiresAt: string;
  exportedAt: string;
  supportCountAtExport: number;
}

export interface Me {
  id: string;
  displayName: string;
  createdAt: string;
}

export interface PublicConfig {
  apiVersion: string;
  categories: Category[];
  maxUploadBytes: number;
  maxImageEdge: number;
  aiDisclosure: string;
  providers: { scene: string; render: string; review: string };
}

// ---------------------------------------------------------------- mask (§5.7)
export interface MaskStroke {
  mode: "paint" | "erase";
  /** brush diameter as a fraction of image width */
  width: number;
  /** [x, y] pairs in [0,1], relative to the image content rect */
  points: [number, number][];
}

export interface MaskStrokes {
  version: 1;
  strokes: MaskStroke[];
}

// ---------------------------------------------------------------- error envelope (§5.6)
export interface ErrorBody {
  code: string;
  message: string;
  retryable: boolean;
  fieldErrors?: Record<string, string[]>;
}

export interface ErrorEnvelope {
  error: ErrorBody;
}

// ---------------------------------------------------------------- helpers used by ApiClient (§7.4)
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProposalPatch {
  title?: string;
  changeRequest?: string;
  placeLabel?: string;
  recipientLabel?: string;
  selectedOptionId?: string;
}

export interface PublishBody {
  expectedRevision: number;
  approveText: true;
  approveConcept: true;
  acknowledgedFlagIds: string[];
}

export interface CreateProposalInput {
  photoUri: string;
  mimeType: string;
  placeLabel: string;
  problemText: string;
  category: "shade";
  consent: true;
}
