import { lyricDescent } from '../layout/system-vertical-layout';

/** Font size of the cue's label (`.score__lyric-focus-cue`). */
export const lyricFocusCueFontSize = 11;
const gapBelowLyric = 2;
const triangleHeight = 6;
const triangleHalfWidth = 5;
const labelGap = 2;

/**
 * Keyboard-focus cue for a lyric: an upward triangle under the syllable and a
 * label below it. Both sit in the lyric row's bottom padding, below the
 * reserved descent, so the cue never overlaps musical ink (which ends above
 * the lyric row) or the lyric text, and needs no extra system height.
 */
export function lyricFocusCue(lyric: { x: number; y: number }) {
  const apexY = lyric.y + lyricDescent + gapBelowLyric;
  const baseY = apexY + triangleHeight;
  const labelBaselineY = baseY + labelGap + lyricFocusCueFontSize;
  return {
    path: `M${lyric.x},${apexY} l${triangleHalfWidth},${triangleHeight} h${-2 * triangleHalfWidth} Z`,
    labelX: lyric.x,
    labelBaselineY,
    /** Conservative vertical extent: triangle apex to the label's descent. */
    top: apexY,
    bottom: labelBaselineY + lyricFocusCueFontSize * 0.3,
  };
}
