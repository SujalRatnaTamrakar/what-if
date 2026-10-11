import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Proposal, SupportResult } from "../api/types";

/**
 * Support / unsupport a proposal (§7.5 S6).
 * Optimistic update on tap, then REPLACED with the server value —
 * double-tapping never shows count + 2 (the server is idempotent).
 */
export function useSupport(proposalId: string) {
  const qc = useQueryClient();
  const key = ["proposal", proposalId];

  return useMutation<SupportResult, Error, boolean, { prev: Proposal | undefined }>({
    mutationFn: (unsupport) =>
      unsupport ? api.unsupport(proposalId) : api.support(proposalId),

    onMutate: async (unsupport = false) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Proposal>(key);
      if (prev && !unsupport && !prev.viewerHasSupported) {
        qc.setQueryData<Proposal>(key, {
          ...prev,
          supportCount: prev.supportCount + 1,
          viewerHasSupported: true,
        });
      }
      if (prev && unsupport && prev.viewerHasSupported) {
        qc.setQueryData<Proposal>(key, {
          ...prev,
          supportCount: Math.max(0, prev.supportCount - 1),
          viewerHasSupported: false,
        });
      }
      return { prev };
    },

    onSuccess: (result) => {
      // Server value wins — this is what makes repeats safe.
      qc.setQueryData<Proposal>(key, (old) =>
        old
          ? {
              ...old,
              supportCount: result.supportCount,
              viewerHasSupported: result.viewerHasSupported,
            }
          : old
      );
      qc.invalidateQueries({ queryKey: ["feed"] });
    },

    onError: (_e, _v, context) => {
      if (context?.prev) qc.setQueryData<Proposal>(key, context.prev);
    },
  });
}
