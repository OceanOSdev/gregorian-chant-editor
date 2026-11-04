import type { StaffPosition } from '../../domain/chant-document';
import {
  geometryContext,
  firstHeadHalfWidth,
  finishGeometry,
  note,
  type NoteGeometry,
  type InkShape,
  type NeumeGeometry,
} from './shared';

export function buildPunctum(
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { x, y, move, shape } = geometryContext(positions, leftX, bottomStaffY);
  let notes: NoteGeometry[];
  let ink: readonly InkShape[];
  const lyricAnchorX = x + firstHeadHalfWidth('punctum');
  const head = shape(
    `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)} C${move(9, -6)} ${move(12, -5.4)} ${move(12, -4)} V${y + 5.6} C${move(12, 5.9)} ${move(11.85, 6)} ${move(11.6, 6)} C${move(9.8, 6)} ${move(8, 4.8)} ${move(6, 4.8)} C${move(4, 4.8)} ${move(2.2, 6)} ${move(0.4, 6)} C${move(0.15, 6)} ${move(0, 5.9)} ${move(0, 5.6)} Z`,
    0,
    -6,
    12,
    12,
  );
  notes = [note(head, x + 6, y)];
  ink = [head];

  return finishGeometry(notes, ink, lyricAnchorX);
}
