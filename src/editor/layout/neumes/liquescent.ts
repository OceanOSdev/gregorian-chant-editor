import type { StaffPosition } from '../../domain/chant-document';
import type { LiquescentFigure } from '../../domain/liquescence';
import { clivisStemLength } from './podatus-clivis';
import {
  engravingStaffStep,
  finishGeometry,
  geometryContext,
  headContours,
  note,
  type InkShape,
  type NeumeGeometry,
  type NoteGeometry,
} from './shared';

/**
 * Accepted ADR 0027 liquescent constructions; constants are recorded in
 * docs/engraving-metrics.md. Original paths, proportioned from the Liber
 * Usualis p. xxij table (diminutive), the Completorium O.P. 1949 p. 119 Eia
 * figure (augmentative) and measured Gregorio 6.0.0 renders as secondary
 * evidence. No font outline is copied. Units match the ordinary recipes: a
 * 12-unit head on a 12-unit staff step, y increasing downward.
 */
export const liquescentMetrics = {
  /** Epiphonus lower body: concave top rising to a left horn, deeper base. */
  bodyHornTop: -10,
  bodyTop: -5,
  bodyBottom: 9.4,
  /** Reduced terminal (both diminutives), relative to its own pitch. */
  terminalLeft: 5.6,
  terminalExtent: 5.2,
  terminalInner: 3.8,
  /** Right connecting stroke of both diminutives. */
  strokeLeft: 10.5,
  /** Dominican augmentative tail: constant length below the upper pitch. */
  tailBelowUpperPitch: 18,
  tailWidth: 1.2,
  /**
   * Offset of the augmentative upper head: it overlaps the lower head's right
   * edge by one connector width, as the ordinary wider Clivis does, so even a
   * second has a solid shared edge rather than a rounded-corner contact.
   */
  headOffset: 10.5,
  connectorWidth: 1.5,
} as const;

const m = liquescentMetrics;

export function buildLiquescent(
  figure: LiquescentFigure,
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const second = positions[1];
  if (second === undefined || positions.length !== 2)
    throw new Error('A liquescent figure must have two pitches');
  switch (figure) {
    case 'epiphonus':
      return buildEpiphonus(positions, second, leftX, bottomStaffY);
    case 'cephalicus':
      return buildCephalicus(positions, second, leftX, bottomStaffY);
    case 'augmentative-pes':
      return buildAugmentativePes(positions, second, leftX, bottomStaffY);
  }
}

/** Ordinary-size control around a reduced terminal at its own pitch. */
function ordinaryTarget(centerX: number, pitchY: number) {
  return { x: centerX - 12, y: pitchY - 12, width: 24, height: 24 };
}

/** Stacked constituents split padding at the nominal inter-pitch midpoint. */
function splitStacked(upper: NoteGeometry, lower: NoteGeometry, split: number) {
  const lowerBottom = lower.hitBounds.y + lower.hitBounds.height;
  lower.hitBounds.y = Math.max(lower.hitBounds.y, split);
  lower.hitBounds.height = lowerBottom - lower.hitBounds.y;
  upper.hitBounds.height =
    Math.min(upper.hitBounds.y + upper.hitBounds.height, split) -
    upper.hitBounds.y;
}

function buildEpiphonus(
  positions: readonly StaffPosition[],
  second: StaffPosition,
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { first, x, y, move, shape } = geometryContext(
    positions,
    leftX,
    bottomStaffY,
  );
  const u = (first - second) * engravingStaffStep;
  const top = u - m.terminalExtent;
  // Lower body: left horn, concave top, full right edge, rounded deeper base.
  const bodyTop = `M${move(0, m.bodyHornTop)} C${move(1.5, -7)} ${move(3, m.bodyTop)} ${move(6, m.bodyTop)}`;
  const base = `V${y + 5.6} C${move(12, 7.6)} ${move(9, m.bodyBottom)} ${move(6, m.bodyBottom)} C${move(3, m.bodyBottom)} ${move(0, 8.6)} ${move(0, 7)} Z`;
  // Reduced terminal: a left-pointing flag at the upper pitch, rounded above.
  const terminal = `V${y + u + m.terminalInner} H${x + 6.6} C${move(m.terminalLeft, u + m.terminalInner)} ${move(m.terminalLeft, u + 1)} ${move(6, u - 1)} C${move(6.6, u - 4)} ${move(8.5, top)} ${move(m.strokeLeft, top)} H${x + 12}`;
  const lower = shape(
    `${bodyTop} H${x + 12} ${base}`,
    0,
    m.bodyHornTop,
    12,
    m.bodyBottom - m.bodyHornTop,
  );
  const upper = shape(
    `M${move(m.strokeLeft, m.bodyTop)} ${terminal} V${y + m.bodyTop} Z`,
    m.terminalLeft,
    top,
    12 - m.terminalLeft,
    m.bodyTop - top,
  );
  const ink = shape(
    `${bodyTop} H${x + m.strokeLeft} ${terminal} ${base}`,
    0,
    top,
    12,
    m.bodyBottom - top,
  );
  const notes = [note(lower, x + 6, y), note(upper, x + 9, y + u)];
  notes[1].hitBounds = ordinaryTarget(x + 6, y + u);
  splitStacked(notes[1], notes[0], y + u / 2);
  return finishGeometry(notes, [ink], x + 6);
}

