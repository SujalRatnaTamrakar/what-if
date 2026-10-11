/**
 * web/src/screens/proposal/Mask.tsx — S3 Brush (§7.5), studio step 3.
 *
 * MaskCanvas over proposal.source.url (object-fit: contain). Paint/Erase,
 * three brush sizes (0.03/0.05/0.08 of width) with a live size preview,
 * Undo (also Ctrl/Cmd+Z), Clear, peek (hold to hide overlay), and a coverage
 * meter that warns before the 60% server limit. Strokes persist per proposal
 * (maskDraft) so coming back to adjust keeps your work. Continue needs ≥1
 * paint stroke → api.saveMask → /proposal/[id]/generate.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { COLUMN, CenterSpinner, Pressable, Text, View, styleSheet } from "../../ui/primitives";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { StepProgress } from "../../ui/StepProgress";
import { ScreenHeader } from "../../components/ScreenHeader";
import { MaskCanvas } from "../../components/MaskCanvas";
import { ErrorState, asApiError } from "../../components/ErrorState";
import { BrushIcon, EraserIcon, EyeIcon, TrashIcon, UndoIcon, WandIcon } from "../../components/icons";
import { api } from "../../api";
import { useInvalidateProposal, useProposal } from "../../hooks/useProposal";
import { getMaskDraft, setMaskDraft } from "../../lib/maskDraft";
import { maskCoverage } from "../../lib/maskCoverage";
import { useRouter } from "../../lib/nav";
import { theme } from "../../theme";
import type { MaskStrokes } from "../../api/types";

const BRUSH_SIZES = [
  { label: "S", value: 0.03 },
  { label: "M", value: 0.05 },
  { label: "L", value: 0.08 },
];
const LIMIT = 0.6;

export default function MaskScreen() {
  const { id = "" } = useParams<{ id: string }>();
  const router = useRouter();
  const proposalQuery = useProposal(id);
  const invalidateProposal = useInvalidateProposal();

  const [strokes, setStrokes] = useState<MaskStrokes>(() => getMaskDraft(id) ?? { version: 1, strokes: [] });
  const [mode, setMode] = useState<"paint" | "erase">("paint");
  const [brushWidth, setBrushWidth] = useState(0.05);
  const [peek, setPeek] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (id) setMaskDraft(id, strokes);
  }, [id, strokes]);

  // Ctrl/Cmd+Z = undo (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      setStrokes((s) => ({ version: 1, strokes: s.strokes.slice(0, -1) }));
      setError(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const proposal = proposalQuery.data;
  const aspect = proposal ? proposal.source.width / proposal.source.height : 1;
  const coverage = useMemo(() => maskCoverage(strokes, aspect), [strokes, aspect]);

  if (proposalQuery.isLoading) return <CenterSpinner />;
  if (proposalQuery.isError || !proposal) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Brush the change" />
        <View style={{ padding: 20, width: "100%", maxWidth: COLUMN, alignSelf: "center" }}>
          <ErrorState error={proposalQuery.error} onRetry={() => proposalQuery.refetch()} />
        </View>
      </View>
    );
  }

  const option = proposal.scene?.options.find((o) => o.id === proposal.selectedOptionId);
  const hasPaintStroke = strokes.strokes.some((s) => s.mode === "paint" && s.points.length > 0);
  const empty = strokes.strokes.length === 0;
  const tooBig = coverage > LIMIT;
  const pct = Math.round(coverage * 100);

  const undo = () => {
    setStrokes((s) => ({ version: 1, strokes: s.strokes.slice(0, -1) }));
    setError(null);
  };
  const clear = () => {
    setStrokes({ version: 1, strokes: [] });
    setError(null);
  };

  const saveAndContinue = async () => {
    if (!hasPaintStroke || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.saveMask(id, { expectedRevision: proposal.revision, strokes });
      invalidateProposal(id);
      router.push(`/proposal/${id}/generate`);
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === "REVISION_CONFLICT") invalidateProposal(id);
      setError(apiError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Brush the change"
        accentTitle
        right={
          <Pressable
            onPressIn={() => setPeek(true)}
            onPressOut={() => setPeek(false)}
            label="Hold to see the photo without your brush"
            feedback="none"
            style={[styles.peek, peek && styles.peekOn]}
          >
            <EyeIcon size={20} color={peek ? "#fff" : theme.colors.text} />
          </Pressable>
        }
      />
      <StepProgress step={3} />

      <View style={styles.canvasWrap}>
        <MaskCanvas
          imageUrl={proposal.source.url}
          imageWidth={proposal.source.width}
          imageHeight={proposal.source.height}
          strokes={strokes}
          onStrokesChange={setStrokes}
          mode={mode}
          brushWidth={brushWidth}
          overlayVisible={!peek}
        />
        {option ? (
          <View style={styles.ideaRow}>
            <View style={styles.ideaPill}>
              <WandIcon size={14} color="#fff" />
              <Text style={styles.ideaText} lines={1}>
                {option.title}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.controlsOuter}>
        <View style={styles.controls}>
          <View style={styles.row}>
            <Chip label="Paint" active={mode === "paint"} onPress={() => setMode("paint")} icon={(c) => <BrushIcon size={16} color={c} />} />
            <Chip label="Erase" active={mode === "erase"} onPress={() => setMode("erase")} icon={(c) => <EraserIcon size={16} color={c} />} />
            <View style={styles.vr} />
            {BRUSH_SIZES.map((b) => {
              const active = brushWidth === b.value;
              return (
                <Pressable
                  key={b.label}
                  onPress={() => setBrushWidth(b.value)}
                  label={`Brush size ${b.label}`}
                  selected={active}
                  feedback="opacity"
                  style={[styles.size, active && styles.sizeOn]}
                >
                  <View
                    style={{
                      width: b.value * 260,
                      height: b.value * 260,
                      borderRadius: 99,
                      backgroundColor: active ? "#fff" : theme.colors.orange,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>

          <View>
            <View style={styles.meterHead}>
              <Text style={styles.hint} lines={2}>
                {option?.maskHint ?? "Brush the area you'd like to change."}
              </Text>
              <Text style={[styles.pct, tooBig && { color: theme.colors.coral }]}>{pct}%</Text>
            </View>
            <View style={styles.meter} role="meter" aria-label={`Brushed ${pct} percent of the photo, limit 60`}>
              <View
                style={[
                  styles.meterFill,
                  { width: `${Math.min(100, (coverage / LIMIT) * 100)}%` },
                  tooBig && { backgroundColor: theme.colors.coral },
                ]}
              />
            </View>
            {tooBig ? <Text style={styles.warn}>That's a lot — brush less than 60% so the AI keeps the rest real.</Text> : null}
          </View>

          <View style={styles.row}>
            <Button title="Undo" variant="secondary" size="m" onPress={undo} disabled={empty} icon={(c) => <UndoIcon size={16} color={c} />} style={styles.flex} />
            <Button title="Clear" variant="secondary" size="m" onPress={clear} disabled={empty} icon={(c) => <TrashIcon size={16} color={c} />} style={styles.flex} />
          </View>

          {error ? <ErrorState error={error} /> : null}

          <Button
            title={hasPaintStroke ? "Imagine it" : "Brush first"}
            onPress={() => void saveAndContinue()}
            disabled={!hasPaintStroke || tooBig}
            loading={saving}
            icon={(c) => <WandIcon size={18} color={c} />}
          />
        </View>
      </View>
    </View>
  );
}

const styles = styleSheet({
  root: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
  canvasWrap: { flex: 1, minHeight: 0, backgroundColor: "#141A17" },
  ideaRow: { position: "absolute", top: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", pointerEvents: "none" },
  ideaPill: {
    maxWidth: "86%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.scrim,
    borderRadius: 999,
    padding: "7px 12px",
  },
  ideaText: { color: "#fff", fontSize: 13, fontWeight: 600, flexShrink: 1 },
  peek: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  peekOn: { backgroundColor: theme.colors.accent },
  controlsOuter: { backgroundColor: theme.colors.background },
  controls: {
    width: "100%",
    maxWidth: COLUMN,
    alignSelf: "center",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 14,
    paddingBottom: "calc(max(env(safe-area-inset-bottom), 12px) + 4px)",
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  vr: { width: 1, height: 28, backgroundColor: theme.colors.border, marginLeft: 2, marginRight: 2 },
  size: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.paperDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeOn: { backgroundColor: theme.colors.accent },
  meterHead: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  hint: { flex: 1, fontSize: 14, color: theme.colors.text, lineHeight: "20px" },
  pct: { fontSize: 13, fontWeight: 700, color: theme.colors.accent },
  meter: { height: 6, borderRadius: 3, backgroundColor: theme.colors.border, marginTop: 8, overflow: "hidden" },
  meterFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.orange, transition: "width 160ms ease" },
  warn: { fontSize: 12, color: theme.colors.coral, marginTop: 6 },
});
