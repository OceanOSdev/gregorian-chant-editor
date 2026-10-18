import { describe, expect, it } from 'vitest';
import { staffPosition } from '../domain/chant-document';
import { buildNeumeGeometry, type InkShape } from './neume-geometry';

type Point = readonly [number, number];
const tolerance = 1e-8;

function cross(a: Point, b: Point, p: Point): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

// Only the descending Climacus diamonds and targets use this reader. Reject
// curves, relative commands, and other SVG syntax rather than approximating it.
function convexPolygon(shape: InkShape): Point[] {
  if (
    shape.kind !== 'path' ||
    !/^M[-\d.eE+,\s]+(?:L[-\d.eE+,\s]+)+Z$/.test(shape.d)
  ) {
    throw new Error('Expected a closed absolute M/L/Z polygon');
  }
  const coordinates =
    shape.d.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
  expect(coordinates.length % 2).toBe(0);
  const points: Point[] = [];
  for (let i = 0; i < coordinates.length; i += 2) {
    points.push([coordinates[i], coordinates[i + 1]]);
  }
  expect(points.length).toBeGreaterThanOrEqual(3);
  // Containment by edge half-planes requires a nondegenerate convex polygon.
  const turns = points.map((a, i) =>
    cross(a, points[(i + 1) % points.length], points[(i + 2) % points.length]),
  );
  expect(turns.some((turn) => Math.abs(turn) > tolerance)).toBe(true);
  expect(points.every((point) => contains(points, point))).toBe(true);
  return points;
}

function contains(polygon: readonly Point[], point: Point): boolean {
  const sides = polygon.map((a, i) =>
    cross(a, polygon[(i + 1) % polygon.length], point),
  );
  return (
    sides.every((side) => side >= -tolerance) ||
    sides.every((side) => side <= tolerance)
  );
}

// Convex polygons have disjoint interiors iff an edge-normal projection
// separates them. Equality deliberately permits a shared target boundary.
function interiorsAreDisjoint(
  a: readonly Point[],
  b: readonly Point[],
): boolean {
  return [a, b].some((polygon) =>
    polygon.some((point, i) => {
      const next = polygon[(i + 1) % polygon.length];
      const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
      if (length <= tolerance) return false;
      const nx = (point[1] - next[1]) / length;
      const ny = (next[0] - point[0]) / length;
      const project = (points: readonly Point[]) =>
        points.map(([x, y]) => nx * x + ny * y);
      const pa = project(a),
        pb = project(b);
      return (
        Math.max(...pa) <= Math.min(...pb) + tolerance ||
        Math.max(...pb) <= Math.min(...pa) + tolerance
      );
    }),
  );
}

function descendingDiamonds(a: number, b: number, leftX = 0, bottomStaffY = 0) {
  const geometry = buildNeumeGeometry(
    'climacus',
    [0, -a, -a - b].map(staffPosition),
    leftX,
    bottomStaffY,
  );
  return geometry.notes.slice(1).map((note, i) => {
    if (!note.hitShape) throw new Error('Expected a diamond hit shape');
    return {
      note,
      // Read painted ink, independently of the selection-contour field.
      ink: convexPolygon(geometry.ink[i + 1]),
      target: convexPolygon(note.hitShape),
    };
  });
}

const intervals = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 4],
  [4, 2],
] as const;
const origins = [
  [0, 0],
  [17.5, 244],
] as const;

describe('Climacus descending-diamond pointer ownership', () => {
  it('covers the complete painted diamonds at tight and wider intervals, including translated geometry', () => {
    for (const [a, b] of intervals)
      for (const [x, y] of origins) {
        const diamonds = descendingDiamonds(a, b, x, y);
        for (const diamond of diamonds) {
          // For convex polygons, enclosing every painted vertex encloses the
          // entire painted interior, not just a finite grid of sampled points.
          expect(
            diamond.ink.every((vertex) => contains(diamond.target, vertex)),
            `coverage (${a},${b}) at (${x},${y})`,
          ).toBe(true);
        }
        expect(
          interiorsAreDisjoint(diamonds[0].target, diamonds[1].target),
          `target overlap (${a},${b}) at (${x},${y})`,
        ).toBe(true);
      }
  });

  it('assigns points just inside every tip of the tight (1,1) diamonds to only their own control', () => {
    const diamonds = descendingDiamonds(1, 1);
    diamonds.forEach((diamond, index) => {
      for (const [x, y] of diamond.ink) {
        const point: Point = [
          x * 0.999 + diamond.note.anchorX * 0.001,
          y * 0.999 + diamond.note.anchorY * 0.001,
        ];
        expect(contains(diamond.ink, point)).toBe(true);
        expect(diamonds.map(({ target }) => contains(target, point))).toEqual(
          index === 0 ? [true, false] : [false, true],
        );
      }
    });
  });

  it('declares tight hit bounds from the actual target vertices, not copied recipe bounds', () => {
    for (const [a, b] of intervals)
      for (const [x, y] of origins) {
        for (const { note, target } of descendingDiamonds(a, b, x, y)) {
          const xs = target.map(([px]) => px),
            ys = target.map(([, py]) => py);
          const actual = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          };
          for (const key of ['x', 'y', 'width', 'height'] as const) {
            expect(
              note.hitBounds[key],
              `bounds ${key} (${a},${b}) at (${x},${y})`,
            ).toBeCloseTo(actual[key], 8);
            expect(note.hitShape?.bounds[key]).toBeCloseTo(actual[key], 8);
          }
        }
      }
  });
});
