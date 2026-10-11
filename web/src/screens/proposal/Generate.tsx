/**
 * web/src/screens/proposal/Generate.tsx — S4 Generate (§7.5), studio step 4.
 *
 * On entry, if no active preview job exists: api.requestPreview with a fresh
 * UUID Idempotency-Key (StrictMode-safe via startedRef), then refetch the
 * proposal (E11 sets status=draft without a revision bump). Shows the photo
 * with your brush glowing under an AI scan, the live stage timeline, elapsed
 * time and the honest "30–120s" note. On failure: error + Retry (new key) +
 * Adjust brush; STALE_RESULT reloads the proposal. On success →
 * /proposal/[id]/review. Reopening mid-job resumes via activeJob.
 */
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { COLUMN, CenterSpinner, Text, View, absoluteFill, styleSheet } from "../../ui/primitives";
import { Display } from "../../ui/Display";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Dock } from "../../ui/Dock";
import { StepProgress } from "../../ui/StepProgress";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ScanningPhoto } from "../../components/ScanningPhoto";
import { JobStageList } from "../../components/JobStageList";
import { ErrorState, asApiError } from "../../components/ErrorState";
import { BrushIcon, ClockIcon, WandIcon } from "../../components/icons";
import { api } from "../../api";
import { ApiError } from "../../api/errors";
import { useInvalidateProposal, useProposal } from "../../hooks/useProposal";
import { useJobPolling } from "../../hooks/useJobPolling";
import { getMaskDraft } from "../../lib/maskDraft";
import { randomId, useRouter } from "../../lib/nav";
import { theme } from "../../theme";
import type { JobStage, MaskStrokes } from "../../api/types";

const PREVIEW_STAGES: JobStage[] = ["queued", "prompt", "render", "review", "draft", "finalize", "done"];

const TIPS = [
  "Only the area you brushed is changed — the rest of your photo stays real.",
  "An AI reviewer double-checks the edit and flags anything odd.",
  "AI drafts a polite request to the city you can edit before publishing.",
  "Every concept is labeled as an AI illustration, never a design.",
];

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Your brush strokes drawn in the image's own coordinate space. */
function StrokeOverlay({ strokes, aspect }: { strokes: MaskStrokes; aspect: number }) {
  const H = 100 / aspect;
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true" style={{ ...absoluteFill, width: "100%", height: "100%", pointerEvents: "none" }}>
      {strokes.strokes
        .filter((s) => s.mode === "paint")
        .map((s, i) => {
          const pts = s.points.map(([x, y]) => [x * 100, y * H] as const);
          const w = s.width * 100;
          if (pts.length === 1) return <circle key={i} cx={pts[0][0]} cy={pts[0][1]} r={w / 2} fill="rgba(240,160,40,0.5)" />;
          return (
            <path
              key={i}
              d={"M " + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")}
              stroke="rgba(240,160,40,0.5)"
              strokeWidth={w}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          );
        })}
    </svg>
  );
}

