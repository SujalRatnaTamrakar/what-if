import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../api";

/**
 * Paginated proposal feed (E6). Pull-to-refresh + infinite scroll via
 * nextCursor, per §7.5 S7/S8.
 */
export function useFeed(scope: "public" | "mine", limit = 20) {
  return useInfiniteQuery({
    queryKey: ["feed", scope],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.listProposals({ scope, cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
}
