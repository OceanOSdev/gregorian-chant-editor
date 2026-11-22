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

const iconPixels = 22;

/**
 * SVG size and viewBox for a plain palette button icon: `size` units tall and
 * rendered at 22px, so it has the same scale as a square icon of that `size`,
 * but trimmed horizontally to the padded ink. Beside a label it then takes
 * only the ink's width rather than a full 22px square.
 */
export function inkWidthIconBox(
  { x, y, width, height }: LayoutBounds,
  size: number,
) {
  const boxWidth = width + iconPad * 2;
  return {
    width: (iconPixels * boxWidth) / size,
    height: iconPixels,
    viewBox: `${x - iconPad} ${y + height / 2 - size / 2} ${boxWidth} ${size}`,
  };
}
