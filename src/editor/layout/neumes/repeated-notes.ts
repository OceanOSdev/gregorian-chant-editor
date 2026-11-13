import type { StaffPosition } from '../../domain/chant-document';
import { buildPunctum } from './punctum';
import { finishGeometry, type NeumeGeometry } from './shared';

/** Modern Vatican square-head profile: 12-unit heads with a 6-unit clear gap. */
export function buildRepeatedNotes(
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const heads = positions.map((position, index) =>
    buildPunctum([position], leftX + index * 18, bottomStaffY),
  );
  const notes = heads
    .flatMap((head) => head.notes)
    .map((note) => ({
      ...note,
      hitBounds: { ...note.hitBounds, x: note.x - 3, width: 18 },
    }));
  return finishGeometry(
    notes,
    heads.flatMap((head) => head.ink),
    leftX + (12 + (positions.length - 1) * 18) / 2,
  );
}
