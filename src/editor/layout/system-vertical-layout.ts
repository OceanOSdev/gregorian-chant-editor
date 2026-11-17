import { lyricFontSize } from './lyric-text-metrics';
import type { LayoutBounds } from './neume-geometry';
import { engravingStaffStep } from './neumes/shared';
import { firstSystemBottomStaffY } from './staff-metrics';

/**
 * Stage 11B vertical system layout (ADR 0028). Horizontal composition runs in
 * one canonical system-local frame (system top 0, bottom staff line at
 * `firstSystemBottomStaffY`). This module measures each composed system's
 * vertical requirements in that frame, then stacks the systems; nothing here
 * can change x positions or system membership.
 */

/** Minimum (ordinary) system height, local lyric baseline and inter-system gap. */
export const systemHeight = 220;
export const systemGap = 24;
export const canonicalLyricBaselineY = 180;

/**
 * Conservative lyric row reserved above/below its baseline: the 20-unit
 * font's full em above the baseline and a quarter-em descent. It is a fixed
 * reservation, not a per-glyph measurement; see the Stage 11B verification
 * record for which resolved fonts were actually measured against it.
 */
export const lyricAscent = lyricFontSize;
export const lyricDescent = lyricFontSize / 4;
/** Minimum vertical gap between musical ink and the lyric row (ADR 0028). */
export const musicToLyricClearance = 3;
/** Top of a lyric row (its ascent plus clearance): musical ink ends above it. */
export const lyricRowTop = (lyricBaselineY: number) =>
  lyricBaselineY - lyricAscent - musicToLyricClearance;
/** Room kept between musical ink and its system's top or bottom edge. */
export const systemMusicPadding = 12;
/** The ordinary room below the lyric row (220 - 180 - 5). */
export const lyricBottomPadding =
  systemHeight - canonicalLyricBaselineY - lyricDescent;

/**
 * Rendering safeguard (Stage 11A): how far renderable musical ink may extend
 * beyond the canonical 220-unit system. Measured extents are clamped to this
 * band before expansion and ink beyond it is clipped, so a distant but valid
 * pitch cannot allocate an arbitrarily tall system.
 */
export const offStaffCanvasMargin = 50 * engravingStaffStep * 2;

export interface VerticalBand {
  top: number;
  bottom: number;
}

/**
 * The canonical maximum rendering band, in the canonical local frame: the
 * furthest any system may ever paint musical ink, whatever its pitches.
 * Measurement clamps to it. It is not a system's resolved box; see
 * `SystemFrame.musicBand`.
 */
export const canonicalMusicBand: VerticalBand = {
  top: -offStaffCanvasMargin,
  bottom: systemHeight + offStaffCanvasMargin,
};

/** One system's requirements in the canonical local frame. */
export interface SystemVerticalMetrics {
  /** Measured renderable musical extent, clamped to `canonicalMusicBand`. */
  music: VerticalBand;
  /** Extra room above the canonical system top for high ink (>= 0). */
  topExpansion: number;
  /** Shared lyric baseline relative to the canonical system top. */
  lyricBaselineY: number;
  /** System bottom relative to the canonical system top. */
  bottom: number;
}

/** A resolved, score-absolute system frame. */
export interface SystemFrame {
  y: number;
  height: number;
  /** Authoritative bottom staff line (pitch origin). */
  bottomStaffY: number;
  lyricBaselineY: number;
  /**
   * Resolved musical band: the canonical maximum band translated to this
   * system's origin and intersected with the system's own box
   * `[y, y + height]`. Musical ink, ledger runs, pointer regions and the
   * overlays drawn with them are clipped to it, so nothing painted or
   * targetable for this system can reach another system (adjacent bands are
   * separated by the inter-system gap).
   */
  musicBand: VerticalBand;
}

const clamp = (value: number, band: VerticalBand) =>
  Math.min(band.bottom, Math.max(band.top, value));

/**
 * Measures complete renderable musical ink (staff, clefs, divisions, custodes,
 * neume bodies, ledgers, rhythmic signs and accidentals) given in the
 * canonical local frame. A system with lyrics reserves a shared lyric row below
 * that ink; a lyricless system keeps only the minimum height.
 */
export function measureSystemVertical(
  ink: readonly LayoutBounds[],
  hasLyrics: boolean,
): SystemVerticalMetrics {
  let top = Infinity;
  let bottom = -Infinity;
  for (const bounds of ink) {
    top = Math.min(top, bounds.y);
    bottom = Math.max(bottom, bounds.y + bounds.height);
  }
  const music =
    top <= bottom
      ? {
          top: clamp(top, canonicalMusicBand),
          bottom: clamp(bottom, canonicalMusicBand),
        }
      : { top: firstSystemBottomStaffY, bottom: firstSystemBottomStaffY };
  const topExpansion = Math.max(0, systemMusicPadding - music.top);
  const lyricBaselineY = Math.max(
    canonicalLyricBaselineY,
    music.bottom + musicToLyricClearance + lyricAscent,
  );
  return {
    music,
    topExpansion,
    lyricBaselineY,
    bottom: Math.max(
      systemHeight,
      music.bottom + systemMusicPadding,
      hasLyrics ? lyricBaselineY + lyricDescent + lyricBottomPadding : 0,
    ),
  };
}

/** Stacks systems from their measured heights with the ordinary gap. */
export function stackSystems(
  metrics: readonly SystemVerticalMetrics[],
  firstSystemTopY = 0,
): SystemFrame[] {
  let y = firstSystemTopY;
  return metrics.map((m) => {
    const origin = y + m.topExpansion;
    const height = m.topExpansion + m.bottom;
    const frame: SystemFrame = {
      y,
      height,
      bottomStaffY: origin + firstSystemBottomStaffY,
      lyricBaselineY: origin + m.lyricBaselineY,
      musicBand: {
        top: Math.max(y, origin + canonicalMusicBand.top),
        bottom: Math.min(y + height, origin + canonicalMusicBand.bottom),
      },
    };
    y += frame.height + systemGap;
    return frame;
  });
}
