/**
 * web/src/screens/proposal/Suggest.tsx — S2 Suggest (§7.5), studio step 2.
 *
 * Polls the scene job with a live scan over the photo. On failure: error +
 * "Try again" (api.reanalyze). On success: refetch proposal and show what the
 * AI sees (summary, observations), what it's unsure about (as questions, not
 * facts), what it will keep, and the option cards. Selecting an option →
 * api.updateProposal({selectedOptionId}) → /proposal/[id]/mask.
 */
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { COLUMN, CenterSpinner, Pressable, Text, View, styleSheet } from "../../ui/primitives";
import { Display } from "../../ui/Display";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Dock } from "../../ui/Dock";
import { StepProgress } from "../../ui/StepProgress";
import { useToast } from "../../ui/Toast";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ScanningPhoto } from "../../components/ScanningPhoto";
import { JobStageList } from "../../components/JobStageList";
import { ErrorState, asApiError } from "../../components/ErrorState";
import { BrushIcon, CheckIcon, EyeIcon, ShieldIcon, SparkleIcon } from "../../components/icons";
import { api, ApiError } from "../../api";
import { useInvalidateProposal, useProposal } from "../../hooks/useProposal";
import { useJobPolling } from "../../hooks/useJobPolling";
import { useRouter } from "../../lib/nav";
import { fonts, shadows, theme } from "../../theme";
import type { JobStage } from "../../api/types";

const SCENE_STAGES: JobStage[] = ["queued", "analyze", "done"];

