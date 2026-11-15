import type { NeumeLayout } from '../layout/layout-chant';

/** Ordinary whole-neume selection padding where the neume owns enough room. */
export const neumeSelectionGap = 5;
/**
 * Scaling stroke widths in SVG user units. The ordinary width matches the
 * former 2.5px non-scaling stroke at the usual wide-viewport score scale
 * (about 1.24); because it scales with the notation, ownership geometry bounds
 * it at every viewport width.
 */
export const neumeSelectionStrokeWidth = 2;
export const minimumNeumeSelectionStrokeWidth = 1;

/**
 * Horizontal ink extent padded by up to `padding`, kept at least `inset`
 * inside the neume's graphical ownership interval. It never shrinks the ink
 * extent itself.
 */
export function paddedOwnedExtent(
  neume: NeumeLayout,
  padding: number,
  inset = 0,
): { left: number; right: number } {
  const left = neume.bounds.x;
  const right = left + neume.bounds.width;
  return {
    left: Math.min(
      left,
      Math.max(left - padding, (neume.hitClip?.left ?? -Infinity) + inset),
    ),
    right: Math.max(
      right,
      Math.min(right + padding, (neume.hitClip?.right ?? Infinity) - inset),
    ),
  };
}

/**
 * Decorative whole-neume outline; derived, never clipped or hit-tested. The
 * stroke's outer edge always stays inside the ownership interval, so it never
 * reaches neighbouring ink. Where clearance is less than half the ordinary
 * stroke, the stroke narrows (to no less than the minimum). Below half the
 * minimum, the outline's edge moves inside the selected neume's own ink so its
 * outer stroke edge still encloses the ink without crossing ownership.
 */
export function neumeSelectionBounds(neume: NeumeLayout) {
  const inkLeft = neume.bounds.x;
  const inkRight = inkLeft + neume.bounds.width;
  const roomLeft = neume.hitClip ? inkLeft - neume.hitClip.left : Infinity;
  const roomRight = neume.hitClip ? neume.hitClip.right - inkRight : Infinity;
  const strokeWidth = Math.min(
    neumeSelectionStrokeWidth,
    Math.max(
      minimumNeumeSelectionStrokeWidth,
      2 * Math.min(roomLeft, roomRight),
    ),
  );
  const half = strokeWidth / 2;
  const left = inkLeft - Math.min(neumeSelectionGap, roomLeft - half);
  const right = inkRight + Math.min(neumeSelectionGap, roomRight - half);
  return {
    x: left,
    y: neume.bounds.y - neumeSelectionGap,
    width: right - left,
    height: neume.bounds.height + neumeSelectionGap * 2,
    strokeWidth,
  };
}
