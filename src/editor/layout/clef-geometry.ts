import type { Clef } from '../domain/chant-document';
import { staffStep } from './staff-metrics';

export interface ClefGeometry extends Clef {
  x: number;
  y: number;
  path: string;
  bounds: { x: number; y: number; width: number; height: number };
  hitBounds: { x: number; y: number; width: number; height: number };
}

/** Shared do body with a fa-specific attachment after printed Solesmes examples.
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
  // Fa shares the approved do contour, shifted to keep its existing right face.
  const bodyX = x + (clef.type === 'f' ? s / 5 : 0);
  const bodyPoint = (a: number, b: number) => `${bodyX + a * s} ${y + b * s}`;
  // Do: narrow body, rounded upper shoulder, slightly fuller lower heel.
  const doPath =
    `M ${bodyPoint(0.45, -1.62)} ` +
    `C ${bodyPoint(-0.2, -1.62)} ${bodyPoint(-0.48, -1.31)} ${bodyPoint(-0.48, -0.85)} ` +
    `L ${bodyPoint(-0.48, 0.96)} ` +
    `C ${bodyPoint(-0.48, 1.46)} ${bodyPoint(-0.18, 1.62)} ${bodyPoint(0.45, 1.62)} ` +
    `L ${bodyPoint(0.45, 0.4)} ` +
    `C ${bodyPoint(0.17, 0.48)} ${bodyPoint(-0.12, 0.43)} ${bodyPoint(-0.3, 0.25)} ` +
    `L ${bodyPoint(-0.3, -0.25)} ` +
    `C ${bodyPoint(-0.12, -0.44)} ${bodyPoint(0.17, -0.48)} ${bodyPoint(0.45, -0.4)} Z`;
  // Fa attachment: shallow block, softened corners and a tapered descending shaft.
  // Same winding as the body: overlapping contours form one filled silhouette.
  const faAttachment =
    `M ${p(-0.28, -0.42)} L ${p(-0.66, -0.5)} L ${p(-1.04, -0.54)} ` +
    `Q ${p(-1.3, -0.54)} ${p(-1.3, -0.3)} ` +
    `L ${p(-1.3, 0.4)} Q ${p(-1.3, 0.51)} ${p(-1.12, 0.53)} ` +
    `L ${p(-0.62, 0.49)} ` +
    `C ${p(-0.61, 0.86)} ${p(-0.56, 1.22)} ${p(-0.54, 1.49)} ` +
    `Q ${p(-0.53, 1.59)} ${p(-0.43, 1.54)} ` +
    `C ${p(-0.38, 1.38)} ${p(-0.32, 1.14)} ${p(-0.28, 0.96)} Z`;
  const left = clef.type === 'c' ? -0.48 : -1.3;
  const right = clef.type === 'c' ? 0.45 : 0.65;
  const top = -1.62;
  const bottom = 1.62;
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
    path: clef.type === 'c' ? doPath : `${doPath} ${faAttachment}`,
    bounds,
    hitBounds: {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + 2 * padding,
      height: bounds.height + 2 * padding,
    },
  };
}
