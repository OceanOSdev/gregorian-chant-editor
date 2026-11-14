import type { StaffPosition } from '../../domain/chant-document';
import {
  engravingStaffStep,
  note,
  type InkShape,
  type NoteGeometry,
} from './shared';

export type Point = readonly [number, number];

/** Clip padded diamonds to their shared ownership half-plane. */
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

/**
 * Local diamond centers for a strictly descending tail that follows a square
 * column centered at local x 6. The spacing plateaus are the approved Climacus
 * optical choices, not TeX layout rules: the first gap depends on the interval
 * from `previous`, later gaps on each interval within the tail.
 */
export function descendingDiamondCenters(
  first: StaffPosition,
  previous: StaffPosition,
  tail: readonly StaffPosition[],
): Point[] {
  let cx = 6;
  return tail.map((position, index) => {
    const interval = (index === 0 ? previous : tail[index - 1]) - position;
    cx +=
      index === 0
        ? interval === 1
          ? 18
          : interval === 2
            ? 24
            : 30
        : interval === 1
          ? 10.5
          : interval === 2
            ? 19.5
            : 27;
    return [cx, (first - position) * engravingStaffStep];
  });
}

/**
 * Detached descending diamonds with pairwise nonoverlapping pointer regions.
 * Every region lies right of `cut`; consecutive regions share a boundary
 * perpendicular to the descending diagonal.
 */
export function buildDiamondTail(
  centers: readonly Point[],
  cut: number,
  x: number,
  y: number,
  move: (dx: number, dy: number) => string,
  shape: (
    d: string,
    dx: number,
    dy: number,
    width: number,
    height: number,
  ) => InkShape,
): NoteGeometry[] {
  const notes = centers.map(([cx, cy]) =>
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
  );
  const nx = 11 / 6;
  const splits = centers
    .slice(1)
    .map(
      ([cx, cy], index) =>
        (nx * centers[index][0] + centers[index][1] + nx * cx + cy) / 2,
    );
  centers.forEach(([cx, cy], index) => {
    let polygon: Point[] = clipHitPolygon(
      [
        [cx - 11, cy],
        [cx - 1, cy - 16],
        [cx + 11, cy - 1],
        [cx + 1, cy + 16],
      ],
      1,
      0,
      cut,
      false,
    );
    if (index > 0)
      polygon = clipHitPolygon(polygon, nx, 1, splits[index - 1], false);
    if (index < splits.length)
      polygon = clipHitPolygon(polygon, nx, 1, splits[index], true);
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
    notes[index].hitShape = hitShape;
    notes[index].hitBounds = hitShape.bounds;
  });
  return notes;
}