export default function SuggestScreen() {
  const toast = useToast();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const [jobId, setJobId] = useState<string | undefined>(params.get("jobId") ?? undefined);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const proposalQuery = useProposal(id);
  const invalidateProposal = useInvalidateProposal();
  const jobQuery = useJobPolling(jobId);
  const proposal = proposalQuery.data;
  const job = jobQuery.data;

  // Opened without a jobId (e.g. from Mine): resume an active scene job.
  useEffect(() => {
    if (!jobId && proposal?.activeJob?.kind === "scene") {
      const s = proposal.activeJob.status;
      if (s === "queued" || s === "running") setJobId(proposal.activeJob.id);
    }
  }, [jobId, proposal]);

  // Scene job succeeded → refetch the proposal to pick up the scene.
  useEffect(() => {
    if (job?.status === "succeeded") invalidateProposal(id as string);
  }, [job?.status, id, invalidateProposal]);

  useEffect(() => {
    // Saved choice wins; otherwise pre-select option 1, which answers the resident's own concern.
    if (!picked && proposal?.selectedOptionId) setPicked(proposal.selectedOptionId);
    else if (!picked && proposal?.scene?.options[0]) setPicked(proposal.scene.options[0].id);
  }, [proposal?.selectedOptionId, proposal?.scene, picked]);

  const retryAnalyze = async () => {
    if (!proposal) return;
    try {
      const r = await api.reanalyze(id as string, proposal.revision);
      setJobId(r.jobId);
      invalidateProposal(id as string);
    } catch (e) {
      toast.show(asApiError(e).message, "error");
    }
  };

  const continueWith = async (optionId: string) => {
    if (!proposal || selectingId) return;
    setSelectingId(optionId);
    try {
      if (proposal.selectedOptionId !== optionId) {
        await api.updateProposal(id as string, { expectedRevision: proposal.revision, selectedOptionId: optionId });
        invalidateProposal(id as string);
      }
      router.push(`/proposal/${id}/mask`);
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === "REVISION_CONFLICT") {
        invalidateProposal(id as string);
        toast.show("The proposal changed — reloaded. Pick again.", "error");
      } else {
        toast.show(apiError.message, "error");
      }
    } finally {
      setSelectingId(null);
    }
  };

  if (proposalQuery.isLoading) return <CenterSpinner />;
  if (proposalQuery.isError || !proposal) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Ideas" />
        <View style={{ padding: 20, width: "100%", maxWidth: COLUMN, alignSelf: "center" }}>
          <ErrorState error={proposalQuery.error} onRetry={() => proposalQuery.refetch()} />
        </View>
      </View>
    );
  }

  const jobFailed = job?.status === "failed";
  const jobMissing = !!jobId && jobQuery.isError;
  const jobRunning = !!jobId && !jobMissing && (!job || job.status === "queued" || job.status === "running");
  const sceneReady = !!proposal.scene && !jobRunning;
  const scene = proposal.scene;
  const ratio = proposal.source.width / proposal.source.height;

  return (
    <View style={styles.root}>
      <ScreenHeader title="AI ideas" />
      <StepProgress step={2} />
      <View className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <View style={styles.content}>
          <ScanningPhoto
            uri={proposal.source.url}
            aspectRatio={ratio}
            label={jobRunning ? "AI is reading the scene…" : "Scene read"}
            active={jobRunning}
          />

          {jobRunning ? (
            <Card style={styles.block}>
              <JobStageList stages={SCENE_STAGES} current={job?.stage} status={job?.status} />
              <Text style={styles.note}>Usually 10–30 seconds.</Text>
            </Card>
          ) : null}

          {jobFailed || jobMissing || (!jobRunning && !scene) ? (
            <View style={styles.block}>
              <ErrorState
                error={
                  jobFailed && job?.error
                    ? new ApiError(0, job.error.code, job.error.message, job.error.retryable)
                    : new Error("Analysis not available")
                }
                onRetry={() => void retryAnalyze()}
                retryLabel="Analyze again"
              />
            </View>
          ) : null}

          {sceneReady && scene ? (
            <>
              <View className="anim-fade-in-down">
                <Display size={26} style={styles.h1}>
                  What could{" "}
                  <Display size={26} italic color={theme.colors.accent}>
                    change here?
                  </Display>
                </Display>
                <Card style={styles.block}>
                  <View style={styles.sectionHead}>
                    <EyeIcon size={18} color={theme.colors.accent} />
                    <Text style={styles.sectionTitle}>What the AI sees</Text>
                  </View>
                  <Text style={styles.summary}>{scene.summary}</Text>
                  <View style={styles.tags}>
                    {scene.observations.map((o) => (
                      <View key={o} style={styles.tag}>
                        <Text style={styles.tagText}>{o}</Text>
                      </View>
                    ))}
                  </View>
                  {scene.uncertainties.length > 0 ? (
                    <View style={styles.unsure}>
                      <Text style={styles.unsureTitle}>Worth checking</Text>
                      {scene.uncertainties.map((u) => (
                        <Text key={u.id} style={styles.unsureQ}>
                          ? {u.question}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {scene.preserve.length > 0 ? (
                    <View style={styles.keepRow}>
                      <ShieldIcon size={16} color={theme.colors.accent} />
                      <Text style={styles.keepText}>
                        Will stay untouched: <Text style={styles.keepStrong}>{scene.preserve.join(", ")}</Text>
                      </Text>
                    </View>
                  ) : null}
                </Card>
              </View>

              <Text style={styles.pickHead}>Pick one change</Text>
              {proposal.problemText ? (
                <View style={styles.concern}>
                  <Text style={styles.concernMark}>“</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.concernText}>{proposal.problemText}</Text>
                    <Text style={styles.concernBy}>Your concern — the first idea answers it</Text>
                  </View>
                </View>
              ) : null}
              <View role="radiogroup" aria-label="Pick one change">
                {scene.options.map((o, i) => {
                  const active = picked === o.id;
                  return (
                    <View key={o.id} className="anim-fade-in-down" style={{ animationDelay: `${120 + i * 90}ms` }}>
                      <Pressable
                        onPress={() => setPicked(o.id)}
                        role="radio"
                        selected={active}
                        label={`${o.title}. ${o.description}`}
                        feedback="soft"
                        style={[styles.option, active && styles.optionActive]}
                      >
                        <View style={[styles.radio, active && styles.radioOn]}>
                          {active ? <CheckIcon size={14} color="#fff" strokeWidth={3} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={[styles.optBadge, i === 0 ? styles.optBadgeYours : null]}>
                            <Text style={[styles.optBadgeText, i === 0 ? styles.optBadgeTextYours : null]}>
                              {i === 0 ? "Answers your concern" : "Another idea"}
                            </Text>
                          </View>
                          <Text style={styles.optTitle}>{o.title}</Text>
                          <Text style={styles.optDesc}>{o.description}</Text>
                          <View style={styles.hintRow}>
                            <BrushIcon size={14} color={theme.colors.warning} />
                            <Text style={styles.optHint}>{o.maskHint}</Text>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      </View>

      {sceneReady && scene ? (
        <Dock>
          <Button
            title={picked ? "Brush where it goes" : "Pick an idea above"}
            onPress={() => picked && void continueWith(picked)}
            disabled={!picked}
            loading={!!selectingId}
            icon={(c) => <BrushIcon size={18} color={c} />}
          />
        </Dock>
      ) : jobRunning ? (
        <Dock>
          <View style={styles.waitRow}>
            <SparkleIcon size={16} color={theme.colors.accent} />
            <Text style={styles.waitText}>You can leave — we'll keep working. Find it in Mine.</Text>
          </View>
        </Dock>
      ) : null}
    </View>
  );
}

const styles = styleSheet({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
  content: { width: "100%", maxWidth: COLUMN, alignSelf: "center", padding: "4px 20px 140px" },
  block: { marginTop: 16 },
  note: { fontSize: 12, color: theme.colors.faint, marginTop: 8 },
  h1: { marginTop: 22 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: theme.colors.accent, letterSpacing: 0.4, textTransform: "uppercase" },
  summary: { fontSize: 16, color: theme.colors.text, lineHeight: "24px", marginTop: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tag: { backgroundColor: theme.colors.accentSoft, borderRadius: 999, padding: "6px 12px" },
  tagText: { fontSize: 13, color: theme.colors.accentDark, fontWeight: 500 },
  unsure: { marginTop: 14, backgroundColor: theme.colors.orangeSoft, borderRadius: theme.radius.l, padding: 12 },
  unsureTitle: { fontSize: 12, fontWeight: 700, color: theme.colors.warning, textTransform: "uppercase", letterSpacing: 0.4 },
  unsureQ: { fontSize: 14, color: theme.colors.text, marginTop: 6, lineHeight: "20px" },
  keepRow: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "flex-start" },
  keepText: { flex: 1, fontSize: 13, color: theme.colors.muted, lineHeight: "19px" },
  keepStrong: { color: theme.colors.text, fontWeight: 600 },
  concern: { flexDirection: "row", gap: 10, backgroundColor: theme.colors.paperDeep, borderRadius: theme.radius.l, padding: 14, paddingLeft: 12, marginBottom: 14 },
  concernMark: { fontFamily: fonts.display, fontStyle: "italic", fontWeight: 800, fontSize: 40, lineHeight: "40px", color: theme.colors.orange, marginTop: -4 },
  concernText: { fontFamily: fonts.display, fontStyle: "italic", fontWeight: 600, fontSize: 17, lineHeight: "24px", color: theme.colors.text },
  concernBy: { fontSize: 12, color: theme.colors.muted, marginTop: 6, fontWeight: 500 },
  optBadge: { alignSelf: "flex-start", backgroundColor: theme.colors.paperDeep, borderRadius: 999, paddingLeft: 9, paddingRight: 9, paddingTop: 3, paddingBottom: 3, marginBottom: 6 },
  optBadgeYours: { backgroundColor: theme.colors.accentSoft },
  optBadgeText: { fontSize: 11, fontWeight: 700, color: theme.colors.muted, letterSpacing: 0.2 },
  optBadgeTextYours: { color: theme.colors.accentDark },
  pickHead: { fontSize: 17, fontWeight: 700, color: theme.colors.text, marginTop: 26, marginBottom: 10 },
  option: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
    width: "100%",
    transition: "border-color 160ms ease, background-color 160ms ease",
    ...shadows.card,
  },
  optionActive: { borderColor: theme.colors.accent, backgroundColor: "#FBFEFC" },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.faint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  optTitle: { fontSize: 16, fontWeight: 700, color: theme.colors.text, lineHeight: "22px" },
  optDesc: { fontSize: 14, color: theme.colors.muted, marginTop: 4, lineHeight: "20px" },
  hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  optHint: { flex: 1, fontSize: 13, color: theme.colors.warning, lineHeight: "18px" },
  waitRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", minHeight: 40 },
  waitText: { fontSize: 13, color: theme.colors.muted },
});
