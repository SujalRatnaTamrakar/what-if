/**
 * mobile/app/proposal/[id]/mask.tsx — S3 Brush (§7.5).
 *
 * MaskCanvas over proposal.source.url (contentFit="contain"). Paint/Erase
 * modes, three brush sizes (0.03/0.05/0.08 of width), Undo, Clear. Strokes
 * stay in local state so the user can come back and adjust. Continue is
 * disabled until at least one paint stroke exists → api.saveMask →
 * /proposal/[id]/generate.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/api";
import { useInvalidateProposal, useProposal } from "../../../src/hooks/useProposal";
import { ErrorState, asApiError } from "../../../src/components/ErrorState";
import { MaskCanvas } from "../../../src/components/MaskCanvas";
import { PrimaryButton, ACCENT, INK, MUTED, PAPER } from "../../../src/components/PrimaryButton";
import type { MaskStrokes } from "../../../src/api/types";

const BRUSH_SIZES = [
  { label: "Small", value: 0.03 },
  { label: "Medium", value: 0.05 },
  { label: "Large", value: 0.08 },
];

export default function MaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposalQuery = useProposal(id);
  const invalidateProposal = useInvalidateProposal();

  const [strokes, setStrokes] = useState<MaskStrokes>({ version: 1, strokes: [] });
  const [mode, setMode] = useState<"paint" | "erase">("paint");
  const [brushWidth, setBrushWidth] = useState(0.05);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const proposal = proposalQuery.data;

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

  const option = proposal.scene?.options.find(
    (o) => o.id === proposal.selectedOptionId
  );
  const hasPaintStroke = strokes.strokes.some(
    (s) => s.mode === "paint" && s.points.length > 0
  );

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
      await api.saveMask(id as string, {
        expectedRevision: proposal.revision,
        strokes,
      });
      invalidateProposal(id as string);
      router.push({ pathname: "/proposal/[id]/generate", params: { id: id as string } });
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === "REVISION_CONFLICT") {
        invalidateProposal(id as string);
      }
      setError(apiError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.heading}>Brush the change</Text>
        {option ? <Text style={styles.maskHint}>{option.maskHint}</Text> : null}
      </View>

      <View style={styles.canvasWrap}>
        <MaskCanvas
          imageUrl={proposal.source.url}
          imageWidth={proposal.source.width}
          imageHeight={proposal.source.height}
          strokes={strokes}
          onStrokesChange={setStrokes}
          mode={mode}
          brushWidth={brushWidth}
        />
      </View>

      <View style={styles.controls}>
        <View style={styles.segContainer}>
          {(["paint", "erase"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              style={[styles.seg, mode === m && styles.segActive]}
            >
              <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                {m === "paint" ? "🖌 Paint" : "🧽 Erase"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          {BRUSH_SIZES.map((b) => (
            <TouchableOpacity
              key={b.label}
              onPress={() => setBrushWidth(b.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: brushWidth === b.value }}
              style={[styles.sizePill, brushWidth === b.value && styles.sizePillActive]}
            >
              <Text
                style={[
                  styles.sizeText,
                  brushWidth === b.value && styles.sizeTextActive,
                ]}
              >
                {b.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            onPress={undo}
            disabled={strokes.strokes.length === 0}
            style={[styles.toolBtn, strokes.strokes.length === 0 && styles.toolDisabled]}
          >
            <Text style={styles.toolText}>↩ Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clear}
            disabled={strokes.strokes.length === 0}
            style={[styles.toolBtn, strokes.strokes.length === 0 && styles.toolDisabled]}
          >
            <Text style={styles.toolText}>🗑 Clear</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorWrap}>
            <ErrorState error={error} />
          </View>
        ) : null}

        <PrimaryButton
          title={saving ? "Saving…" : "Continue"}
          onPress={saveAndContinue}
          disabled={!hasPaintStroke || saving}
          loading={saving}
        />
        {!hasPaintStroke ? (
          <Text style={styles.needBrush}>Brush the area you'd like to change first.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER },
  center: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 20, fontWeight: "800", color: ACCENT },
  maskHint: { fontSize: 14, color: INK, marginTop: 6 },
  canvasWrap: { flex: 1, backgroundColor: "#111" },
  controls: { padding: 16, gap: 10, backgroundColor: PAPER },
  row: { flexDirection: "row", gap: 8 },
  segContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E0D3",
    padding: 4,
    gap: 4,
  },
  seg: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segActive: { backgroundColor: ACCENT },
  segText: { fontSize: 14, fontWeight: "600", color: MUTED },
  segTextActive: { color: "#fff" },
  sizePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#EFEAE0",
    alignItems: "center",
    justifyContent: "center",
  },
  sizePillActive: { backgroundColor: ACCENT },
  sizeText: { fontSize: 14, fontWeight: "600", color: INK },
  sizeTextActive: { color: "#fff" },
  toolBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  toolDisabled: { opacity: 0.4 },
  toolText: { fontSize: 14, fontWeight: "600", color: INK },
  errorWrap: { marginVertical: 4 },
  needBrush: { fontSize: 12, color: MUTED, textAlign: "center" },
});
