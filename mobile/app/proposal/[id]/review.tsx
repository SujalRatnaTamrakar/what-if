/**
 * mobile/app/proposal/[id]/review.tsx — S5 Review & Publish (§7.5) in the
 * mockup visual language. Before/after pair with slider handle, mint AI
 * banner, warning card with "I've seen this" checkbox, floating-label
 * fields, approval checkboxes, big green Publish. Regenerate → generate.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { Text } from "../../../src/components/Text";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, friendlyMessage } from "../../../src/api";
import type { Proposal, ProposalPatch } from "../../../src/api/types";
import { useProposal } from "../../../src/hooks/useProposal";
import { ScreenHeader } from "../../../src/components/ScreenHeader";
import { BeforeAfterSlider } from "../../../src/components/BeforeAfterSlider";
import { FlagList } from "../../../src/components/FlagList";
import { ErrorState } from "../../../src/components/ErrorState";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { fonts, theme } from "../../../src/theme";

const TITLE_MAX = 120;
const CHANGE_MAX = 1500;

export default function ReviewScreen() {
  const { id } = useLocalSearchParams();
  const pid = Array.isArray(id) ? id[0] : (id as string);
  const qc = useQueryClient();
  const { data: proposal, isLoading, error, refetch } = useProposal(pid);

  const [title, setTitle] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("To confirm");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [approveText, setApproveText] = useState(false);
  const [approveConcept, setApproveConcept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [redirected, setRedirected] = useState(false);

  const revisionRef = useRef(0);
  const lastSyncedRev = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (proposal && proposal.revision !== lastSyncedRev.current) {
      lastSyncedRev.current = proposal.revision;
      revisionRef.current = proposal.revision;
      setTitle(proposal.title);
      setChangeRequest(proposal.changeRequest);
      setRecipientLabel(proposal.recipientLabel || "To confirm");
      setAcknowledged((prev) =>
        prev.filter((fid) =>
          (proposal.review?.flags ?? []).some((f) => f.id === fid)
        )
      );
    }
  }, [proposal]);

  useEffect(() => {
    if (proposal && !proposal.concept && !redirected) {
      setRedirected(true);
      router.replace(`/proposal/${pid}/generate`);
    }
  }, [proposal, redirected, pid]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }
  if (error || !proposal) {
    return (
      <View style={styles.container}>
        <ErrorState error={error} onRetry={() => refetch()} />
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

  const save = async (patch: ProposalPatch) => {
    setSaving(true);
    try {
      const updated: Proposal = await api.updateProposal(pid, {
        ...patch,
        expectedRevision: revisionRef.current,
      });
      revisionRef.current = updated.revision;
      lastSyncedRev.current = updated.revision;
      qc.setQueryData(["proposal", pid], updated);
      showToast("Saved");
    } catch (e) {
      if (e instanceof ApiError && e.code === "REVISION_CONFLICT") {
        await refetch();
        showToast(friendlyMessage(e.code));
      } else {
        showToast(
          e instanceof ApiError ? friendlyMessage(e.code) : "Couldn't save."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const saveAll = () => {
    const patch: ProposalPatch = {};
    if (title !== proposal.title) patch.title = title;
    if (changeRequest !== proposal.changeRequest)
      patch.changeRequest = changeRequest;
    if (recipientLabel !== proposal.recipientLabel)
      patch.recipientLabel = recipientLabel;
    if (Object.keys(patch).length === 0) {
      showToast("Nothing to save");
      return;
    }
    void save(patch);
  };

  const doPublish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      const updated = await api.publish(pid, {
        expectedRevision: revisionRef.current,
        approveText: true,
        approveConcept: true,
        acknowledgedFlagIds: acknowledged,
      });
      qc.setQueryData(["proposal", pid], updated);
      qc.invalidateQueries({ queryKey: ["feed"] });
      router.replace(`/proposal/${pid}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "REVISION_CONFLICT") {
        await refetch();
      }
      showToast(
        e instanceof ApiError ? friendlyMessage(e.code) : "Couldn't publish."
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Review & publish" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {proposal.concept && (
          <BeforeAfterSlider
            beforeUri={proposal.source.url}
            afterUri={proposal.concept.url}
            aspectRatio={proposal.source.width / proposal.source.height}
            rounded
          />
        )}

        <View style={styles.mintBanner}>
          <Text style={styles.mintText}>
            ✨ AI illustration — not an engineering design
          </Text>
        </View>

        {review && review.flags.length > 0 ? (
          <View style={styles.warnCard}>
            <View style={styles.warnIcon}>
              <Text style={styles.warnIconText}>!</Text>
            </View>
            <View style={styles.warnBody}>
              <Text style={styles.warnTitle}>
                {review.verdict === "blocked" ? "Blocked" : "Needs review"}
              </Text>
              {review.flags.map((f) => (
                <Text key={f.id} style={styles.warnMsg}>
                  {f.message}
                </Text>
              ))}
            </View>
            {warnings.length > 0 ? (
              <Pressable
                onPress={() =>
                  setAcknowledged((prev) =>
                    warnings.every((w) => prev.includes(w.id))
                      ? prev.filter(
                          (x) => !warnings.some((w) => w.id === x)
                        )
                      : [
                          ...prev,
                          ...warnings
                            .map((w) => w.id)
                            .filter((x) => !prev.includes(x)),
                        ]
                  )
                }
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: warnings.every((w) => acknowledged.includes(w.id)),
                }}
                style={styles.seenWrap}
              >
                <View
                  style={[
                    styles.checkbox,
                    warnings.every((w) => acknowledged.includes(w.id)) &&
                      styles.checkboxChecked,
                  ]}
                >
                  {warnings.every((w) => acknowledged.includes(w.id)) ? (
                    <Text style={styles.check}>✓</Text>
                  ) : null}
                </View>
                <Text style={styles.seenText}>I've seen this</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {hasBlocking ? (
          <View style={styles.blockedBox}>
            <Text style={styles.blockedText}>
              This concept can't be published. Regenerate or adjust the brushed
              area.
            </Text>
          </View>
        ) : null}

        {/* Detailed per-flag list (severity badges) for transparency */}
        {review ? (
          <FlagList
            flags={review.flags}
            acknowledged={acknowledged}
            onToggle={(fid) =>
              setAcknowledged((prev) =>
                prev.includes(fid)
                  ? prev.filter((x) => x !== fid)
                  : [...prev, fid]
              )
            }
          />
        ) : (
          <Text style={styles.muted}>Review not available yet.</Text>
        )}

        <FloatingField
          label="Title"
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
          onBlur={() => {
            if (title !== proposal.title) void save({ title });
          }}
          maxLength={TITLE_MAX}
          hint={`${title.length}/${TITLE_MAX}`}
        />
        <FloatingField
          label="Change request"
          value={changeRequest}
          onChangeText={(t) => setChangeRequest(t.slice(0, CHANGE_MAX))}
          onBlur={() => {
            if (changeRequest !== proposal.changeRequest)
              void save({ changeRequest });
          }}
          maxLength={CHANGE_MAX}
          multiline
          hint={`${changeRequest.length}/${CHANGE_MAX}`}
        />
        <FloatingField
          label="Recipient"
          value={recipientLabel}
          onChangeText={setRecipientLabel}
          onBlur={() => {
            if (recipientLabel !== proposal.recipientLabel)
              void save({ recipientLabel });
          }}
          placeholder="To confirm"
        />
        <PrimaryButton
          title={saving ? "Saving…" : "Save wording"}
          onPress={saveAll}
          disabled={saving}
          loading={saving}
          variant="secondary"
          style={styles.saveBtn}
        />

        <CheckRow
          checked={approveText}
          onToggle={() => setApproveText((v) => !v)}
          label="I approve this exact wording"
        />
        <CheckRow
          checked={approveConcept}
          onToggle={() => setApproveConcept((v) => !v)}
          label="I understand the image is an AI illustration"
        />

        <PrimaryButton
          title="Publish"
          onPress={doPublish}
          disabled={!canPublish}
          loading={publishing}
          style={styles.publishBtn}
        />
        <PrimaryButton
          title="Regenerate concept"
          onPress={() => router.replace(`/proposal/${pid}/generate`)}
          variant="secondary"
          style={styles.regenBtn}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Outlined rounded field with a floating label, per mockups. */
