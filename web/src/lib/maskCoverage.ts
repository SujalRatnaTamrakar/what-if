/**
 * web/src/lib/maskCoverage.ts — approximate share of the photo covered by
 * the brush (paint minus erase), on a coarse grid. Lets the Brush screen warn
 * before the server's 60% MASK_TOO_LARGE limit. Framework-free.
 */
import type { MaskStrokes } from "../api/types";

const COLS = 60;

export function maskCoverage(strokes: MaskStrokes, aspect: number): number {
  const rows = Math.max(1, Math.round(COLS / Math.max(0.2, aspect)));
  const grid = new Uint8Array(COLS * rows);
  for (const s of strokes.strokes) {
    const val = s.mode === "paint" ? 1 : 0;
    // brush width is a fraction of image width; radius in grid columns
    const rc = (s.width * COLS) / 2;
    const pts = s.points;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[Math.min(i + 1, pts.length - 1)];
      const segLen = Math.hypot((x1 - x0) * COLS, (y1 - y0) * rows);
      const steps = Math.max(1, Math.ceil(segLen / Math.max(0.5, rc)));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const cx = (x0 + (x1 - x0) * t) * COLS;
        const cy = (y0 + (y1 - y0) * t) * rows;
        const minX = Math.max(0, Math.floor(cx - rc));
        const maxX = Math.min(COLS - 1, Math.ceil(cx + rc));
        const minY = Math.max(0, Math.floor(cy - rc));
        const maxY = Math.min(rows - 1, Math.ceil(cy + rc));
        for (let gy = minY; gy <= maxY; gy++) {
          for (let gx = minX; gx <= maxX; gx++) {
            if (Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy) <= rc) grid[gy * COLS + gx] = val;
          }
        }
      }
    }
  }
  let n = 0;
  for (let i = 0; i < grid.length; i++) n += grid[i];
  return n / grid.length;
}
