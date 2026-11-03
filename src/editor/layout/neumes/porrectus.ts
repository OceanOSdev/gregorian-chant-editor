import type { StaffPosition } from '../../domain/chant-document';
import {
  geometryContext,
  firstHeadHalfWidth,
  finishGeometry,
  note,
  engravingStaffStep,
  type NoteGeometry,
  type InkShape,
  type NeumeGeometry,
} from './shared';

export function buildPorrectus(
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
  const lyricAnchorX = x + firstHeadHalfWidth('porrectus');
  const second = positions[1];
  const third = positions[2];
  if (second === undefined || third === undefined)
    throw new Error('A three-note neume must have three pitches');
  const a = first - second;
  const b = Math.abs(third - second);
  const u = a * engravingStaffStep;
  const v = (first - third) * engravingStaffStep;
  const bounds = (dx: number, dy: number, width: number, height: number) => ({
    x: x + dx,
    y: y + dy,
    width,
    height,
  });
  const w = 34 + 8 * (a - 1) + (b === 1 ? 4 : 0);
  const z = w - 12;
  const top = v - (b === 1 ? 8 : 6);
  const stem = a <= 2 ? 27 : a === 3 ? 39 : 45;
  const upper = `M${move(0, -8)} C${move(0.27 * w, 8)} ${move(0.6 * w, u - 12)} ${move(z, u - 5)}`;
  const hook = `C${move(w - 7, u - 3)} ${move(w - 3, u - 3)} ${move(w - 1.5, u - 6)}`;
  const lower = `C${move(0.6 * w, u + 4)} ${move(0.25 * w, 16)} ${move(1.5, 6)}`;
  const crown = `C${move(z, top + 0.6)} ${move(z + 3, top)} ${move(z + 6, top)} C${move(z + 9, top)} ${move(w, top + 0.6)} ${move(w, top + 2)}`;
  const toe = `V${y + u + 6} Q${move(w, u + 9)} ${move(w - 3, u + 9)} L${move(z, u + 7)}`;
  // The first two pitches inhabit a single ribbon, not separate heads.
  const firstRegion = shape(
    `${upper} L${move(z, u + 7)} ${lower} L${move(0, 6)} Z`,
    0,
    -8,
    z,
    u + 15,
  );
  const secondRegion = shape(
    `M${move(z, u - 5)} ${hook} L${move(w, u - 6)} ${toe} Z`,
    z,
    u - 6,
    12,
    15,
  );
  const terminal = shape(
    `M${move(z, top + 2)} ${crown} V${y + v + 6} H${x + w - 1.5} Q${move(w - 7, v + 3)} ${move(z, v + 4)} Z`,
    z,
    top,
    12,
    v + 6 - top,
  );
  notes = [
    note(firstRegion, x + 6, y),
    note(secondRegion, x + w - 6, y + u),
    note(terminal, x + w - 6, y + v),
  ];
  ink = [
    shape(
      `${upper} ${hook} V${y + v + 6} Q${move(w - 7, v + 3)} ${move(z, v + 4)} V${y + top + 2} ${crown} ${toe} ${lower} V${y + stem} H${x} Z`,
      0,
      Math.min(-8, top),
      w,
      Math.max(stem, u + 9) - Math.min(-8, top),
    ),
  ];
  const split = (u + v) / 2;
  notes[0].hitBounds = bounds(-6, -14, z + 6, Math.max(stem + 6, u + 15) + 14);
  notes[1].hitBounds = bounds(z, split, 18, u + 15 - split);
  notes[2].hitBounds = bounds(z, top - 6, 18, split - (top - 6));

  return finishGeometry(notes, ink, lyricAnchorX);
}
