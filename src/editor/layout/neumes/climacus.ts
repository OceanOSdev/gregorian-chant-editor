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
import { buildPunctum } from './punctum';

type Point = readonly [number, number];

/** Clip padded Climacus diamonds to their shared ownership half-plane. */
function clipHitPolygon(
  points: readonly Point[],
  nx: number,
  ny: number,
  limit: number,
  keepLess: boolean,
): Point[] {
  return points.flatMap((a, index): Point[] => {
    const b = points[(index + 1) % points.length];
    const da = nx * a[0] + ny * a[1] - limit;
    const db = nx * b[0] + ny * b[1] - limit;
    const insideA = keepLess ? da <= 0 : da >= 0;
    const insideB = keepLess ? db <= 0 : db >= 0;
    const result: Point[] = insideA ? [a] : [];
    if (insideA !== insideB) {
      const t = da / (da - db);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
    return result;
  });
}

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
  // The spacing plateaus are project optical choices, not TeX layout rules.
  const h = a === 1 ? 18 : a === 2 ? 24 : 30;
  const k = b === 1 ? 10.5 : b === 2 ? 19.5 : 27;
  const centers: readonly Point[] = [
    [6 + h, u],
    [6 + h + k, v],
  ];
  const firstHead = buildPunctum([first], x, bottomStaffY).notes[0];
  const virga = shape(
    `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)} C${move(9, -6)} ${move(12, -5.4)} ${move(12, -4)} V${y + 27} H${x + 10.5} V${y + 5.9} C${move(9, 5.7)} ${move(8, 4.8)} ${move(6, 4.8)} C${move(4, 4.8)} ${move(2.2, 6)} ${move(0.4, 6)} C${move(0.15, 6)} ${move(0, 5.9)} ${move(0, 5.6)} Z`,
    0,
    -6,
    12,
    33,
  );
  notes = [
    firstHead,
    ...centers.map(([cx, cy]) =>
      note(
        shape(
          `M${move(cx - 7, cy)} L${move(cx - 1, cy - 10)} L${move(cx + 7, cy - 1)} L${move(cx + 1, cy + 10)} Z`,
          cx - 7,
          cy - 10,
          14,
          20,
        ),
        x + cx,
        y + cy,
      ),
    ),
  ];
  ink = [virga, ...notes.slice(1).map((n) => n.head)];
  const cut = (12 + centers[0][0] - 7) / 2;
  firstHead.hitBounds = bounds(-6, -12, cut + 6, 45);
  firstHead.hitShape = shape(
    `M${move(-6, -12)} H${x + cut} V${y + 33} H${x - 6} Z`,
    -6,
    -12,
    cut + 6,
    45,
  );
  const nx = 11 / 6;
  const split = centers.reduce((sum, [cx, cy]) => sum + nx * cx + cy, 0) / 2;
  centers.forEach(([cx, cy], index) => {
    const padded: Point[] = [
      [cx - 11, cy],
      [cx - 1, cy - 16],
      [cx + 11, cy - 1],
      [cx + 1, cy + 16],
    ];
    const polygon = clipHitPolygon(
      clipHitPolygon(padded, 1, 0, cut, false),
      nx,
      1,
      split,
      index === 0,
    );
    const xs = polygon.map(([px]) => px);
    const ys = polygon.map(([, py]) => py);
    const left = Math.min(...xs),
      top = Math.min(...ys);
    const hitShape = shape(
      `M${polygon.map(([px, py]) => move(px, py)).join(' L')} Z`,
      left,
      top,
      Math.max(...xs) - left,
      Math.max(...ys) - top,
    );
    notes[index + 1].hitShape = hitShape;
    notes[index + 1].hitBounds = hitShape.bounds;
  });

  return finishGeometry(notes, ink, lyricAnchorX);
}
