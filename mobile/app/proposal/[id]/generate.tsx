/**
 * mobile/app/proposal/[id]/generate.tsx — S4 Generate (§7.5), studio step 4.
 *
 * On entry, if no active preview job exists: api.requestPreview with a fresh
 * expo-crypto UUID Idempotency-Key (StrictMode-safe via startedRef), then
 * refetch the proposal (E11 sets status=draft without a revision bump).
 * Shows the photo with your brush glowing under an AI scan, the live stage
 * timeline, elapsed time and the honest "30–120s" note. On failure: error +
 * Retry (new key) + Adjust brush; STALE_RESULT reloads the proposal. On
 * success → /proposal/[id]/review. Reopening mid-job resumes via activeJob.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Text } from "../../../src/components/Text";
import { Display } from "../../../src/ui/Display";
import { Button } from "../../../src/ui/Button";
import { Card } from "../../../src/ui/Card";
import { Dock } from "../../../src/ui/Dock";
import { StepProgress } from "../../../src/ui/StepProgress";
import { ScreenHeader } from "../../../src/components/ScreenHeader";
import { ScanningPhoto } from "../../../src/components/ScanningPhoto";
import { JobStageList } from "../../../src/components/JobStageList";
import { ErrorState, asApiError } from "../../../src/components/ErrorState";
import { BrushIcon, ClockIcon, WandIcon } from "../../../src/components/icons";
import { api } from "../../../src/api";
import { ApiError } from "../../../src/api/errors";
import { useInvalidateProposal, useProposal } from "../../../src/hooks/useProposal";
import { useJobPolling } from "../../../src/hooks/useJobPolling";
import { getMaskDraft } from "../../../src/lib/maskDraft";
import { fonts, theme } from "../../../src/theme";
import type { JobStage, MaskStrokes } from "../../../src/api/types";

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
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" pointerEvents="none">
      {strokes.strokes
        .filter((s) => s.mode === "paint")
        .map((s, i) => {
          const pts = s.points.map(([x, y]) => [x * 100, y * H] as const);
          const w = s.width * 100;
          if (pts.length === 1) return <Circle key={i} cx={pts[0][0]} cy={pts[0][1]} r={w / 2} fill="rgba(240,160,40,0.5)" />;
          return (
            <Path
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
    </Svg>
  );
}

export default function GenerateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
      const key = Crypto.randomUUID();
      const r = await api.requestPreview(
        id as string,
        { optionId: p.selectedOptionId, maskAssetId: p.maskAssetId, expectedRevision: p.revision },
        key
      );
      startTimeRef.current = Date.now();
      setJobId(r.jobId);
      // E11 flips status to draft WITHOUT a revision bump — refetch (§7.5 S4).
      invalidateProposal(id as string);
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === "REVISION_CONFLICT") invalidateProposal(id as string);
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
        router.replace({ pathname: "/proposal/[id]/review", params: { id: id as string } });
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
      router.replace({ pathname: "/proposal/[id]/suggest", params: { id: id as string } });
      return;
    }
    void startPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id, proposal?.activeJob?.id, proposal?.activeJob?.status]);

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
      void invalidateProposal(id as string).finally(() =>
        router.replace({ pathname: "/proposal/[id]/review", params: { id: id as string } })
      );
    } else if (job?.status === "failed" && job.error) {
      if (job.error.code === "STALE_RESULT") {
        invalidateProposal(id as string);
        setError(new ApiError(409, "STALE_RESULT", job.error.message, false));
      } else {
        setError(new ApiError(0, job.error.code, job.error.message, job.error.retryable));
      }
    }
  }, [job?.status, id, invalidateProposal, job]);

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
    else router.replace({ pathname: "/proposal/[id]/mask", params: { id: id as string } });
  };

  if (proposalQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }
  if (proposalQuery.isError || !proposal) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Imagine" />
        <View style={{ padding: 20 }}>
          <ErrorState error={proposalQuery.error} onRetry={() => proposalQuery.refetch()} />
        </View>
      </View>
    );
  }

  const missingPrereqs = !proposal.scene || !proposal.selectedOptionId || !proposal.maskAssetId;
  const option = proposal.scene?.options.find((o) => o.id === proposal.selectedOptionId);
  const aspect = proposal.source.width / proposal.source.height;
  const strokes = getMaskDraft(id as string);
  const running = !error && !missingPrereqs;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Imagine" />
      <StepProgress step={4} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <Animated.Text key={tip} entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.tip}>
              {TIPS[tip]}
            </Animated.Text>
          </Card>
        )}
      </ScrollView>

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingTop: 6, paddingBottom: 170 },
  option: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
  photo: { marginVertical: 16 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  elapsed: { fontSize: 15, fontWeight: "700", color: theme.colors.text, fontVariant: ["tabular-nums"] },
  honest: { fontSize: 13, color: theme.colors.muted },
  tip: { marginTop: 10, fontFamily: fonts.medium, fontSize: 13, color: theme.colors.accentDark, backgroundColor: theme.colors.accentSoft, padding: 12, borderRadius: 14, lineHeight: 19 },
  leave: { fontSize: 13, color: theme.colors.muted, textAlign: "center", paddingVertical: 10 },
});
