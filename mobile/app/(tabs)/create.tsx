/**
 * mobile/app/(tabs)/create.tsx — S1 Capture (§7.5), step 1 of the studio.
 *
 * Requires login. Photo via camera or library (big preview + Retake),
 * placeLabel (3–120) with "Use my location" (reverse geocode), problemText
 * (10–500) with quick-pick chips, fixed "Shade" category, required consent.
 * Submit is DISABLED while a create request is in flight (E5 has no
 * idempotency — double-tap guard). On success the capture location is
 * remembered on-device for the Map, then → /proposal/[id]/suggest?jobId=.
 * Errors keep form data and show inline fieldErrors.
 */
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Text } from "../../src/components/Text";
import { Display } from "../../src/ui/Display";
import { Button } from "../../src/ui/Button";
import { Field } from "../../src/ui/Field";
import { CheckRow } from "../../src/ui/CheckRow";
import { StepProgress } from "../../src/ui/StepProgress";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState, asApiError } from "../../src/components/ErrorState";
import { CameraIcon, ImageIcon, LocateIcon, SparkleIcon, XIcon } from "../../src/components/icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth/AuthProvider";
import { rememberProposalLocation, type LatLng } from "../../src/lib/places";
import { useTopInset } from "../../src/lib/useTopInset";
import { useToast } from "../../src/ui/Toast";
import { shadows, theme } from "../../src/theme";

const CONSENT_TEXT =
  "I took this photo or have permission, and it does not show identifiable people, plates or private information.";