function FloatingField({
  label,
  value,
  onChangeText,
  onBlur,
  maxLength,
  multiline,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onBlur: () => void;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldBox}>
        <Text style={styles.floatingLabel}>{label}</Text>
        <TextInput
          style={[styles.fieldInput, multiline && styles.fieldMultiline]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          placeholder={placeholder}
          accessibilityLabel={label}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.checkRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  content: { padding: theme.spacing.l, paddingBottom: 0 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  back: { paddingVertical: theme.spacing.s, alignSelf: "flex-start" },
  backText: { fontSize: 16, color: theme.colors.accent, fontWeight: "600" },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: theme.spacing.m,
  },
  mintBanner: {
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.m,
    padding: 12,
    alignItems: "center",
    marginTop: theme.spacing.m,
  },
  mintText: {
    color: theme.colors.accentDark,
    fontSize: 13,
    fontWeight: "600",
  },
  warnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.m,
    padding: theme.spacing.m,
    marginTop: theme.spacing.m,
  },
  warnIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.m,
  },
  warnIconText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  warnBody: { flex: 1 },
  warnTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 2,
  },
  warnMsg: { fontSize: 13, color: theme.colors.text, lineHeight: 18 },
  seenWrap: { alignItems: "center", marginLeft: theme.spacing.s },
  seenText: { fontSize: 11, color: theme.colors.text, marginTop: 4, fontWeight: "600" },
  blockedBox: {
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.m,
    padding: theme.spacing.m,
    marginTop: theme.spacing.s,
  },
  blockedText: { color: theme.colors.danger, fontWeight: "600", fontSize: 14 },
  muted: { color: theme.colors.muted, fontSize: 14, marginVertical: 8 },
  fieldWrap: { marginTop: theme.spacing.m },
  fieldBox: {
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.m,
    paddingTop: 18,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  floatingLabel: {
    position: "absolute",
    top: -9,
    left: 12,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 6,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  fieldInput: {
    fontFamily: fonts.regular, fontSize: 15, color: theme.colors.text, minHeight: 24 },
  fieldMultiline: { minHeight: 96 },
  hint: {
    fontSize: 11,
    color: theme.colors.muted,
    textAlign: "right",
    marginTop: 3,
  },
  saveBtn: { marginTop: theme.spacing.m, alignSelf: "flex-start" },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.m,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.s,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  check: { color: "#fff", fontSize: 16, fontWeight: "800" },
  checkLabel: { fontSize: 15, color: theme.colors.text, flex: 1 },
  publishBtn: { marginTop: theme.spacing.l, minHeight: 56 },
  regenBtn: { marginTop: theme.spacing.s },
  toast: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: "#1F2933",
    borderRadius: theme.radius.m,
    padding: 14,
    alignItems: "center",
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
