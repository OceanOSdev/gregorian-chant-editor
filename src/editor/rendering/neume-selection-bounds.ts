import type { NeumeLayout } from '../layout/layout-chant';

/** Ordinary whole-neume selection padding where the neume owns enough room. */
export const neumeSelectionGap = 5;
/**
 * Half of `.score__neume-selection`'s 2.5px stroke at unit scale. The outline
 * is centered on the rectangle edge, so this keeps its outer half inside the
 * ownership interval instead of relying on a clip that would cut it away.
 */
export const neumeSelectionStrokeInset = 1.25;

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

/** Decorative whole-neume outline; derived, never clipped or hit-tested. */
export function neumeSelectionBounds(neume: NeumeLayout) {
  const { left, right } = paddedOwnedExtent(
    neume,
    neumeSelectionGap,
    neumeSelectionStrokeInset,
  );
  return {
    x: left,
    y: neume.bounds.y - neumeSelectionGap,
    width: right - left,
    height: neume.bounds.height + neumeSelectionGap * 2,
  };
}
