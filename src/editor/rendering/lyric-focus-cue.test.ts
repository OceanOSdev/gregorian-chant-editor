import { describe, expect, it } from 'vitest';
import salveRegina from '../examples/Salve-Regina-Dominican.chant.json?raw';
import { layoutChant } from '../layout/layout-chant';
import type { MeasureLyricText } from '../layout/lyric-text-metrics';
import { lyricDescent, lyricRowTop } from '../layout/system-vertical-layout';
import { decodeDocument } from '../persistence/native-document';
import { lyricFocusCue } from './lyric-focus-cue';

const bundledSources = import.meta.glob<string>('../examples/*.chant.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const measure: MeasureLyricText = (text) => {
  const graphemes = [...text];
  return {
    width: graphemes.length * 10,
    boundaries: Array.from({ length: graphemes.length + 1 }, (_, i) => i * 10),
  };
};

describe('lyric keyboard-focus cue', () => {
  it('sits below Je of Et Jesum instead of on its low A (regression)', () => {
    const layout = layoutChant(decodeDocument(salveRegina), measure);
    const je = '925dd4f8-95c3-4fb2-85d6-b09838c2b6ad';
    const system = layout.systems.find((s) =>
      s.neumes.some((n) => n.neumeId === je),
    );
    const neume = system?.neumes.find((n) => n.neumeId === je);
    const lyric = system?.lyrics.find((l) => l.text === 'Je');
    if (!system || !neume || !lyric) throw Error('Missing Je');
    const inkBottom = neume.bounds.y + neume.bounds.height;
    // The former triangle (6 units, 30 above the baseline) overlapped Je's
    // ink, whose bottom sits exactly at the lyric row's clearance boundary.
    const formerTop = lyric.y - lyric.fontSize - 10;
    expect(formerTop).toBeLessThan(inkBottom);
    expect(formerTop + 6).toBeGreaterThan(neume.bounds.y);
    const cue = lyricFocusCue(lyric);
    expect(cue.top).toBeGreaterThan(inkBottom);
    expect(cue.top).toBeGreaterThan(lyric.y + lyricDescent);
    expect(cue.bottom).toBeLessThanOrEqual(system.y + system.height);
  });

  it.each(Object.entries(bundledSources))(
    'stays within the lyric row bottom padding of every system (%s)',
    (_path, source) => {
      for (const system of layoutChant(decodeDocument(source), measure)
        .systems) {
        const musicBottom = lyricRowTop(system.lyricBaselineY);
        for (const lyric of system.lyrics) {
          const cue = lyricFocusCue(lyric);
          // Below the reserved lyric descent, hence below all lyric text and
          // musical ink, and inside the system box without expanding it.
          expect(cue.top).toBeGreaterThan(system.lyricBaselineY + lyricDescent);
          expect(cue.top).toBeGreaterThan(musicBottom);
          expect(cue.bottom).toBeLessThanOrEqual(system.y + system.height);
        }
      }
    },
  );
});
