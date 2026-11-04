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
  // Fa: a defined left block, rising shoulder and short descending axis.
  // The lower heel turns away from that axis; it is not a mirrored do lobe.
  const faPath =
    `M ${p(0.18, -1.64)} ` +
    `C ${p(-0.22, -1.64)} ${p(-0.43, -1.34)} ${p(-0.43, -0.9)} ` +
    `L ${p(-0.43, -0.46)} L ${p(-0.66, -0.6)} L ${p(-1.08, -0.6)} ` +
    `Q ${p(-1.3, -0.6)} ${p(-1.3, -0.38)} ` +
    `L ${p(-1.3, 0.6)} L ${p(-1.14, 0.67)} L ${p(-0.6, 0.61)} ` +
    `L ${p(-0.6, 1.54)} Q ${p(-0.6, 1.62)} ${p(-0.43, 1.58)} ` +
    `L ${p(-0.35, 1.18)} ` +
    `C ${p(-0.12, 1.47)} ${p(0.08, 1.68)} ${p(0.34, 1.68)} ` +
    `C ${p(0.53, 1.68)} ${p(0.65, 1.56)} ${p(0.65, 1.36)} ` +
    `L ${p(0.65, 0.43)} ` +
    `C ${p(0.46, 0.64)} ${p(0.2, 0.62)} ${p(-0.05, 0.3)} ` +
    `Q ${p(-0.26, 0.11)} ${p(-0.26, -0.04)} ` +
    `L ${p(-0.14, -0.22)} Q ${p(0.28, -0.49)} ${p(0.65, -0.32)} ` +
    `L ${p(0.65, -1.44)} Q ${p(0.65, -1.64)} ${p(0.45, -1.64)} Z`;
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
