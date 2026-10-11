/**
 * mobile/app/proposal/[id]/suggest.tsx — S2 Suggest (§7.5).
 *
 * Polls the scene job (JobStageList: queued → analyze). On failure: error
 * card + "Try again" (api.reanalyze). On success: refetch proposal, show
 * sanitized source + scene summary + observations + uncertainties (as
 * questions, not facts) + preserve list + option cards. Selecting an option
 * → api.updateProposal({selectedOptionId}) → /proposal/[id]/mask.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/api";
import { useInvalidateProposal, useProposal } from "../../../src/hooks/useProposal";
import { useJobPolling } from "../../../src/hooks/useJobPolling";
import { ErrorState, asApiError } from "../../../src/components/ErrorState";
import { JobStageList } from "../../../src/components/JobStageList";
import { PrimaryButton, ACCENT, INK, MUTED, PAPER } from "../../../src/components/PrimaryButton";
import type { JobStage } from "../../../src/api/types";

const SCENE_STAGES: JobStage[] = ["queued", "analyze"];

export default function SuggestScreen() {
  const { id, jobId: jobIdParam } = useLocalSearchParams<{
    id: string;
    jobId?: string;
  }>();
  const [jobId, setJobId] = useState<string | undefined>(
    typeof jobIdParam === "string" ? jobIdParam : undefined
  );
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const proposalQuery = useProposal(id);
  const invalidateProposal = useInvalidateProposal();
  const jobQuery = useJobPolling(jobId);

  const proposal = proposalQuery.data;
  const job = jobQuery.data;

  // If opened without a jobId (e.g. from Mine), resume the scene job if one
  // is still active.
  useEffect(() => {
    if (!jobId && proposal?.activeJob?.kind === "scene") {
      const s = proposal.activeJob.status;
      if (s === "queued" || s === "running") setJobId(proposal.activeJob.id);
    }
  }, [jobId, proposal]);

  // When the scene job succeeds, refetch the proposal to pick up the scene.
  useEffect(() => {
    if (job?.status === "succeeded") {
      invalidateProposal(id as string);
    }
  }, [job?.status, id, invalidateProposal]);

  const retryAnalyze = async () => {
    if (!proposal) return;
    try {
      const r = await api.reanalyze(id as string, proposal.revision);
      setJobId(r.jobId);
      invalidateProposal(id as string);
    } catch (e) {
      setNotice(asApiError(e).message);
    }
  };

  const selectOption = async (optionId: string) => {
    if (!proposal || selectingId) return;
    setSelectingId(optionId);
    setNotice(null);
    try {
      await api.updateProposal(id as string, {
        expectedRevision: proposal.revision,
        selectedOptionId: optionId,
      });
      invalidateProposal(id as string);
      router.push({ pathname: "/proposal/[id]/mask", params: { id: id as string } });
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === "REVISION_CONFLICT") {
        invalidateProposal(id as string);
        setNotice("The proposal changed — reloaded. Pick an option again.");
      } else {
        setNotice(apiError.message);
      }
    } finally {
      setSelectingId(null);
    }
  };

  if (proposalQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
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

  const jobFailed = job?.status === "failed";
  // The job record can vanish (e.g. 404): don't spin forever — offer retry.
  const jobMissing = !!jobId && jobQuery.isError;
  const jobRunning =
    jobId && !jobMissing && (!job || job.status === "queued" || job.status === "running");
  // The scene may already exist (e.g. opened from Mine) with no live job.
  const sceneReady = !!proposal.scene && (!job || job.status === "succeeded");

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>What could change here?</Text>

      {jobRunning ? (
        <View style={styles.card}>
          <JobStageList stages={SCENE_STAGES} current={job?.stage ?? "queued"} />
          <Text style={styles.hint}>Reading the photo…</Text>
        </View>
      ) : null}

      {jobFailed || jobMissing ? (
        <ErrorState
          error={job?.error ?? new Error("Analysis failed.")}
          onRetry={retryAnalyze}
          retryLabel="Try again"
        />
      ) : null}

      {sceneReady && proposal.scene ? (        <View>
          <Image
            source={{ uri: proposal.source.url }}
            style={styles.source}
            contentFit="cover"
            accessibilityLabel="Your photo"
          />
          <View style={styles.card}>
            <Text style={styles.summary}>{proposal.scene.summary}</Text>
            {proposal.scene.observations.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What we see</Text>
                {proposal.scene.observations.map((o, i) => (
                  <Text key={i} style={styles.bullet}>
                    • {o}
                  </Text>
                ))}
              </View>
            ) : null}
            {proposal.scene.uncertainties.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Things we're unsure about</Text>
                {proposal.scene.uncertainties.map((u) => (
                  <Text key={u.id} style={styles.bullet}>
                    ? {u.question}
                  </Text>
                ))}
              </View>
            ) : null}
            {proposal.scene.preserve.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Kept unchanged</Text>
                {proposal.scene.preserve.map((p, i) => (
                  <Text key={i} style={styles.bullet}>
                    • {p}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>

          <Text style={styles.optionsTitle}>Pick one change</Text>
          {proposal.scene.options.map((option) => (
            <View key={option.id} style={styles.optionCard}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDesc}>{option.description}</Text>
              <Text style={styles.maskHint}>🖌 {option.maskHint}</Text>
              <PrimaryButton
                title={
                  selectingId === option.id ? "Selecting…" : "Choose this"
                }
                onPress={() => selectOption(option.id)}
                disabled={selectingId !== null}
                loading={selectingId === option.id}
                variant="secondary"
                style={styles.optionBtn}
              />
            </View>
          ))}
        </View>
      ) : null}

      {!sceneReady && !jobRunning && !jobFailed && !jobMissing ? (
        <View style={styles.card}>
          <Text style={styles.hint}>
            This photo hasn't been analyzed yet.
          </Text>
          <PrimaryButton
            title="Analyze photo"
            onPress={retryAnalyze}
            style={styles.optionBtn}
          />
        </View>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER },
  content: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  heading: { fontSize: 22, fontWeight: "800", color: INK, marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EDE6D6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  hint: { color: MUTED, fontSize: 13, marginTop: 4 },
  source: { width: "100%", height: 240, borderRadius: 16, backgroundColor: "#E5E7EB" },
  summary: { fontSize: 16, color: INK, lineHeight: 23 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: INK, marginBottom: 6 },
  bullet: { fontSize: 14, color: INK, lineHeight: 21 },
  optionsTitle: { fontSize: 17, fontWeight: "800", color: INK, marginVertical: 12 },
  optionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EDE6D6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  optionTitle: { fontSize: 16, fontWeight: "700", color: INK, marginBottom: 4 },
  optionDesc: { fontSize: 14, color: INK, lineHeight: 20 },
  maskHint: { fontSize: 13, color: MUTED, marginTop: 8, fontStyle: "italic" },
  optionBtn: { marginTop: 12 },
  notice: {
    marginTop: 12,
    backgroundColor: "#FFF7E6",
    borderRadius: 8,
    padding: 10,
    color: INK,
    fontSize: 13,
  },
});
