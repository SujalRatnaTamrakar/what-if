/**
 * web/src/screens/Create.tsx — S1 Capture (§7.5), step 1 of the studio.
 *
 * Requires login. Photo via camera (capture on phones) or file picker /
 * drag-and-drop (big preview + Retake), placeLabel (3–120) with "Use my
 * location" (reverse geocode), problemText (10–500) with quick-pick chips,
 * fixed "Shade" category, required consent. Submit is DISABLED while a
 * create request is in flight (E5 has no idempotency — double-click guard).
 * On success the capture location is remembered in this browser for the
 * Map, then → /proposal/[id]/suggest?jobId=. Errors keep form data and show
 * inline fieldErrors.
 */
import React, { useEffect, useRef, useState } from "react";
import { COLUMN, CenterSpinner, Img, Pressable, Spinner, Text, View, styleSheet } from "../ui/primitives";
import { Display } from "../ui/Display";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { CheckRow } from "../ui/CheckRow";
import { StepProgress } from "../ui/StepProgress";
import { EmptyState } from "../components/EmptyState";
import { ErrorState, asApiError } from "../components/ErrorState";
import { CameraIcon, ImageIcon, LocateIcon, SparkleIcon, XIcon } from "../components/icons";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { useRouter } from "../lib/nav";
import { currentPosition, rememberProposalLocation, reverseGeocode, type LatLng } from "../lib/places";
import { useToast } from "../ui/Toast";
import { shadows, theme } from "../theme";

const CONSENT_TEXT =
  "I took this photo or have permission, and it does not show identifiable people, plates or private information.";

const PROBLEM_IDEAS = [
  "No shade while waiting in the sun",
  "Bench sits in full afternoon sun",
  "Hot sidewalk with no trees",
  "Bus stop has no cover from rain",
];

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,image/webp";

function guessMimeType(name: string, reported?: string): string {
  if (reported) return reported;
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export default function CreateScreen() {
  const router = useRouter();
  const toast = useToast();
  const { isLoading, isLoggedIn, login } = useAuth();
  const [photo, setPhoto] = useState<{ uri: string; file: File } | null>(null);
  const [photoMime, setPhotoMime] = useState("image/jpeg");
  const [photoRatio, setPhotoRatio] = useState(3 / 4);
  const [placeLabel, setPlaceLabel] = useState("");
  const [problemText, setProblemText] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [capturedAt, setCapturedAt] = useState<LatLng | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<unknown>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  // Free the preview object URL when it's replaced or the screen unmounts.
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.uri);
  }, [photo]);

  if (isLoading) return <CenterSpinner />;

  if (!isLoggedIn) {
    return (
      <View style={styles.center}>
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

  const takeFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setGeneralError(new Error("Use a JPEG, PNG, HEIC or WEBP photo."));
      return;
    }
    const uri = URL.createObjectURL(file);
    setPhoto({ uri, file });
    setPhotoMime(guessMimeType(file.name, file.type || undefined));
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth && probe.naturalHeight) setPhotoRatio(probe.naturalWidth / probe.naturalHeight);
    };
    probe.src = uri;
    setGeneralError(null);
    setFieldErrors((f) => ({ ...f, photo: [] }));
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const at = await currentPosition();
      setCapturedAt(at);
      const label = await reverseGeocode(at);
      if (label) {
        setPlaceLabel(label);
        setFieldErrors((f) => ({ ...f, placeLabel: [] }));
      }
      toast.show("Location pinned for the map", "success");
    } catch (e) {
      const denied = typeof GeolocationPositionError !== "undefined" && e instanceof GeolocationPositionError && e.code === e.PERMISSION_DENIED;
      toast.show(denied ? "Location permission is off — type the place instead." : "Couldn't get your location — type the place instead.", "error");
    } finally {
      setLocating(false);
    }
  };

  const validate = (): Record<string, string[]> => {
    const errs: Record<string, string[]> = {};
    if (!photo) errs.photo = ["Add a photo of the place."];
    if (placeLabel.trim().length < 3) errs.placeLabel = ["Name the place (at least 3 characters)."];
    else if (placeLabel.trim().length > 120) errs.placeLabel = ["Keep it under 120 characters."];
    if (problemText.trim().length < 10) errs.problemText = ["Describe the problem (at least 10 characters)."];
    else if (problemText.trim().length > 500) errs.problemText = ["Keep it under 500 characters."];
    if (!consent) errs.consent = ["Please confirm the photo consent."];
    return errs;
  };

  const submit = async () => {
    if (submitting) return; // double-click guard: E5 has no idempotency
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
        photoUri: photo!.uri,
        photoFile: photo!.file,
        mimeType: photoMime,
        placeLabel: placeLabel.trim(),
        problemText: problemText.trim(),
        category: "shade",
        consent: true,
      });
      if (capturedAt) void rememberProposalLocation(proposal.id, capturedAt);
      // Reset for the next proposal; this one continues in the studio.
      setPhoto(null);
      setPlaceLabel("");
      setProblemText("");
      setConsent(false);
      setCapturedAt(null);
      router.push(`/proposal/${proposal.id}/suggest?jobId=${encodeURIComponent(jobId)}`);
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
    <View className="scroll" style={styles.root}>
      <View style={styles.content}>
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

        <input ref={cameraInput} type="file" accept={ACCEPT} capture="environment" hidden onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = "";
        }} />
        <input ref={libraryInput} type="file" accept={ACCEPT} hidden onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = "";
        }} />

        {photo ? (
          <View className="anim-fade-in" style={[styles.preview, { aspectRatio: Math.max(0.6, Math.min(photoRatio, 1.6)) }]}>
            <Img src={photo.uri} fill alt="Selected photo" />
            <Pressable onPress={() => setPhoto(null)} label="Remove photo and retake" feedback="opacity" style={styles.retake}>
              <XIcon size={16} color="#fff" />
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
          </View>
        ) : (
          <View
            className="anim-fade-in-down"
            style={[styles.pickRow, dragging && { opacity: 0.85 }]}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              takeFile(e.dataTransfer.files?.[0]);
            }}
          >
            <Pressable onPress={() => cameraInput.current?.click()} label="Take photo" feedback="tile" style={[styles.pickTile, styles.pickPrimary]}>
              <View style={styles.pickIconPrimary}>
                <CameraIcon size={30} color="#fff" />
              </View>
              <Text style={styles.pickTitlePrimary}>Take photo</Text>
              <Text style={styles.pickSubPrimary}>Stand where people wait</Text>
            </Pressable>
            <Pressable
              onPress={() => libraryInput.current?.click()}
              label="Choose from library"
              feedback="tile"
              style={[styles.pickTile, dragging && { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft }]}
            >
              <View style={styles.pickIcon}>
                <ImageIcon size={28} color={theme.colors.accent} />
              </View>
              <Text style={styles.pickTitle}>From library</Text>
              <Text style={styles.pickSub}>Use a recent shot, or drop it here</Text>
            </Pressable>
          </View>
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
          <Pressable onPress={() => void useMyLocation()} disabled={locating} feedback="opacity" style={styles.locBtn}>
            {locating ? <Spinner size={16} /> : <LocateIcon size={16} color={theme.colors.accent} />}
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
      </View>
    </View>
  );
}

