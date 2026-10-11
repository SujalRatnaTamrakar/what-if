/**
 * mobile/app/proposal/[id]/generate.tsx — S4 Generate (§7.5).
 *
 * On entry, if no active preview job exists: api.requestPreview with a fresh
 * expo-crypto UUID Idempotency-Key kept in a ref (StrictMode-safe), then
 * refetch the proposal (E11 sets status=draft without a revision bump).
 * Shows JobStageList (prompt → render → review → draft → finalize) + elapsed
 * time + the honest "renders take 30–120s" note. On failure: error + Retry
 * (new key) + Adjust brush; STALE_RESULT reloads the proposal. On success →
 * /proposal/[id]/review. Reopening mid-job resumes via proposal.activeJob.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "../../../src/components/Text";
import { useTopInset } from "../../../src/lib/useTopInset";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { api } from "../../../src/api";
import { useInvalidateProposal, useProposal } from "../../../src/hooks/useProposal";
import { useJobPolling } from "../../../src/hooks/useJobPolling";
import { ErrorState, asApiError } from "../../../src/components/ErrorState";
import { JobStageList } from "../../../src/components/JobStageList";
import { PrimaryButton, ACCENT, INK, MUTED, PAPER } from "../../../src/components/PrimaryButton";
import { ApiError } from "../../../src/api/errors";
import type { JobStage } from "../../../src/api/types";

const PREVIEW_STAGES: JobStage[] = [
  "queued",
  "prompt",
  "render",
  "review",
  "draft",
  "finalize",
  "done",
];

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function GenerateScreen() {
  const top = useTopInset();
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposalQuery = useProposal(id);
  const invalidateProposal = useInvalidateProposal();

  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Guards: one requestPreview per screen lifetime (StrictMode double-effect),
  // unless the user explicitly retries.
  const startedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const proposal = proposalQuery.data;
  const jobQuery = useJobPolling(jobId);
  const job = jobQuery.data;

  const startPreview = async () => {
    const p = proposalQuery.data;
    if (!p || !p.scene || !p.selectedOptionId || !p.maskAssetId) return;
    startedRef.current = true;
    setRequesting(true);
    setError(null);
    try {
      const key = Crypto.randomUUID();
      const r = await api.requestPreview(
        id as string,
        {
          optionId: p.selectedOptionId,
          maskAssetId: p.maskAssetId,
          expectedRevision: p.revision,
        },
        key
      );
      startTimeRef.current = Date.now();
      setJobId(r.jobId);
      // E11 flips status to draft WITHOUT a revision bump — refetch (§7.5 S4).
      invalidateProposal(id as string);
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === "REVISION_CONFLICT") {
        invalidateProposal(id as string);
      }
      setError(apiError);
      startedRef.current = false;
    } finally {
      setRequesting(false);
    }
  };

  // Kick off on entry (or resume).
  useEffect(() => {
    const p = proposal;
    if (!p || startedRef.current) return;
    const aj = p.activeJob;
    if (aj && aj.kind === "preview") {
      if (aj.status === "queued" || aj.status === "running") {
        // Reopened mid-job: resume polling (§7.5 S4).
        startedRef.current = true;
        startTimeRef.current = Date.now();
        setJobId(aj.id);
        return;
      }
      if (aj.status === "succeeded") {
        router.replace({
          pathname: "/proposal/[id]/review",
          params: { id: id as string },
        });
        return;
      }
      // failed: let the user retry below; don't auto-restart.
      startedRef.current = true;
      setJobId(aj.id);
      return;
    }
    // Generate is only reachable with a scene; a sceneless entry (e.g. a
    // stale deep link) belongs on suggest, not on a dead error card.
    if (!p.scene) {
      router.replace({
        pathname: "/proposal/[id]/suggest",
        params: { id: id as string },
      });
      return;
    }
    void startPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id, proposal?.activeJob?.id, proposal?.activeJob?.status]);

  // Elapsed timer while the job runs.
  useEffect(() => {
    if (!jobId || job?.status === "succeeded" || job?.status === "failed") return;
    const t = setInterval(
      () => setElapsedMs(Date.now() - startTimeRef.current),
      1000
    );
    return () => clearInterval(t);
  }, [jobId, job?.status]);

  // Success → review. Failure → error UI (STALE_RESULT reloads instead).
  useEffect(() => {
    if (job?.status === "succeeded") {
      invalidateProposal(id as string);
      router.replace({
        pathname: "/proposal/[id]/review",
        params: { id: id as string },
      });
    } else if (job?.status === "failed" && job.error) {
      if (job.error.code === "STALE_RESULT") {
        invalidateProposal(id as string);
        setError(
          new ApiError(409, "STALE_RESULT", job.error.message, false)
        );
      } else {
        setError(
          new ApiError(0, job.error.code, job.error.message, job.error.retryable)
        );
      }
    }
  }, [job?.status, id, invalidateProposal, job]);

  const retry = () => {
    startedRef.current = false;
    setError(null);
    setJobId(undefined);
    setElapsedMs(0);
    // startPreview reads the latest proposal from the query cache.
    void startPreview();
  };

  const adjustBrush = () => {
    // Back to the existing mask screen — its strokes stay in local state
    // (§7.5 S3) so the user can adjust rather than start over.
    router.back();
  };

  if (proposalQuery.isLoading || requesting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.hint}>Starting the edit…</Text>
      </View>
    );
  }
  if (proposalQuery.isError || !proposal) {
    return (
      <View style={styles.center}>
        <ErrorState
          error={proposalQuery.error}
          onRetry={() => proposalQuery.refetch()}
        />
      </View>
    );
  }

  const missingPrereqs = !proposal.scene || !proposal.selectedOptionId || !proposal.maskAssetId;

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.content}>
        <Text style={styles.heading}>Creating your concept</Text>

        {missingPrereqs ? (
          <ErrorState
            error={new Error("Pick an option and brush an area first.")}
          />
        ) : error ? (
          <View style={styles.card}>
            <ErrorState error={error} />
            <View style={styles.retryRow}>
              <PrimaryButton
                title="Retry"
                onPress={retry}
                style={styles.retryBtn}
              />
              <PrimaryButton
                title="Adjust brush"
                variant="secondary"
                onPress={adjustBrush}
                style={styles.retryBtn}
              />
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <JobStageList
              stages={PREVIEW_STAGES}
              current={job?.stage ?? "queued"}
            />
            <Text style={styles.elapsed}>
              ⏱ {formatElapsed(elapsedMs)} elapsed
            </Text>
            <Text style={styles.honest}>
              Renders take 30–120 seconds. You can leave and come back — the
              job keeps running.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER },
  content: { flex: 1, padding: 20 },
  center: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  heading: { fontSize: 22, fontWeight: "800", color: INK, marginBottom: 16 },
  hint: { color: MUTED, fontSize: 14, marginTop: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDE6D6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  elapsed: { fontSize: 13, color: MUTED, marginTop: 8, fontVariant: ["tabular-nums"] },
  honest: { fontSize: 13, color: MUTED, marginTop: 8, lineHeight: 19 },
  retryRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  retryBtn: { flex: 1 },
});