function buildCephalicus(
  positions: readonly StaffPosition[],
  second: StaffPosition,
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { first, x, y, move, shape } = geometryContext(
    positions,
    leftX,
    bottomStaffY,
  );
  const { crown } = headContours(move, y);
  const distance = first - second;
  const d = distance * engravingStaffStep;
  const stem = clivisStemLength(distance);
  const bottom = d + m.terminalExtent + 0.9;
  const scoop = `C${move(9, 6)} ${move(8, 4.8)} ${move(6, 4.8)} C${move(4, 4.8)} ${move(3, 6)} ${move(1.5, 6)}`;
  // Reduced terminal: a left-pointing flag at the lower pitch, rounded below.
  const terminal = `V${y + d + 4} C${move(12, d + 5.6)} ${move(11, bottom)} ${move(10, bottom)} H${x + 8.5} C${move(6.8, bottom)} ${move(m.terminalLeft, d + 4.5)} ${move(m.terminalLeft, d + 2)} C${move(m.terminalLeft, d - 0.5)} ${move(6.3, d - m.terminalInner + 0.6)} ${move(7, d - m.terminalInner + 0.6)} H${x + m.strokeLeft}`;
  const upper = shape(
    `${crown(0, -6)} V${y + 6} H${x + m.strokeLeft} ${scoop} H${x} Z`,
    0,
    -6,
    12,
    12,
  );
  const lower = shape(
    `M${move(m.strokeLeft, 6)} H${x + 12} ${terminal} Z`,
    m.terminalLeft,
    6,
    12 - m.terminalLeft,
    bottom - 6,
  );
  const ink = shape(
    `${crown(0, -6)} ${terminal} V${y + 6} ${scoop} V${y + stem} H${x} Z`,
    0,
    -6,
    12,
    Math.max(stem, bottom) + 6,
  );
  const notes = [note(upper, x + 6, y), note(lower, x + 9, y + d)];
  notes[1].hitBounds = ordinaryTarget(x + 6, y + d);
  splitStacked(notes[0], notes[1], y + d / 2);
  return finishGeometry(notes, [ink], x + 6);
}

function buildAugmentativePes(
  positions: readonly StaffPosition[],
  second: StaffPosition,
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { first, x, y, move, shape } = geometryContext(
    positions,
    leftX,
    bottomStaffY,
  );
  const { crown, underside } = headContours(move, y);
  const distance = second - first;
  const u = -distance * engravingStaffStep;
  const sx = m.headOffset;
  const tail = u + m.tailBelowUpperPitch;
  const lower = shape(`${crown(0, -6)} ${underside(0, 0)} Z`, 0, -6, 12, 12);
  // Upper full head; its right edge continues as the thin descending tail and
  // its left edge joins down the lower head's right edge to the lower base.
  const right = sx + 12 - m.tailWidth;
  const upper = shape(
    `${crown(sx, u - 6)} V${y + tail} H${x + right} V${y + u + 5.8} C${move(right - 1.3, u + 6)} ${move(sx + 8, u + 4.8)} ${move(sx + 6, u + 4.8)} C${move(sx + 4, u + 4.8)} ${move(sx + 2.2, u + 6)} ${move(sx + m.connectorWidth, u + 6)} V${y + 5.6} H${x + sx} Z`,
    sx,
    u - 6,
    12,
    Math.max(tail, 5.6) - (u - 6),
  );
  const notes = [note(lower, x + 6, y), note(upper, x + sx + 6, y + u)];
  // Ordinary-size controls: the tail and connector are not the upper target.
  notes[1].hitBounds = ordinaryTarget(x + sx + 6, y + u);
  if (distance === 1) {
    // Diagonally adjacent targets split at their anchor midpoint.
    const split = (notes[0].anchorX + notes[1].anchorX) / 2;
    notes[0].hitBounds.width = split - notes[0].hitBounds.x;
    const target = notes[1].hitBounds;
    target.width = target.x + target.width - split;
    target.x = split;
  }
  const ink: InkShape[] = [lower, upper];
  return finishGeometry(notes, ink, (notes[0].anchorX + notes[1].anchorX) / 2);
}
