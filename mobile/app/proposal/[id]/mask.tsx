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
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../../src/components/Text";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../../src/api";
import { useInvalidateProposal, useProposal } from "../../../src/hooks/useProposal";
import { ErrorState, asApiError } from "../../../src/components/ErrorState";
import { ScreenHeader } from "../../../src/components/ScreenHeader";
import { BrushIcon, EraserIcon, TrashIcon, UndoIcon } from "../../../src/components/icons";
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
  const insets = useSafeAreaInsets();

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

  const chip = (
    label: string,
    active: boolean,
    onPress: () => void,
    icon?: React.ReactNode
  ) => (
    <Pressable
      key={label}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon}
      <Text style={[styles.chipText, active && styles.chipTextActive, icon ? { marginLeft: 8 } : null]}>
        {label}
      </Text>
    </Pressable>
  );
  const empty = strokes.strokes.length === 0;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Brush the change" accentTitle />

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

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <View style={[styles.row, styles.wrapRow]}>
          {chip(
            "Paint",
            mode === "paint",
            () => setMode("paint"),
            <BrushIcon size={18} color={mode === "paint" ? "#fff" : INK} />
          )}
          {chip(
            "Erase",
            mode === "erase",
            () => setMode("erase"),
            <EraserIcon size={18} color={mode === "erase" ? "#fff" : INK} />
          )}
          <View style={styles.vr} />
          {BRUSH_SIZES.map((b) =>
            chip(b.label, brushWidth === b.value, () => setBrushWidth(b.value))
          )}
        </View>

        <Text style={styles.maskHint}>
          {option?.maskHint ?? "Brush the area you'd like to change."}
        </Text>

        <View style={styles.row}>
          <Pressable
            onPress={undo}
            disabled={empty}
            accessibilityRole="button"
            accessibilityLabel="Undo last stroke"
            style={[styles.toolBtn, empty && styles.toolDisabled]}
          >
            <UndoIcon size={18} color={INK} />
            <Text style={styles.toolText}>Undo</Text>
          </Pressable>
          <Pressable
            onPress={clear}
            disabled={empty}
            accessibilityRole="button"
            accessibilityLabel="Clear all strokes"
            style={[styles.toolBtn, empty && styles.toolDisabled]}
          >
            <TrashIcon size={18} color={INK} />
            <Text style={styles.toolText}>Clear</Text>
          </Pressable>
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
  maskHint: { fontSize: 14, color: INK, textAlign: "left" },
  canvasWrap: { flex: 1, backgroundColor: "#111" },
  controls: { paddingHorizontal: 16, paddingTop: 14, gap: 12, backgroundColor: PAPER },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrapRow: { flexWrap: "wrap", rowGap: 8 },
  vr: { width: 1, alignSelf: "stretch", marginVertical: 6, backgroundColor: "#DDD6C6" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#ECE6D8",
  },
  chipActive: { backgroundColor: ACCENT },
  chipText: { fontSize: 14, fontWeight: "600", color: INK },
  chipTextActive: { color: "#fff" },
  toolBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6D0C2",
  },
  toolDisabled: { opacity: 0.4 },
  toolText: { fontSize: 15, fontWeight: "600", color: INK },
  errorWrap: { marginVertical: 4 },
  needBrush: { fontSize: 12, color: MUTED, textAlign: "center" },
});
