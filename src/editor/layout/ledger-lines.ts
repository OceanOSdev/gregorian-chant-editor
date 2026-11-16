import {
  engravingStaffStep,
  getInkBounds,
  interNeumeInkGap,
  type InkShape,
  type LayoutBounds,
  type NeumeGeometry,
  type NoteGeometry,
} from './neumes/shared';
import type { StaffPosition } from '../domain/chant-document';

/**
 * A regular run of ledger lines with one horizontal interval: `count` strokes
 * from `topY` to `bottomY`, `ledgerSpacing` apart. Kept compact (O(1)) for
 * arbitrarily distant safe pitches; never expand it per ledger level.
 */
export interface LedgerRun {
  x1: number;
  x2: number;
  /** Centre of the highest stroke. */
  topY: number;
  /** Centre of the lowest stroke. */
  bottomY: number;
  count: number;
}

export const ledgerOverhang = 3;
export const ledgerThickness = 1.5;
export const ledgerSpacing = engravingStaffStep * 2;

/** Staff lines sit at positions 0, 2, 4 and 6; -1 through 7 need no ledger. */
export function ledgerCount(position: number): number {
  return position >= 8
    ? Math.floor((position - 6) / 2)
    : position <= -2
      ? Math.floor(-position / 2)
      : 0;
}

/** Centre y of the `level`th (1-based) ledger line outward from the staff. */
function ledgerLevelY(
  above: boolean,
  level: number,
  bottomStaffY: number,
): number {
  return above
    ? bottomStaffY - (6 + level * 2) * engravingStaffStep
    : bottomStaffY + level * ledgerSpacing;
}

/** A run of the levels `first..last` (1-based, outward) on one staff side. */
function ledgerRun(
  above: boolean,
  first: number,
  last: number,
  x1: number,
  x2: number,
  bottomStaffY: number,
): LedgerRun {
  const near = ledgerLevelY(above, first, bottomStaffY);
  const far = ledgerLevelY(above, last, bottomStaffY);
  return {
    x1,
    x2,
    topY: Math.min(near, far),
    bottomY: Math.max(near, far),
    count: last - first + 1,
  };
}

export interface LedgerColumn {
  position: number;
  /** Left edge of the pitch-bearing footprint, before overhang. */
  left: number;
  /** Right edge of the pitch-bearing footprint, before overhang. */
  right: number;
}

/**
 * Derives the merged ledger runs for one neume's pitch-bearing columns.
 * Each side of the staff is partitioned into bands at the constituents'
 * distinct depths; within a band the contributors are constant, so their
 * overhung intervals are unioned (overlapping or touching only) and emitted
 * as compact runs. Work is bounded by the column count, never pitch distance.
 */
export function mergeLedgerRuns(
  columns: readonly LedgerColumn[],
  bottomStaffY: number,
): LedgerRun[] {
  const runs: LedgerRun[] = [];
  for (const above of [true, false]) {
    const sided = columns.flatMap((column) => {
      const count = ledgerCount(column.position);
      const isAbove = column.position > 6;
      return count && isAbove === above
        ? [
            {
              count,
              x1: column.left - ledgerOverhang,
              x2: column.right + ledgerOverhang,
            },
          ]
        : [];
    });
    const depths = [...new Set(sided.map((column) => column.count))].sort(
      (a, b) => a - b,
    );
    // Runs open at the previous band; extend when an interval repeats exactly.
    let open: { x1: number; x2: number; first: number; last: number }[] = [];
    const closed: typeof open = [];
    let previousDepth = 0;
    for (const depth of depths) {
      const intervals = unionIntervals(
        sided.filter((column) => column.count >= depth),
      );
      const next = intervals.map(({ x1, x2 }) => {
        const continued = open.find((run) => run.x1 === x1 && run.x2 === x2);
        return continued
          ? { ...continued, last: depth }
          : { x1, x2, first: previousDepth + 1, last: depth };
      });
      closed.push(
        ...open.filter(
          (run) => !next.some((n) => n.x1 === run.x1 && n.x2 === run.x2),
        ),
      );
      open = next;
      previousDepth = depth;
    }
    for (const run of [...closed, ...open])
      runs.push(
        ledgerRun(above, run.first, run.last, run.x1, run.x2, bottomStaffY),
      );
  }
  return runs;
}

function unionIntervals(
  intervals: readonly { x1: number; x2: number }[],
): { x1: number; x2: number }[] {
  const merged: { x1: number; x2: number }[] = [];
  for (const { x1, x2 } of [...intervals].sort((a, b) => a.x1 - b.x1)) {
    const last = merged.at(-1);
    // Touching segments merge; any positive gap stays visible.
    if (last && x1 <= last.x2) last.x2 = Math.max(last.x2, x2);
    else merged.push({ x1, x2 });
  }
  return merged;
}

/** Complete painted envelope of a run, including stroke thickness. */
export function ledgerRunBounds(run: LedgerRun): LayoutBounds {
  return {
    x: run.x1,
    y: run.topY - ledgerThickness / 2,
    width: run.x2 - run.x1,
    height: run.bottomY - run.topY + ledgerThickness,
  };
}

/**
 * Analytic collision query: the painted strokes of `runs` that come within
 * `clearance` of `box`, each returned as one rectangle spanning only the
 * intersecting strokes (never the whole run envelope or one per level).
 */
