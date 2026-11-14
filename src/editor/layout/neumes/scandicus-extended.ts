import type { StaffPosition } from '../../domain/chant-document';
import { buildPodatusOrClivis } from './podatus-clivis';
import { buildPunctum } from './punctum';
import {
  finishGeometry,
  type NeumeGeometry,
  type NoteGeometry,
} from './shared';

/** Horizontal advance from one staircase element's column to the next. */
const columnAdvance = 12;

/**
 * Note-index groups of the extended Scandicus staircase (ADR 0024), after
 * Mocquereau, printed p. 152, Fig. 34: four notes are Pes + Pes; five notes are
 * Pes + Punctum + Pes. Each pair is the approved Podatus (joined, right stem);
 * a single index is the approved Punctum. Elements are not joined to each
 * other, so no ascending connector is implied between them. The grouping is
 * interval-independent: the reference shows one construction per count.
 */
export function extendedScandicusElements(
  noteCount: number,
): readonly (readonly number[])[] {
  if (noteCount === 4)
    return [
      [0, 1],
      [2, 3],
    ];
  if (noteCount === 5) return [[0, 1], [2], [3, 4]];
  throw new Error('An extended Scandicus has four or five notes');
}

/**
 * Staircase of approved Podatus/Punctum elements in successive columns. Each
 * element keeps its own ink; pointer targets are partitioned at the shared
 * column edges, and within a Podatus at its existing nominal pitch split.
 */
export function buildExtendedScandicus(
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const elements = extendedScandicusElements(positions.length);
  const notes: NoteGeometry[] = [];
  const ink: NeumeGeometry['ink'][number][] = [];
  let lyricAnchorX = leftX;
  elements.forEach((indexes, column) => {
    const pitches = indexes.map((index) => {
      const pitch = positions[index];
      if (pitch === undefined) throw new Error('Missing Scandicus pitch');
      return pitch;
    });
    const x = leftX + column * columnAdvance;
    const element =
      pitches.length === 2
        ? buildPodatusOrClivis('podatus', pitches, x, bottomStaffY)
        : buildPunctum(pitches, x, bottomStaffY);
    if (column === 0) lyricAnchorX = element.lyricAnchorX;
    const left = column === 0 ? -Infinity : x;
    const right = column === elements.length - 1 ? Infinity : x + columnAdvance;
    for (const geometry of element.notes) {
      const target = geometry.hitBounds;
      const targetLeft = Math.max(target.x, left);
      const targetRight = Math.min(target.x + target.width, right);
      notes.push({
        ...geometry,
        hitBounds: {
          ...target,
          x: targetLeft,
          width: targetRight - targetLeft,
        },
      });
    }
    ink.push(...element.ink);
  });
  return finishGeometry(notes, ink, lyricAnchorX);
}
