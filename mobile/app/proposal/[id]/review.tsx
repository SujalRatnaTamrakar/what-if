/**
 * mobile/app/proposal/[id]/review.tsx — S5 Review & Publish (§7.5), studio
 * step 5. Before/after slider (intro sweep, hold to compare), mint AI
 * banner, the AI reviewer's verdict with per-flag acknowledgement, editable
 * AI-drafted wording (autosaves on blur), both approvals, Publish →
 * celebration. Regenerate → generate.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "../../../src/components/Text";
import { Display } from "../../../src/ui/Display";
import { Button } from "../../../src/ui/Button";
import { Field } from "../../../src/ui/Field";
import { CheckRow } from "../../../src/ui/CheckRow";
import { Dock } from "../../../src/ui/Dock";
import { StepProgress } from "../../../src/ui/StepProgress";
import { useToast } from "../../../src/ui/Toast";
import { ScreenHeader } from "../../../src/components/ScreenHeader";
import { BeforeAfterSlider } from "../../../src/components/BeforeAfterSlider";
import { FlagList } from "../../../src/components/FlagList";
import { ErrorState } from "../../../src/components/ErrorState";
import { SparkleIcon, WandIcon } from "../../../src/components/icons";
import { api, ApiError, friendlyMessage, displayMessage } from "../../../src/api";
import type { Proposal, ProposalPatch } from "../../../src/api/types";
import { useProposal } from "../../../src/hooks/useProposal";
import { theme } from "../../../src/theme";

const TITLE_MAX = 120;
const CHANGE_MAX = 1500;

export default function ReviewScreen() {
  const { id } = useLocalSearchParams();
  const pid = Array.isArray(id) ? id[0] : (id as string);
  const qc = useQueryClient();
  const toast = useToast();
  const { data: proposal, isLoading, isFetching, error, refetch } = useProposal(pid);

  const [title, setTitle] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("To confirm");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [approveText, setApproveText] = useState(false);
  const [approveConcept, setApproveConcept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [redirected, setRedirected] = useState(false);

  const revisionRef = useRef(0);
  const lastSyncedRev = useRef(0);

  useEffect(() => {
    if (proposal && proposal.revision !== lastSyncedRev.current) {
      lastSyncedRev.current = proposal.revision;
      revisionRef.current = proposal.revision;
      setTitle(proposal.title);
      setChangeRequest(proposal.changeRequest);
      setRecipientLabel(proposal.recipientLabel || "To confirm");
      setAcknowledged((prev) => prev.filter((fid) => (proposal.review?.flags ?? []).some((f) => f.id === fid)));
    }
  }, [proposal]);

  // No concept yet → back to Imagine. Only on fresh data, so a stale cache
  // entry can't bounce the user between Review and Imagine.
  useEffect(() => {
    if (proposal && !proposal.concept && !isFetching && !redirected) {
      setRedirected(true);
      router.replace(`/proposal/${pid}/generate`);
    }
  }, [proposal, isFetching, redirected, pid]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }
  if (error || !proposal) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Review & publish" />
        <View style={{ padding: 20 }}>
          <ErrorState error={error} onRetry={() => refetch()} />
        </View>
      </View>
    );
  }

  const review = proposal.review;
  const warnings = (review?.flags ?? []).filter((f) => f.severity === "warning");
  const blockers = (review?.flags ?? []).filter((f) => f.severity === "blocking");
  const hasBlocking = blockers.length > 0;
  const allAcked = warnings.every((w) => acknowledged.includes(w.id));
  const canPublish =
    !!review &&
    review.verdict !== "blocked" &&
    !hasBlocking &&
    allAcked &&
    approveText &&
    approveConcept &&
    !publishing &&
    proposal.status !== "published";

  const blockedReason = !review
    ? "Waiting for the AI review"
    : hasBlocking || review.verdict === "blocked"
      ? "This concept can't be published"
      : !allAcked
        ? "Acknowledge each note above"
        : !approveText || !approveConcept
          ? "Tick both approvals"
          : null;

  const save = async (patch: ProposalPatch, quiet = false) => {
    setSaving(true);
    try {
      const updated: Proposal = await api.updateProposal(pid, { ...patch, expectedRevision: revisionRef.current });
      revisionRef.current = updated.revision;
      lastSyncedRev.current = updated.revision;
      qc.setQueryData(["proposal", pid], updated);
      if (!quiet) toast.show("Saved", "success");
    } catch (e) {
      if (e instanceof ApiError && e.code === "REVISION_CONFLICT") {
        await refetch();
        toast.show(displayMessage(e), "error");
      } else {
        toast.show(e instanceof ApiError ? displayMessage(e) : "Couldn't save.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const pendingPatch = (): ProposalPatch => {
    const patch: ProposalPatch = {};
    if (title !== proposal.title) patch.title = title;
    if (changeRequest !== proposal.changeRequest) patch.changeRequest = changeRequest;
    if (recipientLabel !== proposal.recipientLabel) patch.recipientLabel = recipientLabel;
    return patch;
  };

  const doPublish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      // Flush any unsaved wording first so what's published is what you approved.
      const patch = pendingPatch();
      if (Object.keys(patch).length > 0) {
        const updated = await api.updateProposal(pid, { ...patch, expectedRevision: revisionRef.current });
        revisionRef.current = updated.revision;
        lastSyncedRev.current = updated.revision;
      }
      const updated = await api.publish(pid, {
        expectedRevision: revisionRef.current,
        approveText: true,
        approveConcept: true,
        acknowledgedFlagIds: acknowledged,
      });
      qc.setQueryData(["proposal", pid], updated);
      qc.invalidateQueries({ queryKey: ["feed"] });
      router.replace(`/proposal/${pid}/celebrate`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "REVISION_CONFLICT") await refetch();
      toast.show(e instanceof ApiError ? displayMessage(e) : "Couldn't publish.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const gen = proposal.generation;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Review & publish" />
      <StepProgress step={5} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {proposal.concept ? (
          <View style={styles.sliderCard}>
            <BeforeAfterSlider
              beforeUri={proposal.source.url}
              afterUri={proposal.concept.url}
              aspectRatio={proposal.source.width / proposal.source.height}
              rounded
              intro
            />
            <View style={styles.mint}>
              <SparkleIcon size={14} color={theme.colors.accent} />
              <Text style={styles.mintText}>AI illustration — not an engineering design</Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.holdHint}>Drag to compare · hold to see your original</Text>
        {gen ? (
          <Text style={styles.gen}>
            Made with {gen.model} in {Math.max(1, Math.round(gen.durationMs / 1000))}s
          </Text>
        ) : null}

        <Display size={22} style={styles.section}>
          The AI reviewer says
        </Display>
        {review ? (
          <FlagList
            review={review}
            acknowledged={acknowledged}
            onToggle={(fid) => setAcknowledged((prev) => (prev.includes(fid) ? prev.filter((x) => x !== fid) : [...prev, fid]))}
          />
        ) : (
          <Text style={styles.muted}>Review not available yet.</Text>
        )}

        <Display size={22} style={styles.section}>
          Your request
        </Display>
        <Text style={styles.sectionSub}>Drafted by AI — make it yours. Saves when you leave a field.</Text>
        <Field
          label="Title"
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
          onBlur={() => {
            if (title !== proposal.title) void save({ title }, true);
          }}
          maxLength={TITLE_MAX}
        />
        <Field
          label="Change request"
          value={changeRequest}
          onChangeText={(t) => setChangeRequest(t.slice(0, CHANGE_MAX))}
          onBlur={() => {
            if (changeRequest !== proposal.changeRequest) void save({ changeRequest }, true);
          }}
          maxLength={CHANGE_MAX}
          multiline
        />
        <Field
          label="Recipient"
          value={recipientLabel}
          onChangeText={setRecipientLabel}
          onBlur={() => {
            if (recipientLabel !== proposal.recipientLabel) void save({ recipientLabel }, true);
          }}
          placeholder="To confirm"
        />
        {saving ? <Text style={styles.saving}>Saving…</Text> : null}

        <View style={styles.approvals}>
          <CheckRow checked={approveText} onToggle={() => setApproveText((v) => !v)} label="I approve this exact wording" />
          <CheckRow
            checked={approveConcept}
            onToggle={() => setApproveConcept((v) => !v)}
            label="I understand the image is an AI illustration"
          />
        </View>
      </ScrollView>

      <Dock>
        <Button
          title={proposal.status === "published" ? "Already published" : "Publish"}
          onPress={() => void doPublish()}
          disabled={!canPublish}
          loading={publishing}
        />
        <View style={styles.dockRow}>
          <Text style={styles.reason} numberOfLines={1}>
            {blockedReason ?? "Ready to share with your neighbors"}
          </Text>
          <Pressable
            onPress={() => router.replace(`/proposal/${pid}/generate`)}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.regenBtn}
          >
            <WandIcon size={14} color={theme.colors.accent} />
            <Text style={styles.regen}>Regenerate</Text>
          </Pressable>
        </View>
      </Dock>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingTop: 4, paddingBottom: 200 },
  sliderCard: { borderRadius: theme.radius.xl, overflow: "hidden", backgroundColor: theme.colors.card },
  mint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.accentSoft,
    paddingVertical: 10,
  },
  mintText: { fontSize: 13, color: theme.colors.accentDark, fontWeight: "500" },
  holdHint: { fontSize: 12, color: theme.colors.muted, textAlign: "center", marginTop: 10 },
  gen: { fontSize: 11, color: theme.colors.faint, textAlign: "center", marginTop: 2 },
  section: { marginTop: 26, marginBottom: 10 },
  sectionSub: { fontSize: 13, color: theme.colors.muted, marginTop: -4, marginBottom: 12 },
  muted: { color: theme.colors.muted, fontSize: 14 },
  saving: { fontSize: 12, color: theme.colors.accent, marginTop: -2 },
  approvals: { marginTop: 10, backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, paddingHorizontal: 14, paddingVertical: 4 },
  dockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  reason: { flex: 1, fontSize: 12, color: theme.colors.muted },
  regenBtn: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36 },
  regen: { fontSize: 13, fontWeight: "600", color: theme.colors.accent },
});
