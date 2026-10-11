/**
 * mobile/src/api/fixtureClient.ts — in-memory ApiClient for fixture mode.
 * Per §7.4 fixtureClient rules:
 * - 300–800 ms artificial delay on every call
 * - job stage simulation: each getJob() advances one stage
 * - support idempotency per fixture user
 * - configurable failure via setFixtureFailure() (Profile screen toggle)
 * - NEVER touches the network
 * Framework-free.
 */
import type { ApiClient } from "./ApiClient";
import { ApiError } from "./errors";
import type {
  CreateProposalInput,
  Job,
  JobStage,
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

import configJson from "../fixtures/config.json";
import meJson from "../fixtures/me.json";
import proposalCreatedJson from "../fixtures/proposal_created.json";
import proposalWithSceneJson from "../fixtures/proposal_with_scene.json";
import proposalReadyJson from "../fixtures/proposal_ready.json";
import proposalPublishedJson from "../fixtures/proposal_published.json";
import maskSavedJson from "../fixtures/mask_saved.json";
import previewAcceptedJson from "../fixtures/preview_accepted.json";
import jobPreviewFailedJson from "../fixtures/job_preview_failed.json";
import supportFirstJson from "../fixtures/support_first.json";
import supportRepeatJson from "../fixtures/support_repeat.json";
import packetJson from "../fixtures/packet.json";
import feedPublicJson from "../fixtures/feed_public.json";
import feedMineJson from "../fixtures/feed_mine.json";
import errorProviderUnavailableJson from "../fixtures/error_provider_unavailable.json";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
/** Fixture JSON → typed Proposal (some fixtures wrap it, some don't). */
const asProposal = (v: unknown): Proposal => clone(v as Proposal);
const delay = () =>
  new Promise<void>((r) => setTimeout(r, 300 + Math.random() * 500));
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

/** Failure injection for the Profile screen's dev toggles (§7.5 S9). */
export type FixtureFailure = "scene" | "render" | null;
let fixtureFailure: FixtureFailure = null;
export function setFixtureFailure(f: FixtureFailure): void {
  fixtureFailure = f;
}
export function getFixtureFailure(): FixtureFailure {
  return fixtureFailure;
}

const SCENE_STAGES: JobStage[] = ["queued", "analyze", "done"];
const PREVIEW_STAGES: JobStage[] = ["queued", "prompt", "render", "review", "draft", "finalize", "done"];

// ---------------------------------------------------------------- state
let proposal: Proposal = asProposal(
  (proposalCreatedJson as { proposal: unknown }).proposal
);
let displayName: string = (meJson as Me).displayName;
let supported = false;
let supportCount = (supportFirstJson as SupportResult).supportCount;

interface SimJob {
  id: string;
  kind: "scene" | "preview";
  stageIndex: number;
  failed: boolean;
  errorCode: string | null;
}
let activeJob: SimJob | null = {
  id: "j1",
  kind: "scene",
  stageIndex: 0,
  failed: false,
  errorCode: null,
};

function resetFlow(): void {
  proposal = asProposal((proposalCreatedJson as { proposal: unknown }).proposal);
  supported = false;
  supportCount = (supportFirstJson as SupportResult).supportCount;
  activeJob = { id: "j1", kind: "scene", stageIndex: 0, failed: false, errorCode: null };
}

function toJob(sim: SimJob): Job {
  const stages = sim.kind === "scene" ? SCENE_STAGES : PREVIEW_STAGES;
  const stage = stages[sim.stageIndex];
  const done = stage === "done";
  const base: Job = {
    id: sim.id,
    proposalId: proposal.id,
    kind: sim.kind,
    status: sim.failed ? "failed" : done ? "succeeded" : stage === "queued" ? "queued" : "running",
    stage,
    attempt: sim.failed ? 2 : 1,
    createdAt: proposal.createdAt,
    updatedAt: nowIso(),
    error: null,
  };
  if (sim.failed) {
    const err =
      sim.errorCode === "RENDER_FAILED"
        ? (jobPreviewFailedJson as { error: { code: string; message: string; retryable: boolean } }).error
        : (errorProviderUnavailableJson as { error: { code: string; message: string; retryable: boolean } }).error;
    base.error = { ...err };
  }
  return base;
}

/** Advance the simulated job one stage; apply side effects on completion. */
function advanceJob(sim: SimJob): Job {
  const stages = sim.kind === "scene" ? SCENE_STAGES : PREVIEW_STAGES;
  if (!sim.failed && sim.stageIndex < stages.length - 1) {
    sim.stageIndex += 1;
    const stage = stages[sim.stageIndex];
    // Failure injection: scene fails at analyze, preview fails at render.
    if (
      (fixtureFailure === "scene" && sim.kind === "scene" && stage === "analyze") ||
      (fixtureFailure === "render" && sim.kind === "preview" && stage === "render")
    ) {
      sim.failed = true;
      sim.errorCode =
        fixtureFailure === "render" ? "RENDER_FAILED" : "PROVIDER_UNAVAILABLE";
      proposal.activeJob = toJob(sim);
      return toJob(sim);
    }
  }
  const job = toJob(sim);
  proposal.activeJob = sim.failed || job.status !== "succeeded" ? job : null;
  if (job.status === "succeeded") {
    if (sim.kind === "scene") {
      const withScene = asProposal(proposalWithSceneJson);
      proposal = {
        ...proposal,
        scene: withScene.scene,
        revision: proposal.revision + 1,
        updatedAt: nowIso(),
        activeJob: null,
      };
    } else {
      const ready = asProposal(proposalReadyJson);
      proposal = {
        ...proposal,
        concept: ready.concept,
        review: ready.review,
        generation: ready.generation,
        title: ready.title,
        changeRequest: ready.changeRequest,
        status: "ready",
        revision: proposal.revision + 1,
        updatedAt: nowIso(),
        activeJob: null,
      };
    }
    activeJob = null;
  }
  return job;
}

// ---------------------------------------------------------------- client
export const fixtureClient: ApiClient = {
  async getConfig(): Promise<PublicConfig> {
    await delay();
    return clone(configJson as PublicConfig);
  },

  async getMe(): Promise<Me> {
    await delay();
    return { ...(clone(meJson as Me)), displayName };
  },

  async updateMe(body: { displayName: string }): Promise<Me> {
    await delay();
    if (!body.displayName || body.displayName.length > 40) {
      throw new ApiError(400, "VALIDATION_ERROR", "Display name must be 1–40 characters.", false, {
        displayName: ["Must be 1–40 characters."],
      });
    }
    displayName = body.displayName;
    return { ...(clone(meJson as Me)), displayName };
  },

  async createProposal(
    _input: CreateProposalInput
  ): Promise<{ proposal: Proposal; jobId: string }> {
    await delay();
    resetFlow();
    return { proposal: clone(proposal), jobId: "j1" };
  },

  async listProposals(q: {
    scope: "public" | "mine";
    cursor?: string;
    limit?: number;
  }): Promise<Page<ProposalSummary>> {
    await delay();
    void q;
    const feed =
      q.scope === "public"
        ? (feedPublicJson as Page<ProposalSummary>)
        : (feedMineJson as Page<ProposalSummary>);
    return clone(feed);
  },

  async getProposal(_id: string): Promise<Proposal> {
    await delay();
    return clone(proposal);
  },

  async updateProposal(
    _id: string,
    body: ProposalPatch & { expectedRevision: number }
  ): Promise<Proposal> {
    await delay();
    if (body.expectedRevision !== proposal.revision) {
      throw new ApiError(409, "REVISION_CONFLICT", "This proposal changed. Reload it.", false);
    }
    if (proposal.status === "published") {
      throw new ApiError(409, "INVALID_STATE", "Published proposals can't be edited.", false);
    }
    const { expectedRevision: _er, ...patch } = body;
    if (
      patch.selectedOptionId &&
      proposal.scene &&
      !proposal.scene.options.some((o) => o.id === patch.selectedOptionId)
    ) {
      throw new ApiError(400, "VALIDATION_ERROR", "Unknown option.", false);
    }
    proposal = {
      ...proposal,
      ...patch,
      revision: proposal.revision + 1,
      updatedAt: nowIso(),
    };
    return clone(proposal);
  },

  async reanalyze(
    _id: string,
    _expectedRevision: number
  ): Promise<{ jobId: string; proposalId: string }> {
    await delay();
    proposal = { ...proposal, scene: null, activeJob: null };
    activeJob = { id: "j1", kind: "scene", stageIndex: 0, failed: false, errorCode: null };
    proposal.activeJob = toJob(activeJob);
    return { jobId: "j1", proposalId: proposal.id };
  },

  async saveMask(
    _id: string,
    body: { expectedRevision: number; strokes: MaskStrokes }
  ): Promise<{ assetId: string; revision: number }> {
    await delay();
    if (body.expectedRevision !== proposal.revision) {
      throw new ApiError(409, "REVISION_CONFLICT", "This proposal changed. Reload it.", false);
    }
    const hasPaint = body.strokes.strokes.some((s) => s.mode === "paint");
    if (!hasPaint) {
      throw new ApiError(400, "MASK_EMPTY", "Brush the area you'd like to change.", false);
    }
    proposal = {
      ...proposal,
      maskAssetId: (maskSavedJson as { assetId: string }).assetId,
      status: proposal.status === "ready" ? "draft" : proposal.status,
      revision: proposal.revision + 1,
      updatedAt: nowIso(),
    };
    return { assetId: proposal.maskAssetId as string, revision: proposal.revision };
  },

  async requestPreview(
    _id: string,
    body: { optionId: string; maskAssetId: string; expectedRevision: number },
    _idempotencyKey: string
  ): Promise<{ jobId: string; proposalId: string }> {
    await delay();
    if (body.expectedRevision !== proposal.revision) {
      throw new ApiError(409, "REVISION_CONFLICT", "This proposal changed. Reload it.", false);
    }
    if (!proposal.scene) {
      throw new ApiError(409, "INVALID_STATE", "Analyze the scene first.", false);
    }
    activeJob = { id: "j2", kind: "preview", stageIndex: 0, failed: false, errorCode: null };
    proposal = { ...proposal, status: "draft", activeJob: toJob(activeJob) };
    const accepted = previewAcceptedJson as { jobId: string; proposalId: string };
    return { jobId: accepted.jobId, proposalId: proposal.id };
  },

  async getJob(id: string): Promise<Job> {
    await delay();
    if (!activeJob || activeJob.id !== id) {
      // Return the last known terminal state shape for unknown ids in fixture mode.
      throw new ApiError(404, "NOT_FOUND", "Job not found.", false);
    }
    return advanceJob(activeJob);
  },

  async publish(_id: string, body: PublishBody): Promise<Proposal> {
    await delay();
    if (body.expectedRevision !== proposal.revision) {
      throw new ApiError(409, "REVISION_CONFLICT", "This proposal changed. Reload it.", false);
    }
    if (!body.approveText || !body.approveConcept) {
      throw new ApiError(400, "APPROVAL_REQUIRED", "Please tick both approval checkboxes.", false);
    }
    if (proposal.review?.verdict === "blocked") {
      throw new ApiError(409, "REVIEW_BLOCKED", "This concept can't be published. Regenerate it.", false);
    }
    const unacked = (proposal.review?.flags ?? []).filter(
      (f) => f.severity === "warning" && !body.acknowledgedFlagIds.includes(f.id)
    );
    if (unacked.length > 0) {
      throw new ApiError(409, "FLAGS_NOT_ACKNOWLEDGED", "Please acknowledge every flagged item.", false);
    }
    const published = asProposal(proposalPublishedJson);
    proposal = {
      ...proposal,
      title: proposal.title || published.title,
      changeRequest: proposal.changeRequest || published.changeRequest,
      status: "published",
      publishedAt: nowIso(),
      revision: proposal.revision + 1,
      updatedAt: nowIso(),
    };
    return clone(proposal);
  },

  async support(_id: string): Promise<SupportResult> {
    await delay();
    if (supported) {
      return { ...(clone(supportRepeatJson as SupportResult)), supportCount };
    }
    supported = true;
    supportCount += 1;
    proposal = { ...proposal, supportCount, viewerHasSupported: true };
    return {
      ...(clone(supportFirstJson as SupportResult)),
      supportCount,
      alreadySupported: false,
    };
  },

  async unsupport(_id: string): Promise<SupportResult> {
    await delay();
    if (supported) {
      supported = false;
      supportCount = Math.max(0, supportCount - 1);
      proposal = { ...proposal, supportCount, viewerHasSupported: false };
    }
    return {
      proposalId: proposal.id,
      supportCount,
      viewerHasSupported: false,
      alreadySupported: false,
    };
  },

  async exportPacket(_id: string): Promise<Packet> {
    await delay();
    return { ...(clone(packetJson as Packet)), supportCountAtExport: supportCount };
  },
};