export default function GenerateScreen() {
  const { id = "" } = useParams<{ id: string }>();
  const router = useRouter();
  const proposalQuery = useProposal(id);
  const invalidateProposal = useInvalidateProposal();

  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tip, setTip] = useState(0);

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
      const key = randomId();
      const r = await api.requestPreview(
        id,
        { optionId: p.selectedOptionId, maskAssetId: p.maskAssetId, expectedRevision: p.revision },
        key
      );
      startTimeRef.current = Date.now();
      setJobId(r.jobId);
      // E11 flips status to draft WITHOUT a revision bump — refetch (§7.5 S4).
      invalidateProposal(id);
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === "REVISION_CONFLICT") invalidateProposal(id);
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
        startedRef.current = true;
        startTimeRef.current = Date.now();
        setJobId(aj.id);
        return;
      }
      if (aj.status === "succeeded" && p.concept) {
        startedRef.current = true;
        router.replace(`/proposal/${id}/review`);
        return;
      }
      if (aj.status === "failed") {
        // Let the user retry below; don't auto-restart.
        startedRef.current = true;
        setJobId(aj.id);
        return;
      }
    }
    if (!p.scene) {
      router.replace(`/proposal/${id}/suggest`);
      return;
    }
    void startPreview();
    // Re-run when the prerequisites arrive: the cached proposal from the Brush
    // step can predate saveMask, so maskAssetId may only appear on refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id, proposal?.activeJob?.id, proposal?.activeJob?.status, proposal?.maskAssetId, proposal?.selectedOptionId, !!proposal?.scene]);

  // Elapsed timer + rotating tips while the job runs.
  useEffect(() => {
    if (!jobId || job?.status === "succeeded" || job?.status === "failed") return;
    const t = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 1000);
    const r = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 5000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [jobId, job?.status]);

  // Success → review (exactly once per job). Failure → error UI
  // (STALE_RESULT reloads instead).
  const navigatedForJob = useRef<string | null>(null);
  useEffect(() => {
    if (job?.status === "succeeded") {
      if (navigatedForJob.current === job.id) return;
      navigatedForJob.current = job.id;
      // Wait for the fresh proposal (with its concept) so Review never sees a
      // stale, concept-less cache entry and bounces back here.
      void invalidateProposal(id).finally(() => router.replace(`/proposal/${id}/review`));
    } else if (job?.status === "failed" && job.error) {
      if (job.error.code === "STALE_RESULT") {
        invalidateProposal(id);
        setError(new ApiError(409, "STALE_RESULT", job.error.message, false));
      } else {
        setError(new ApiError(0, job.error.code, job.error.message, job.error.retryable));
      }
    }
  }, [job?.status, id, invalidateProposal, job, router]);

  const retry = () => {
    startedRef.current = false;
    setError(null);
    setJobId(undefined);
    setElapsedMs(0);
    void startPreview();
  };

  const adjustBrush = () => {
    // Brush strokes persist in maskDraft, so the user adjusts, not restarts.
    if (router.canGoBack()) router.back();
    else router.replace(`/proposal/${id}/mask`);
  };

  if (proposalQuery.isLoading) return <CenterSpinner />;
  if (proposalQuery.isError || !proposal) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Imagine" />
        <View style={{ padding: 20, width: "100%", maxWidth: COLUMN, alignSelf: "center" }}>
          <ErrorState error={proposalQuery.error} onRetry={() => proposalQuery.refetch()} />
        </View>
      </View>
    );
  }

  const missingPrereqs = !proposal.scene || !proposal.selectedOptionId || !proposal.maskAssetId;
  const option = proposal.scene?.options.find((o) => o.id === proposal.selectedOptionId);
  const aspect = proposal.source.width / proposal.source.height;
  const strokes = getMaskDraft(id);
  const running = !error && !missingPrereqs;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Imagine" />
      <StepProgress step={4} />
      <View className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <View style={styles.content}>
          <Display size={26}>
            {error ? "That didn't work." : "Imagining "}
            {error ? null : (
              <Display size={26} italic color={theme.colors.accent}>
                what if…
              </Display>
            )}
          </Display>
          {option ? <Text style={styles.option}>{option.title}</Text> : null}

          <View style={styles.photo}>
            <ScanningPhoto
              uri={proposal.source.url}
              aspectRatio={aspect}
              label={requesting ? "Starting the edit…" : "Gemini is painting your change…"}
              active={running}
              tint="sun"
            >
              {strokes ? <StrokeOverlay strokes={strokes} aspect={aspect} /> : null}
            </ScanningPhoto>
          </View>

          {missingPrereqs ? (
            <ErrorState error={new Error("Pick an option and brush an area first.")} />
          ) : error ? (
            <ErrorState error={error} />
          ) : (
            <Card>
              <View style={styles.timeRow}>
                <ClockIcon size={16} color={theme.colors.accent} />
                <Text style={styles.elapsed}>{formatElapsed(elapsedMs)}</Text>
                <Text style={styles.honest}>· renders take 30–120s</Text>
              </View>
              <JobStageList stages={PREVIEW_STAGES} current={job?.stage ?? "queued"} status={job?.status} />
              <Text key={tip} className="anim-fade-in" style={styles.tip}>
                {TIPS[tip]}
              </Text>
            </Card>
          )}
        </View>
      </View>

      <Dock>
        {error || missingPrereqs ? (
          <>
            {!missingPrereqs ? <Button title="Try again" onPress={retry} icon={(c) => <WandIcon size={18} color={c} />} /> : null}
            <Button title="Adjust brush" variant="secondary" onPress={adjustBrush} icon={(c) => <BrushIcon size={18} color={c} />} />
          </>
        ) : (
          <Text style={styles.leave}>You can leave — the render keeps going. Find it in Mine.</Text>
        )}
      </Dock>
    </View>
  );
}

const styles = styleSheet({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
  content: { width: "100%", maxWidth: COLUMN, alignSelf: "center", padding: 20, paddingTop: 6, paddingBottom: 170 },
  option: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
  photo: { marginTop: 16, marginBottom: 16 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  elapsed: { fontSize: 15, fontWeight: 700, color: theme.colors.text, fontVariantNumeric: "tabular-nums" },
  honest: { fontSize: 13, color: theme.colors.muted },
  tip: {
    marginTop: 10,
    fontWeight: 500,
    fontSize: 13,
    color: theme.colors.accentDark,
    backgroundColor: theme.colors.accentSoft,
    padding: 12,
    borderRadius: 14,
    lineHeight: "19px",
  },
  leave: { fontSize: 13, color: theme.colors.muted, textAlign: "center", paddingTop: 10, paddingBottom: 10 },
});