export function ledgerStrokesNear(
  runs: readonly LedgerRun[],
  box: LayoutBounds,
  clearance: number,
): LayoutBounds[] {
  return ledgerStrokesInBand(
    runs.filter(
      (run) =>
        box.x < run.x2 + clearance && box.x + box.width + clearance > run.x1,
    ),
    box.y - clearance,
    box.y + box.height + clearance,
  );
}

/**
 * The strokes of one run whose painted edges fall strictly inside the open
 * vertical band (top, bottom), as a contiguous sub-run, or null.
 *
 * Arithmetic is anchored on the run's end nearer the staff (smaller
 * magnitude). At a distant safe-integer pitch the far end's coordinate is not
 * exactly representable, but the near end and the integer count are, so the
 * strokes found near the staff stay exactly on the 24-unit staff grid.
 */
function strokesInBand(
  run: LedgerRun,
  top: number,
  bottom: number,
): LedgerRun | null {
  const half = ledgerThickness / 2;
  let first: number;
  let last: number;
  let firstY: number;
  if (Math.abs(run.topY) <= Math.abs(run.bottomY)) {
    // Stroke i (from the top) has its centre at topY + i * spacing.
    first = Math.max(
      0,
      Math.floor((top - half - run.topY) / ledgerSpacing) + 1,
    );
    last = Math.min(
      run.count - 1,
      Math.ceil((bottom + half - run.topY) / ledgerSpacing) - 1,
    );
    firstY = run.topY + first * ledgerSpacing;
  } else {
    // Stroke j (from the bottom) has its centre at bottomY - j * spacing.
    const nearest = Math.max(
      0,
      Math.floor((run.bottomY - bottom - half) / ledgerSpacing) + 1,
    );
    const farthest = Math.min(
      run.count - 1,
      Math.ceil((run.bottomY - top + half) / ledgerSpacing) - 1,
    );
    first = run.count - 1 - farthest;
    last = run.count - 1 - nearest;
    firstY = run.bottomY - farthest * ledgerSpacing;
  }
  if (first > last) return null;
  const count = last - first + 1;
  return {
    x1: run.x1,
    x2: run.x2,
    topY: firstY,
    bottomY: firstY + (count - 1) * ledgerSpacing,
    count,
  };
}

/**
 * The painted strokes of `runs` intersecting the open vertical band
 * (top, bottom), irrespective of x; at most one rectangle per run.
 */
export function ledgerStrokesInBand(
  runs: readonly LedgerRun[],
  top: number,
  bottom: number,
): LayoutBounds[] {
  return runs.flatMap((run) => {
    const strokes = strokesInBand(run, top, bottom);
    return strokes ? [ledgerRunBounds(strokes)] : [];
  });
}

/**
 * Rendering safeguard (Stage 11A canvas policy): the part of `run` whose
 * strokes can paint inside the vertical window (top, bottom), as an exact
 * sub-run on the staff grid, or null. The derived run itself is never
 * changed; only the painted element is limited, so a distant but valid pitch
 * never asks a browser to tile a 10^17-unit rectangle.
 */
export function visibleLedgerRun(
  run: LedgerRun,
  top: number,
  bottom: number,
): LedgerRun | null {
  return strokesInBand(run, top, bottom);
}

/** Complete occupied bounds of body ink plus any ledger runs. */
export function geometryBounds(
  ink: readonly InkShape[],
  ledgers: readonly LedgerRun[] = [],
): LayoutBounds {
  return getInkBounds([
    ...ink,
    ...ledgers.map((run): InkShape => ({
      kind: 'rect',
      bounds: ledgerRunBounds(run),
      radius: 0,
    })),
  ]);
}

/**
 * Horizontal pitch-bearing footprint of a constituent: its head contour
 * (squares 12, diamonds 14, reduced liquescent terminals narrower). A
 * selection region wider than a diamond is shared ribbon ink (Porrectus
 * family); its endpoint uses the nominal 12-unit cell about the anchor,
 * never the whole ribbon, stem or connector.
 */
export function pitchColumn(note: NoteGeometry): {
  left: number;
  right: number;
} {
  const { x, width } = note.head.bounds;
  return width <= 14
    ? { left: x, right: x + width }
    : { left: note.anchorX - 6, right: note.anchorX + 6 };
}

function positionAt(
  positions: readonly StaffPosition[],
  index: number,
): StaffPosition {
  const position = positions[index];
  if (position === undefined)
    throw new Error('Each constituent needs a staff position');
  return position;
}

/**
 * Adds derived ledger runs for a built neume body. Geometry needing no ledger
 * is returned unchanged (byte-identical); otherwise bounds and advance grow
 * to include the runs, while anchors, heads and hit targets stay untouched.
 */
export function addLedgerLines(
  geometry: NeumeGeometry,
  positions: readonly StaffPosition[],
  bottomStaffY: number,
): NeumeGeometry {
  const ledgers = mergeLedgerRuns(
    geometry.notes.map((note, index) => ({
      position: positionAt(positions, index),
      ...pitchColumn(note),
    })),
    bottomStaffY,
  );
  if (!ledgers.length) return geometry;
  const bounds = geometryBounds(geometry.ink, ledgers);
  return {
    ...geometry,
    ledgers,
    bounds,
    advanceX: bounds.width + interNeumeInkGap,
  };
}
