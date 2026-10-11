/**
 * web/src/lib/maskDraft.ts — keeps each proposal's brush strokes in
 * memory so the Imagine screen can show what you brushed, and the Brush
 * screen restores your strokes when you come back to adjust.
 */
import type { MaskStrokes } from "../api/types";

const drafts = new Map<string, MaskStrokes>();

export function setMaskDraft(id: string, strokes: MaskStrokes) {
  drafts.set(id, strokes);
}

export function getMaskDraft(id: string): MaskStrokes | undefined {
  return drafts.get(id);
}
