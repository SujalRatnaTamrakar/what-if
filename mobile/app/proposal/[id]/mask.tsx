/**
 * mobile/app/proposal/[id]/mask.tsx — S3 Brush (§7.5), studio step 3.
 *
 * MaskCanvas over proposal.source.url (contentFit="contain"). Paint/Erase,
 * three brush sizes (0.03/0.05/0.08 of width) with a live size preview,
 * Undo, Clear, peek (hide overlay), and a coverage meter that warns before
 * the 60% server limit. Strokes persist per proposal (maskDraft) so coming
 * back to adjust keeps your work. Continue needs ≥1 paint stroke →
 * api.saveMask → /proposal/[id]/generate.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../../src/components/Text";
import { Button } from "../../../src/ui/Button";
import { Chip } from "../../../src/ui/Chip";
import { StepProgress } from "../../../src/ui/StepProgress";
import { ScreenHeader } from "../../../src/components/ScreenHeader";
import { MaskCanvas } from "../../../src/components/MaskCanvas";
import { ErrorState, asApiError } from "../../../src/components/ErrorState";
import { BrushIcon, EraserIcon, EyeIcon, TrashIcon, UndoIcon, WandIcon } from "../../../src/components/icons";
import { api } from "../../../src/api";
import { useInvalidateProposal, useProposal } from "../../../src/hooks/useProposal";
import { getMaskDraft, setMaskDraft } from "../../../src/lib/maskDraft";
import { maskCoverage } from "../../../src/lib/maskCoverage";
import { theme } from "../../../src/theme";
import type { MaskStrokes } from "../../../src/api/types";

const BRUSH_SIZES = [
  { label: "S", value: 0.03 },
  { label: "M", value: 0.05 },
  { label: "L", value: 0.08 },
];
const LIMIT = 0.6;

export default function MaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposalQuery = useProposal(id);
  const invalidateProposal = useInvalidateProposal();
  const insets = useSafeAreaInsets();

  const [strokes, setStrokes] = useState<MaskStrokes>(() => getMaskDraft(id as string) ?? { version: 1, strokes: [] });
  const [mode, setMode] = useState<"paint" | "erase">("paint");
  const [brushWidth, setBrushWidth] = useState(0.05);
  const [peek, setPeek] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (id) setMaskDraft(id, strokes);
  }, [id, strokes]);

  const proposal = proposalQuery.data;
  const aspect = proposal ? proposal.source.width / proposal.source.height : 1;
  const coverage = useMemo(() => maskCoverage(strokes, aspect), [strokes, aspect]);

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
        <ScreenHeader title="Brush the change" />
        <View style={{ padding: 20 }}>
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
      await api.saveMask(id as string, { expectedRevision: proposal.revision, strokes });
      invalidateProposal(id as string);
      router.push({ pathname: "/proposal/[id]/generate", params: { id: id as string } });
    } catch (e) {
      const apiError = asApiError(e);
      if (apiError.code === "REVISION_CONFLICT") invalidateProposal(id as string);
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
            accessibilityRole="button"
            accessibilityLabel="Hold to see the photo without your brush"
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
          <View style={styles.ideaPill} pointerEvents="none">
            <WandIcon size={14} color="#fff" />
            <Text style={styles.ideaText} numberOfLines={1}>
              {option.title}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <View style={styles.row}>
          <Chip
            label="Paint"
            active={mode === "paint"}
            onPress={() => setMode("paint")}
            icon={(c) => <BrushIcon size={16} color={c} />}
          />
          <Chip
            label="Erase"
            active={mode === "erase"}
            onPress={() => setMode("erase")}
            icon={(c) => <EraserIcon size={16} color={c} />}
          />
          <View style={styles.vr} />
          {BRUSH_SIZES.map((b) => {
            const active = brushWidth === b.value;
            return (
              <Pressable
                key={b.label}
                onPress={() => setBrushWidth(b.value)}
                accessibilityRole="button"
                accessibilityLabel={`Brush size ${b.label}`}
                accessibilityState={{ selected: active }}
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
            <Text style={styles.hint} numberOfLines={2}>
              {option?.maskHint ?? "Brush the area you'd like to change."}
            </Text>
            <Text style={[styles.pct, tooBig && { color: theme.colors.coral }]}>{pct}%</Text>
          </View>
          <View style={styles.meter} accessibilityLabel={`Brushed ${pct} percent of the photo, limit 60`}>
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  canvasWrap: { flex: 1, backgroundColor: "#141A17" },
  ideaPill: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    maxWidth: "86%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.scrim,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ideaText: { color: "#fff", fontSize: 13, fontWeight: "600", flexShrink: 1 },
  peek: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  peekOn: { backgroundColor: theme.colors.accent },
  controls: { paddingHorizontal: 16, paddingTop: 14, gap: 12, backgroundColor: theme.colors.background },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  vr: { width: 1, height: 28, backgroundColor: theme.colors.border, marginHorizontal: 2 },
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
  hint: { flex: 1, fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  pct: { fontSize: 13, fontWeight: "700", color: theme.colors.accent },
  meter: { height: 6, borderRadius: 3, backgroundColor: theme.colors.border, marginTop: 8, overflow: "hidden" },
  meterFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.orange },
  warn: { fontSize: 12, color: theme.colors.coral, marginTop: 6 },
});
