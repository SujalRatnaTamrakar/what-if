import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

/** Current user (GET /me). Requires login; disabled until then. */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
