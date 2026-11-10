/** Browser-only display inputs; never enter semantic or canonical layout state. */
export interface TickRasterInputs {
  left: number;
  width: number;
  unitsToCss: number;
  devicePixelRatio: number;
  visualScale: number;
  visualOffsetX: number;
  clipLeft: number;
  clipRight: number;
}

/**
 * Align the left edge's pixel phase without changing vector width or height.
 * At most half a physical pixel, and strictly less than the engraver's two-unit
 * obstacle clearance. Very small scales and clip-edge cases retain vector ink.
 */
export function verticalEpisemaScreenShift(input: TickRasterInputs): number {
  const {
    left,
    width,
    unitsToCss,
    devicePixelRatio,
    visualScale,
    visualOffsetX,
    clipLeft,
    clipRight,
  } = input;
  if (
    !Object.values(input).every(Number.isFinite) ||
    unitsToCss <= 0 ||
    devicePixelRatio <= 0 ||
    visualScale <= 0 ||
    width <= 0
  )
    return 0;
  const pixelsPerCss = devicePixelRatio * visualScale;
  const physicalLeft = (left - visualOffsetX) * pixelsPerCss;
  const cssShift = (Math.round(physicalLeft) - physicalLeft) / pixelsPerCss;
  const shift = cssShift / unitsToCss;
  if (
    Math.abs(shift) > 1.5 ||
    left + cssShift < clipLeft ||
    left + width + cssShift > clipRight
  )
    return 0;
  return shift;
}
