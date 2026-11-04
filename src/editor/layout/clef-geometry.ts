import type { Clef } from '../domain/chant-document';
import { staffStep } from './staff-metrics';

export interface ClefGeometry extends Clef {
  x: number;
  y: number;
  path: string;
  bounds: { x: number; y: number; width: number; height: number };
  hitBounds: { x: number; y: number; width: number; height: number };
}

/** Original square-clef contours: opposed do jaws; fa adds a left virga.
 * Coordinates are staff-step multiples, with y=0 on the reference line.
 * Filled contours avoid font fallback and stroke-dependent occupied bounds.
 */
export function buildClefGeometry(
  clef: Clef,
  x: number,
  y: number,
): ClefGeometry {
  const s = staffStep;
  const point = (a: number, b: number) => `${x + a * s} ${y + b * s}`;
  const jaw = (sign: number) =>
    `M ${point(-0.5, 0)} L ${point(-0.5, sign * 1.05)} ` +
    `L ${point(0.65, sign * 1.2)} L ${point(0.65, sign * 0.55)} ` +
    `L ${point(-0.28, sign * 0.65)} L ${point(-0.28, 0)} Z`;
  const virga =
    clef.type === 'f'
      ? ` M ${point(-1.55, -1.2)} L ${point(-0.85, -1.05)} ` +
        `L ${point(-0.85, 2)} L ${point(-0.98, 2)} ` +
        `L ${point(-0.98, -0.45)} L ${point(-1.55, -0.55)} Z`
      : '';
  const left = clef.type === 'f' ? -1.55 : -0.5;
  const bottom = clef.type === 'f' ? 2 : 1.2;
  const bounds = {
    x: x + left * s,
    y: y - 1.2 * s,
    width: (0.65 - left) * s,
    height: (bottom + 1.2) * s,
  };
  const padding = s / 2;
  return {
    ...clef,
    x,
    y,
    path: jaw(-1) + ' ' + jaw(1) + virga,
    bounds,
    hitBounds: {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + 2 * padding,
      height: bounds.height + 2 * padding,
    },
  };
}
