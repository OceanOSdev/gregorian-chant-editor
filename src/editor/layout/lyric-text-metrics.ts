import type { LyricSyllable, LyricLanguage } from '../domain/chant-document';
import {
  automaticLyricSegment,
  lyricGraphemes,
  validAlignment,
} from '../domain/lyric-alignment';

export const lyricFontFamily = "Georgia, 'Times New Roman', serif";
export const lyricFontSize = 20;
export interface LyricTextMetrics {
  width: number;
  /** Advance positions at each grapheme boundary, including zero and text end. */
  boundaries: readonly number[];
  /** Optional painted bounds relative to the start of the text advance. */
  inkBounds?: { left: number; right: number };
}
export type MeasureLyricText = (text: string) => LyricTextMetrics | null;

/** Missing/invalid metrics preserve deterministic whole-string centering. */
export function alignLyricText(
  syllable: LyricSyllable,
  language: LyricLanguage,
  measure?: MeasureLyricText,
) {
  const count = lyricGraphemes(syllable.text).length;
  const segment =
    syllable.alignment && validAlignment(syllable.text, syllable.alignment)
      ? syllable.alignment
      : automaticLyricSegment(syllable.text, language);
  const metrics = measure?.(syllable.text);
  if (
    !metrics ||
    !Number.isFinite(metrics.width) ||
    metrics.width <= 0 ||
    metrics.boundaries.length !== count + 1 ||
    metrics.boundaries.some(
      (x, i, xs) => !Number.isFinite(x) || x < 0 || (i > 0 && x < xs[i - 1]),
    ) ||
    metrics.boundaries[0] !== 0 ||
    metrics.boundaries[count] !== metrics.width ||
    (metrics.inkBounds !== undefined &&
      (!Number.isFinite(metrics.inkBounds.left) ||
        !Number.isFinite(metrics.inkBounds.right) ||
        metrics.inkBounds.right < metrics.inkBounds.left))
  ) {
    return { offset: 0, width: null, segment, measured: false };
  }
  const center =
    (metrics.boundaries[segment.start] + metrics.boundaries[segment.end]) / 2;
  return {
    offset: metrics.width / 2 - center,
    width: metrics.width,
    segment,
    measured: true,
    ...(metrics.inkBounds ? { inkBounds: metrics.inkBounds } : {}),
  };
}

/** Occupied edges relative to the musical anchor; alignment still uses advances. */
export function lyricTextExtents(alignment: ReturnType<typeof alignLyricText>) {
  if (alignment.width === null) return null;
  const start = alignment.offset - alignment.width / 2;
  return {
    left: start + Math.min(0, alignment.inkBounds?.left ?? 0),
    right:
      start +
      Math.max(alignment.width, alignment.inkBounds?.right ?? alignment.width),
  };
}
