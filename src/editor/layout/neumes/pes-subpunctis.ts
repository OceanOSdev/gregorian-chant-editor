import type { StaffPosition } from '../../domain/chant-document';
import { buildDiamondTail, descendingDiamondCenters } from './diamonds';
import { buildPodatusOrClivis } from './podatus-clivis';
import { finishGeometry, geometryContext, type NeumeGeometry } from './shared';

/**
 * The approved Podatus followed by detached descending diamonds. There is no
 * connector, apex virga stem or duplicated apex: the tail starts after the
 * Podatus column using the Climacus plateau for the apex-to-diamond interval.
 */
export function buildPesSubpunctis(
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const [lower, apex, ...tail] = positions;
  if (lower === undefined || apex === undefined || tail.length < 2)
    throw new Error('A Pes subpunctis needs a Podatus and at least two tails');
  const { first, x, y, move, shape } = geometryContext(
    positions,
    leftX,
    bottomStaffY,
  );
  const pes = buildPodatusOrClivis(
    'podatus',
    [lower, apex],
    leftX,
    bottomStaffY,
  );
  const centers = descendingDiamondCenters(first, apex, tail);
  // Same pointer partition as Climacus: halfway between the square column's
  // right edge and the first diamond's left point.
  const cut = (12 + centers[0][0] - 7) / 2;
  const heads = pes.notes.map((note) => ({
    ...note,
    hitBounds: {
      ...note.hitBounds,
      width:
        Math.min(note.hitBounds.x + note.hitBounds.width, x + cut) -
        note.hitBounds.x,
    },
  }));
  const diamonds = buildDiamondTail(centers, cut, x, y, move, shape);
  return finishGeometry(
    [...heads, ...diamonds],
    [...pes.ink, ...diamonds.map((note) => note.head)],
    pes.lyricAnchorX,
  );
}