const PROBLEM_IDEAS = [
  "No shade while waiting in the sun",
  "Bench sits in full afternoon sun",
  "Hot sidewalk with no trees",
  "Bus stop has no cover from rain",
];

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
  const toast = useToast();
  const { isLoading, isLoggedIn, login } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState("image/jpeg");
  const [photoRatio, setPhotoRatio] = useState(3 / 4);
  const [placeLabel, setPlaceLabel] = useState("");
  const [problemText, setProblemText] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [capturedAt, setCapturedAt] = useState<LatLng | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<unknown>(null);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={[styles.center, { paddingTop: top }]}>
        <EmptyState
          icon={<CameraIcon size={40} color={theme.colors.accent} />}
          title="Imagine a better place"
          message="Sign in to photograph a spot, brush the change, and let AI show what it could be."
          actionLabel="Sign in"
          onAction={() => void login()}
        />
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
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9, exif: false };
    const result = useCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoMime(guessMimeType(asset.uri, asset.mimeType ?? undefined));
      if (asset.width && asset.height) setPhotoRatio(asset.width / asset.height);
      setGeneralError(null);
      setFieldErrors((f) => ({ ...f, photo: [] }));
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        toast.show("Location permission is off — type the place instead.", "error");
        return;
      }
      const pos =
        (await Location.getLastKnownPositionAsync().catch(() => null)) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const at = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCapturedAt(at);
      const [addr] = await Location.reverseGeocodeAsync(at).catch(() => []);
      if (addr) {
        const label = [addr.name && addr.name !== addr.street ? addr.name : null, addr.street, addr.city]
          .filter(Boolean)
          .join(", ")
          .slice(0, 120);
        if (label.length >= 3) {
          setPlaceLabel(label);
          setFieldErrors((f) => ({ ...f, placeLabel: [] }));
        }
      }
      toast.show("Location pinned for the map", "success");
    } catch {
      toast.show("Couldn't get your location — type the place instead.", "error");
    } finally {
      setLocating(false);
    }
  };

  const validate = (): Record<string, string[]> => {
    const errs: Record<string, string[]> = {};
    if (!photoUri) errs.photo = ["Add a photo of the place."];
    if (placeLabel.trim().length < 3) errs.placeLabel = ["Name the place (at least 3 characters)."];
    else if (placeLabel.trim().length > 120) errs.placeLabel = ["Keep it under 120 characters."];
    if (problemText.trim().length < 10) errs.problemText = ["Describe the problem (at least 10 characters)."];
    else if (problemText.trim().length > 500) errs.problemText = ["Keep it under 500 characters."];
    if (!consent) errs.consent = ["Please confirm the photo consent."];
    return errs;
  };

  const submit = async () => {
    if (submitting) return; // double-tap guard: E5 has no idempotency
    const errs = validate();
    setFieldErrors(errs);
    if (Object.values(errs).some((v) => v.length > 0)) {
      toast.show(Object.values(errs).find((v) => v.length)?.[0] ?? "Check the form.", "error");
      return;
    }
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
      if (capturedAt) void rememberProposalLocation(proposal.id, capturedAt);
      // Reset for the next proposal; this one continues in the studio.
      setPhotoUri(null);
      setPlaceLabel("");
      setProblemText("");
      setConsent(false);
      setCapturedAt(null);
      router.push({ pathname: "/proposal/[id]/suggest", params: { id: proposal.id, jobId } });
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top + 14 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Display size={30}>
            Photograph{"\n"}
            <Display size={30} italic color={theme.colors.accent}>
              a place.
            </Display>
          </Display>
          <Text style={styles.lede}>Pick a spot that could be cooler, shadier, kinder. AI will suggest what could change.</Text>
        </View>
        <StepProgress step={1} />

        {photoUri ? (
          <Animated.View entering={FadeIn} style={[styles.preview, { aspectRatio: Math.max(0.6, Math.min(photoRatio, 1.6)) }]}>
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Selected photo" />
            <Pressable
              onPress={() => setPhotoUri(null)}
              accessibilityRole="button"
              accessibilityLabel="Remove photo and retake"
              style={styles.retake}
            >
              <XIcon size={16} color="#fff" />
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.pickRow}>
            <Pressable
              onPress={() => void pickPhoto(true)}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              style={({ pressed }) => [styles.pickTile, styles.pickPrimary, pressed && styles.pressed]}
            >
              <View style={styles.pickIconPrimary}>
                <CameraIcon size={30} color="#fff" />
              </View>
              <Text style={styles.pickTitlePrimary}>Take photo</Text>
              <Text style={styles.pickSubPrimary}>Stand where people wait</Text>
            </Pressable>
            <Pressable
              onPress={() => void pickPhoto(false)}
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
              style={({ pressed }) => [styles.pickTile, pressed && styles.pressed]}
            >
              <View style={styles.pickIcon}>
                <ImageIcon size={28} color={theme.colors.accent} />
              </View>
              <Text style={styles.pickTitle}>From library</Text>
              <Text style={styles.pickSub}>Use a recent shot</Text>
            </Pressable>
          </Animated.View>
        )}
        {fieldErrors.photo?.length ? <Text style={styles.err}>{fieldErrors.photo[0]}</Text> : null}

        <View style={styles.form}>
          <Field
            label="Place"
            value={placeLabel}
            onChangeText={setPlaceLabel}
            placeholder="e.g. MARTA stop, Ponce de Leon Ave"
            maxLength={120}
            errors={fieldErrors.placeLabel}
          />
          <Pressable
            onPress={() => void useMyLocation()}
            disabled={locating}
            accessibilityRole="button"
            style={styles.locBtn}
          >
            {locating ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <LocateIcon size={16} color={theme.colors.accent} />
            )}
            <Text style={styles.locText}>{capturedAt ? "Location pinned ✓" : "Use my location"}</Text>
          </Pressable>

          <Field
            label="What's the problem here?"
            value={problemText}
            onChangeText={setProblemText}
            placeholder="e.g. No shade while waiting in the afternoon sun."
            maxLength={500}
            multiline
            errors={fieldErrors.problemText}
            suggestions={problemText ? undefined : PROBLEM_IDEAS}
            onSuggestion={(s) => setProblemText(s + ".")}
          />

          <View style={styles.categoryRow}>
            <Text style={styles.categoryLabel}>Category</Text>
            <View style={styles.categoryChip}>
              <SparkleIcon size={14} color={theme.colors.accent} />
              <Text style={styles.categoryText}>Shade & cooling</Text>
            </View>
          </View>

          <CheckRow checked={consent} onToggle={() => setConsent((c) => !c)} label="Photo consent" sub={CONSENT_TEXT} />
          {fieldErrors.consent?.length ? <Text style={styles.err}>{fieldErrors.consent[0]}</Text> : null}

          {generalError ? (
            <View style={{ marginTop: 12 }}>
              <ErrorState error={generalError} />
            </View>
          ) : null}

          <Button
            title={submitting ? "Uploading…" : "Analyze with AI"}
            onPress={() => void submit()}
            loading={submitting}
            icon={(c) => <SparkleIcon size={18} color={c} />}
            style={styles.submit}
          />
          <Text style={styles.footnote}>Photos are stripped of location data before AI sees them.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 48 },
  head: { paddingHorizontal: 20, marginBottom: 14 },
  lede: { fontSize: 15, color: theme.colors.muted, lineHeight: 22, marginTop: 8 },
  pickRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 4 },
  pickTile: {
    flex: 1,
    minHeight: 176,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card,
    padding: 16,
    justifyContent: "flex-end",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  pickPrimary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent, borderStyle: "solid", ...shadows.lift },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  pickIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "auto",
  },
  pickIconPrimary: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "auto",
  },
  pickTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  pickSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  pickTitlePrimary: { fontSize: 16, fontWeight: "700", color: "#fff" },
  pickSubPrimary: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  preview: {
    marginHorizontal: 20,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    backgroundColor: theme.colors.paperDeep,
    maxHeight: 460,
    ...shadows.card,
  },
  retake: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.scrim,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  retakeText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  form: { paddingHorizontal: 20, marginTop: 20 },
  locBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.accentSoft,
    marginTop: -2,
    marginBottom: 14,
  },
  locText: { color: theme.colors.accentDark, fontWeight: "600", fontSize: 13 },
  categoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 10 },
  categoryLabel: { fontSize: 14, color: theme.colors.muted, fontWeight: "500" },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  categoryText: { color: theme.colors.accentDark, fontWeight: "600", fontSize: 13 },
  err: { color: theme.colors.danger, fontSize: 12, marginTop: 6, marginHorizontal: 24 },
  submit: { marginTop: 18 },
  footnote: { fontSize: 12, color: theme.colors.faint, textAlign: "center", marginTop: 10 },
});
