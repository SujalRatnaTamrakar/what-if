/**
 * mobile/app/proposal/[id]/suggest.tsx — S2 Suggest (§7.5), studio step 2.
 *
 * Polls the scene job with a live scan over the photo. On failure: error +
 * "Try again" (api.reanalyze). On success: refetch proposal and show what the
 * AI sees (summary, observations), what it's unsure about (as questions, not
 * facts), what it will keep, and the option cards. Selecting an option →
 * api.updateProposal({selectedOptionId}) → /proposal/[id]/mask.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text } from "../../../src/components/Text";
import { Display } from "../../../src/ui/Display";
import { Button } from "../../../src/ui/Button";
import { Card } from "../../../src/ui/Card";
import { StepProgress } from "../../../src/ui/StepProgress";
import { ScreenHeader } from "../../../src/components/ScreenHeader";
import { ScanningPhoto } from "../../../src/components/ScanningPhoto";
import { JobStageList } from "../../../src/components/JobStageList";
import { ErrorState, asApiError } from "../../../src/components/ErrorState";
import { BrushIcon, CheckIcon, EyeIcon, ShieldIcon, SparkleIcon } from "../../../src/components/icons";
import { api, ApiError } from "../../../src/api";
import { Dock } from "../../../src/ui/Dock";
import { useInvalidateProposal, useProposal } from "../../../src/hooks/useProposal";
import { useJobPolling } from "../../../src/hooks/useJobPolling";
import { useToast } from "../../../src/ui/Toast";
import { shadows, theme } from "../../../src/theme";
import type { JobStage } from "../../../src/api/types";

const SCENE_STAGES: JobStage[] = ["queued", "analyze", "done"];

export default function SuggestScreen() {
  const toast = useToast();
  const { id, jobId: jobIdParam } = useLocalSearchParams<{ id: string; jobId?: string }>();
  const [jobId, setJobId] = useState<string | undefined>(typeof jobIdParam === "string" ? jobIdParam : undefined);
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
    if (!picked && proposal?.selectedOptionId) setPicked(proposal.selectedOptionId);
  }, [proposal?.selectedOptionId, picked]);

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
      router.push({ pathname: "/proposal/[id]/mask", params: { id: id as string } });
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
        <ScreenHeader title="Ideas" />
        <View style={{ padding: 20 }}>
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              error={jobFailed && job?.error ? new ApiError(0, job.error.code, job.error.message, job.error.retryable) : new Error("Analysis not available")}
              onRetry={() => void retryAnalyze()}
              retryLabel="Analyze again"
            />
          </View>
        ) : null}

        {sceneReady && scene ? (
          <>
            <Animated.View entering={FadeInDown.springify().damping(18)}>
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
            </Animated.View>

            <Text style={styles.pickHead}>Pick one change</Text>
            {scene.options.map((o, i) => {
              const active = picked === o.id;
              return (
                <Animated.View key={o.id} entering={FadeInDown.delay(120 + i * 90).springify().damping(18)}>
                  <Pressable
                    onPress={() => setPicked(o.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${o.title}. ${o.description}`}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <View style={[styles.radio, active && styles.radioOn]}>
                      {active ? <CheckIcon size={14} color="#fff" strokeWidth={3} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optTitle}>{o.title}</Text>
                      <Text style={styles.optDesc}>{o.description}</Text>
                      <View style={styles.hintRow}>
                        <BrushIcon size={14} color={theme.colors.warning} />
                        <Text style={styles.optHint}>{o.maskHint}</Text>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </>
        ) : null}
      </ScrollView>

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingTop: 4, paddingBottom: 140 },
  block: { marginTop: 16 },
  note: { fontSize: 12, color: theme.colors.faint, marginTop: 8 },
  h1: { marginTop: 22 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.accent, letterSpacing: 0.4, textTransform: "uppercase" },
  summary: { fontSize: 16, color: theme.colors.text, lineHeight: 24, marginTop: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tag: { backgroundColor: theme.colors.accentSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 13, color: theme.colors.accentDark, fontWeight: "500" },
  unsure: { marginTop: 14, backgroundColor: theme.colors.orangeSoft, borderRadius: theme.radius.l, padding: 12 },
  unsureTitle: { fontSize: 12, fontWeight: "700", color: theme.colors.warning, textTransform: "uppercase", letterSpacing: 0.4 },
  unsureQ: { fontSize: 14, color: theme.colors.text, marginTop: 6, lineHeight: 20 },
  keepRow: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "flex-start" },
  keepText: { flex: 1, fontSize: 13, color: theme.colors.muted, lineHeight: 19 },
  keepStrong: { color: theme.colors.text, fontWeight: "600" },
  pickHead: { fontSize: 17, fontWeight: "700", color: theme.colors.text, marginTop: 26, marginBottom: 10 },
  option: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
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
  optTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, lineHeight: 22 },
  optDesc: { fontSize: 14, color: theme.colors.muted, marginTop: 4, lineHeight: 20 },
  hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  optHint: { flex: 1, fontSize: 13, color: theme.colors.warning, lineHeight: 18 },
  waitRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", minHeight: 40 },
  waitText: { fontSize: 13, color: theme.colors.muted },
});
