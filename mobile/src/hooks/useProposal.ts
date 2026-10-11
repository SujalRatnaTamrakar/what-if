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

/** Invalidate a cached proposal (e.g. after STALE_RESULT or revision bump). */
export function useInvalidateProposal() {
  const qc = useQueryClient();
  return (id: string) => qc.invalidateQueries({ queryKey: ["proposal", id] });
}
