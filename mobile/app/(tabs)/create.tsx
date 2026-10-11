/**
 * mobile/app/(tabs)/create.tsx — S1 Capture (§7.5).
 *
 * Requires login (sign-in prompt otherwise). Photo via camera or library,
 * preview + Retake, placeLabel (3–120), problemText (10–500, counter),
 * fixed "Shade" chip, required consent checkbox. Submit is DISABLED while a
 * create request is in flight (E5 has no idempotency — double-tap guard).
 * On success → /proposal/[id]/suggest?jobId=.... Errors keep form data and
 * show inline fieldErrors.
 */
import React, { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { fonts } from "../../src/theme";
import { Text } from "../../src/components/Text";
import { useTopInset } from "../../src/lib/useTopInset";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth/AuthProvider";
import { ErrorState, asApiError } from "../../src/components/ErrorState";
import { FieldError } from "../../src/components/FieldError";
import { PrimaryButton, ACCENT, INK, MUTED, PAPER } from "../../src/components/PrimaryButton";

const CONSENT_TEXT =
  "I took this photo or have permission, and it does not show identifiable people, plates or private information.";

function guessMimeType(uri: string, reported?: string): string {
  if (reported) return reported;
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export default function CreateScreen() {
  const top = useTopInset();
  const { isLoading, isLoggedIn, login } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState("image/jpeg");
  const [placeLabel, setPlaceLabel] = useState("");
  const [problemText, setProblemText] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<unknown>(null);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.signedOutTitle}>Sign in to create a proposal</Text>
        <Text style={styles.signedOutText}>
          You need an account to photograph a place and propose an improvement.
        </Text>
        <PrimaryButton title="Sign in" onPress={login} style={styles.signInBtn} />
      </View>
    );
  }

  const pickPhoto = async (useCamera: boolean) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setGeneralError(new Error("Permission denied. Allow photo access to continue."));
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
        });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoMime(guessMimeType(asset.uri, asset.mimeType));
      setGeneralError(null);
      setFieldErrors((f) => ({ ...f, photo: [] }));
    }
  };

  const validate = (): Record<string, string[]> => {
    const errs: Record<string, string[]> = {};
    if (!photoUri) errs.photo = ["Add a photo of the place."];
    if (placeLabel.trim().length < 3)
      errs.placeLabel = ["Name the place (at least 3 characters)."];
    else if (placeLabel.trim().length > 120)
      errs.placeLabel = ["Keep it under 120 characters."];
    if (problemText.trim().length < 10)
      errs.problemText = ["Describe the problem (at least 10 characters)."];
    else if (problemText.trim().length > 500)
      errs.problemText = ["Keep it under 500 characters."];
    if (!consent) errs.consent = ["Please confirm the photo consent."];
    return errs;
  };

  const submit = async () => {
    if (submitting) return; // double-tap guard: E5 has no idempotency
    const errs = validate();
    setFieldErrors(errs);
    if (Object.values(errs).some((v) => v.length > 0)) return;
    setSubmitting(true);
    setGeneralError(null);
    try {
      const { proposal, jobId } = await api.createProposal({
        photoUri: photoUri as string,
        mimeType: photoMime,
        placeLabel: placeLabel.trim(),
        problemText: problemText.trim(),
        category: "shade",
        consent: true,
      });
      router.push({
        pathname: "/proposal/[id]/suggest",
        params: { id: proposal.id, jobId },
      });
    } catch (e) {
      const apiError = asApiError(e);
      // Inline field errors; keep every bit of form data (§7.5 S1).
      setFieldErrors((f) => ({ ...f, ...apiError.fieldErrors }));
      setGeneralError(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: 20 + top }]}>
      <Text style={styles.heading}>Photograph a place</Text>

      {photoUri ? (
        <View>
          <Image
            source={{ uri: photoUri }}
            style={styles.preview}
            accessibilityLabel="Selected photo"
          />
          <View style={styles.retakeRow}>
            <PrimaryButton
              title="Retake"
              variant="secondary"
              onPress={() => setPhotoUri(null)}
            />
          </View>
        </View>
      ) : (
        <View style={styles.photoButtons}>
          <PrimaryButton title="Take photo" onPress={() => pickPhoto(true)} />
          <PrimaryButton
            title="Choose from library"
            variant="secondary"
            onPress={() => pickPhoto(false)}
            style={styles.libraryBtn}
          />
        </View>
      )}
      <FieldError errors={fieldErrors.photo} />

      <Text style={styles.label}>Place</Text>
      <TextInput
        style={styles.input}
        value={placeLabel}
        onChangeText={setPlaceLabel}
        placeholder="e.g. MARTA stop, Ponce de Leon Ave"
        maxLength={120}
        accessibilityLabel="Place name"
      />
      <FieldError errors={fieldErrors.placeLabel} />

      <Text style={styles.label}>What's the problem?</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={problemText}
        onChangeText={setProblemText}
        placeholder="e.g. No shade while waiting in the afternoon sun."
        maxLength={500}
        multiline
        accessibilityLabel="Problem description"
      />
      <Text style={styles.counter}>{problemText.length}/500</Text>
      <FieldError errors={fieldErrors.problemText} />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Shade</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.consentRow}
        onPress={() => setConsent((c) => !c)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
      >
        <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
          {consent ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.consentText}>{CONSENT_TEXT}</Text>
      </TouchableOpacity>
      <FieldError errors={fieldErrors.consent} />

      {generalError ? (
        <View style={styles.errorWrap}>
          <ErrorState error={generalError} />
        </View>
      ) : null}

      <PrimaryButton
        title={submitting ? "Creating…" : "Create proposal"}
        onPress={submit}
        disabled={submitting}
        loading={submitting}
        style={styles.submit}
      />
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
  photoButtons: { gap: 10, marginBottom: 8 },
  libraryBtn: { marginTop: 2 },
  preview: { width: "100%", height: 280, borderRadius: 12, backgroundColor: "#E5E7EB" },
  retakeRow: { marginTop: 10, alignSelf: "flex-start" },
  label: { fontSize: 15, fontWeight: "700", color: INK, marginTop: 16, marginBottom: 6 },
  input: {
    fontFamily: fonts.regular,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E0D3",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 15,
    color: INK,
  },
  multiline: { minHeight: 96, paddingVertical: 10, textAlignVertical: "top" },
  counter: { fontSize: 12, color: MUTED, textAlign: "right", marginTop: 4 },
  chipRow: { flexDirection: "row" },
  chip: {
    backgroundColor: "#E6F2EB",
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: { color: ACCENT, fontWeight: "700", fontSize: 14 },
  consentRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, gap: 10 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: ACCENT },
  checkmark: { color: "#fff", fontWeight: "800" },
  consentText: { flex: 1, fontSize: 13, color: INK, lineHeight: 19 },
  errorWrap: { marginTop: 14 },
  submit: { marginTop: 20 },
  signedOutTitle: { fontSize: 18, fontWeight: "800", color: INK, marginBottom: 8, textAlign: "center" },
  signedOutText: { fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 20 },
  signInBtn: { minWidth: 200 },
});
