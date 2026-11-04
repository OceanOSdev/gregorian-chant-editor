import type { Clef } from '../domain/chant-document';
import { staffStep } from './staff-metrics';

export interface ClefGeometry extends Clef {
  x: number;
  y: number;
  path: string;
  bounds: { x: number; y: number; width: number; height: number };
  hitBounds: { x: number; y: number; width: number; height: number };
}

/** Independently drawn do/fa contours after printed Solesmes examples.
 * Coordinates are staff-step multiples; the small aperture straddles y=0.
 * Curved shoulders, substantial lobes and a fine waist replace flag-like jaws.
 * All Bézier controls lie inside the bounds, whose extrema are path endpoints.
 */
export function buildClefGeometry(
  clef: Clef,
  x: number,
  y: number,
): ClefGeometry {
  const s = staffStep;
  const p = (a: number, b: number) => `${x + a * s} ${y + b * s}`;
  // Do: narrow body, rounded upper shoulder, slightly fuller lower heel.
  const doPath =
    `M ${p(0.45, -1.62)} ` +
    `C ${p(-0.2, -1.62)} ${p(-0.48, -1.31)} ${p(-0.48, -0.85)} ` +
    `L ${p(-0.48, 0.96)} ` +
    `C ${p(-0.48, 1.46)} ${p(-0.18, 1.62)} ${p(0.45, 1.62)} ` +
    `L ${p(0.45, 0.4)} ` +
    `C ${p(0.17, 0.48)} ${p(-0.12, 0.43)} ${p(-0.3, 0.25)} ` +
    `L ${p(-0.3, -0.25)} ` +
    `C ${p(-0.12, -0.44)} ${p(0.17, -0.48)} ${p(0.45, -0.4)} Z`;
  // Fa: its own swollen right body and left reference-line block. No appended
  // virga, shared do contour, or long descending stem.
  const faPath =
    `M ${p(0.65, -1.64)} ` +
    `C ${p(-0.05, -1.64)} ${p(-0.39, -1.38)} ${p(-0.39, -0.86)} ` +
    `L ${p(-0.39, -0.39)} ` +
    `C ${p(-0.68, -0.63)} ${p(-1.0, -0.63)} ${p(-1.3, -0.47)} ` +
    `L ${p(-1.3, 0.56)} ` +
    `C ${p(-0.98, 0.42)} ${p(-0.65, 0.45)} ${p(-0.39, 0.64)} ` +
    `L ${p(-0.39, 1.02)} ` +
    `C ${p(-0.39, 1.51)} ${p(-0.02, 1.68)} ${p(0.65, 1.68)} ` +
    `L ${p(0.65, 0.51)} ` +
    `C ${p(0.3, 0.61)} ${p(0.07, 0.48)} ${p(-0.06, 0.24)} ` +
    `L ${p(-0.06, -0.21)} ` +
    `C ${p(0.1, -0.46)} ${p(0.32, -0.47)} ${p(0.65, -0.38)} Z`;
  const left = clef.type === 'c' ? -0.48 : -1.3;
  const right = clef.type === 'c' ? 0.45 : 0.65;
  const top = clef.type === 'c' ? -1.62 : -1.64;
  const bottom = clef.type === 'c' ? 1.62 : 1.68;
  const bounds = {
    x: x + left * s,
    y: y + top * s,
    width: (right - left) * s,
    height: (bottom - top) * s,
  };
  const padding = s / 2;
  return {
    ...clef,
    x,
    y,
    path: clef.type === 'c' ? doPath : faPath,
    bounds,
    hitBounds: {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + 2 * padding,
      height: bounds.height + 2 * padding,
    },
  };
}
