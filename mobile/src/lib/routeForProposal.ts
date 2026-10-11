/**
 * mobile/src/lib/routeForProposal.ts — decides which step screen to open
 * for a draft, per §7.5 S8. Framework-free.
 */
import type { Proposal } from "../api/types";

export type ProposalRoute =
  | { screen: "suggest" }
  | { screen: "mask" }
  | { screen: "generate" }
  | { screen: "review" }
  | { screen: "detail" };

export function routeForProposal(p: Proposal): ProposalRoute {
  if (p.activeJob?.kind === "scene" || p.scene == null) return { screen: "suggest" };
  if (p.selectedOptionId == null) return { screen: "suggest" };
  if (p.maskAssetId == null) return { screen: "mask" };
  if (p.concept == null || p.activeJob?.kind === "preview") return { screen: "generate" };
  if (p.status === "draft" || p.status === "ready") return { screen: "review" };
  return { screen: "detail" };
}

/** expo-router href for a proposal route. */
export function hrefForProposal(id: string, route: ProposalRoute): string {
  switch (route.screen) {
    case "suggest":
      return `/proposal/${id}/suggest`;
    case "mask":
      return `/proposal/${id}/mask`;
    case "generate":
      return `/proposal/${id}/generate`;
    case "review":
      return `/proposal/${id}/review`;
    case "detail":
      return `/proposal/${id}`;
  }
}
