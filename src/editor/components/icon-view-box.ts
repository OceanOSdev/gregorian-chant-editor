import type { LayoutBounds } from '../layout/neume-geometry';

/** Space kept around a palette icon's ink, in engraving units. */
const iconPad = 2;

/** Side of the smallest padded square that contains `bounds`. */
export function fittedIconSize({ width, height }: LayoutBounds): number {
  return Math.max(width, height) + iconPad * 2;
}

/** A square SVG viewBox of side `size`, centered on `bounds`. */
export function centeredIconViewBox(
  { x, y, width, height }: LayoutBounds,
  size: number,
): string {
  return `${x + width / 2 - size / 2} ${y + height / 2 - size / 2} ${size} ${size}`;
}