const styles = styleSheet({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
  center: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  content: { paddingTop: 14, paddingBottom: 48, width: "100%", maxWidth: COLUMN, alignSelf: "center" },
  head: { paddingLeft: 20, paddingRight: 20, marginBottom: 14 },
  lede: { fontSize: 15, color: theme.colors.muted, lineHeight: "22px", marginTop: 8 },
  pickRow: { flexDirection: "row", gap: 12, paddingLeft: 20, paddingRight: 20, marginTop: 4 },
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
    textAlign: "left",
  },
  pickPrimary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent, borderStyle: "solid", ...shadows.lift },
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
  pickTitle: { fontSize: 16, fontWeight: 700, color: theme.colors.text, marginTop: 16 },
  pickSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  pickTitlePrimary: { fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 16 },
  pickSubPrimary: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  preview: {
    marginLeft: 20,
    marginRight: 20,
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
    paddingLeft: 12,
    paddingRight: 12,
    minHeight: 36,
  },
  retakeText: { color: "#fff", fontWeight: 600, fontSize: 13 },
  form: { paddingLeft: 20, paddingRight: 20, marginTop: 20 },
  locBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: 40,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.accentSoft,
    marginTop: -2,
    marginBottom: 14,
  },
  locText: { color: theme.colors.accentDark, fontWeight: 600, fontSize: 13 },
  categoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 10 },
  categoryLabel: { fontSize: 14, color: theme.colors.muted, fontWeight: 500 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.accentSoft,
    padding: "7px 12px",
    borderRadius: 999,
  },
  categoryText: { color: theme.colors.accentDark, fontWeight: 600, fontSize: 13 },
  err: { color: theme.colors.danger, fontSize: 12, marginTop: 6, marginLeft: 24, marginRight: 24 },
  submit: { marginTop: 18 },
  footnote: { fontSize: 12, color: theme.colors.faint, textAlign: "center", marginTop: 10 },
});
