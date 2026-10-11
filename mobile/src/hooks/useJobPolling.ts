import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { config } from "../config";
import type { JobStatus } from "../api/types";

const TERMINAL: JobStatus[] = ["succeeded", "failed"];

/**
 * Poll GET /jobs/{jobId} every config.jobPollMs until the job reaches a
 * terminal state (succeeded/failed), per §7.7 step 4. Stops automatically.
 */
export function useJobPolling(jobId: string | undefined, pollMs = config.jobPollMs) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.getJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL.includes(status)) return false;
      return pollMs;
    },
    retry: false,
  });
}
