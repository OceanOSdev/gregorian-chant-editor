import type { StaffPosition } from '../../domain/chant-document';
import {
  geometryContext,
  firstHeadHalfWidth,
  finishGeometry,
  type NoteGeometry,
  type InkShape,
  type NeumeGeometry,
} from './shared';
import { buildPunctum } from './punctum';
import { buildDiamondTail, descendingDiamondCenters } from './diamonds';

export function buildClimacus(
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { first, x, y, move, shape } = geometryContext(
    positions,
    leftX,
    bottomStaffY,
  );
  let notes: NoteGeometry[];
  let ink: readonly InkShape[];
  const lyricAnchorX = x + firstHeadHalfWidth('climacus');
  const second = positions[1];
  const third = positions[2];
  if (second === undefined || third === undefined)
    throw new Error('A three-note neume must have three pitches');
  const bounds = (dx: number, dy: number, width: number, height: number) => ({
    x: x + dx,
    y: y + dy,
    width,
    height,
  });
  const centers = descendingDiamondCenters(first, first, [second, third]);
  const firstHead = buildPunctum([first], x, bottomStaffY).notes[0];
  const virga = shape(
    `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)} C${move(9, -6)} ${move(12, -5.4)} ${move(12, -4)} V${y + 27} H${x + 10.5} V${y + 5.9} C${move(9, 5.7)} ${move(8, 4.8)} ${move(6, 4.8)} C${move(4, 4.8)} ${move(2.2, 6)} ${move(0.4, 6)} C${move(0.15, 6)} ${move(0, 5.9)} ${move(0, 5.6)} Z`,
    0,
    -6,
    12,
    33,
  );
  const cut = (12 + centers[0][0] - 7) / 2;
  notes = [firstHead, ...buildDiamondTail(centers, cut, x, y, move, shape)];
  ink = [virga, ...notes.slice(1).map((n) => n.head)];
  firstHead.hitBounds = bounds(-6, -12, cut + 6, 45);
  firstHead.hitShape = shape(
    `M${move(-6, -12)} H${x + cut} V${y + 33} H${x - 6} Z`,
    -6,
    -12,
    cut + 6,
    45,
  );

  return finishGeometry(notes, ink, lyricAnchorX);
}
