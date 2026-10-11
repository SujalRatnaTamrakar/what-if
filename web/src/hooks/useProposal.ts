import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

/** Single proposal by id. Refetch after job completion to pick up results. */
export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ["proposal", id],
    queryFn: () => api.getProposal(id as string),
    enabled: !!id,
    retry: false,
  });
}

/**
 * Invalidate a cached proposal (e.g. after STALE_RESULT or revision bump).
 * Stable identity: screens list it in effect deps, and a fresh function per
 * render made those effects re-run forever (invalidate → refetch → render).
 */
export function useInvalidateProposal() {
  const qc = useQueryClient();
  return useCallback((id: string) => qc.invalidateQueries({ queryKey: ["proposal", id] }), [qc]);
}
