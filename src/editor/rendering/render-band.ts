import { ledgerSpacing } from '../layout/ledger-lines';
import type { LayoutBounds } from '../layout/neume-geometry';

/**
 * The vertical window in which rendered score elements may paint: the outer
 * canvas plus one ledger space (Stage 11A rendering safeguard). Anything
 * beyond it is outside the viewBox and therefore invisible, so limiting the
 * painted element there changes no visible pixel while keeping a distant but
 * valid pitch from asking a browser to draw a 10^17-unit shape.
 */
export interface RenderBand {
  top: number;
  bottom: number;
}

export function renderBandFor(canvas: {
  y: number;
  height: number;
}): RenderBand {
  return {
    top: canvas.y - ledgerSpacing,
    bottom: canvas.y + canvas.height + ledgerSpacing,
  };
}

/** A rectangle limited vertically to the band; derived geometry is unchanged. */
export function clampToBand<T extends LayoutBounds>(
  bounds: T,
  band: RenderBand | undefined,
): T {
  if (!band) return bounds;
  const top = Math.max(bounds.y, band.top);
  const bottom = Math.min(bounds.y + bounds.height, band.bottom);
  if (top === bounds.y && bottom === bounds.y + bounds.height) return bounds;
  return { ...bounds, y: top, height: Math.max(0, bottom - top) };
}
