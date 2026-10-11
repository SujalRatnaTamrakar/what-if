/**
 * web/src/api/ApiClient.ts — the client interface, VERBATIM from §7.4.
 * Identical in fixture and live implementations. Framework-free.
 */
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

export interface ApiClient {
  getConfig(): Promise<PublicConfig>;
  getMe(): Promise<Me>;
  updateMe(body: { displayName: string }): Promise<Me>;
  createProposal(
    input: CreateProposalInput
  ): Promise<{ proposal: Proposal; jobId: string }>;
  listProposals(q: {
    scope: "public" | "mine";
    cursor?: string;
    limit?: number;
  }): Promise<Page<ProposalSummary>>;
  getProposal(id: string): Promise<Proposal>;
  updateProposal(
    id: string,
    body: ProposalPatch & { expectedRevision: number }
  ): Promise<Proposal>;
  reanalyze(
    id: string,
    expectedRevision: number
  ): Promise<{ jobId: string; proposalId: string }>;
  saveMask(
    id: string,
    body: { expectedRevision: number; strokes: MaskStrokes }
  ): Promise<{ assetId: string; revision: number }>;
  requestPreview(
    id: string,
    body: { optionId: string; maskAssetId: string; expectedRevision: number },
    idempotencyKey: string
  ): Promise<{ jobId: string; proposalId: string }>;
  getJob(id: string): Promise<Job>;
  publish(id: string, body: PublishBody): Promise<Proposal>;
  support(id: string): Promise<SupportResult>;
  unsupport(id: string): Promise<SupportResult>;
  exportPacket(id: string): Promise<Packet>;
}
