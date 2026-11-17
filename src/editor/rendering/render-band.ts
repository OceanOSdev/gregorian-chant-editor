import { ledgerSpacing } from '../layout/ledger-lines';
import type { LayoutBounds } from '../layout/neume-geometry';
import type { VerticalBand } from '../layout/system-vertical-layout';

/**
 * The vertical window in which a system's clipped musical elements may
 * paint: its resolved musical band plus one ledger space (Stage 11A/11B
 * rendering safeguard). The system clips musical ink at the band itself, so
 * limiting the painted element there changes no visible pixel while keeping a
 * distant but valid pitch from asking a browser to draw a 10^17-unit shape.
 * Elements drawn outside the system's clip clamp to the band itself instead.
 */
export type RenderBand = VerticalBand;

export function renderBandFor(musicBand: VerticalBand): RenderBand {
  return {
    top: musicBand.top - ledgerSpacing,
    bottom: musicBand.bottom + ledgerSpacing,
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

/** Font size of the lyric-move captions (`.score__move-caption`). */
export const moveCaptionFontSize = 10;

/**
 * Baseline of a lyric-move caption above its neume, lowered when needed so
 * the caption's em box stays inside the system's resolved band rather than
 * being clipped by it.
 */
export function moveCaptionBaseline(
  neumeBounds: LayoutBounds,
  band: VerticalBand,
): number {
  return Math.max(neumeBounds.y - 14, band.top + moveCaptionFontSize);
}
