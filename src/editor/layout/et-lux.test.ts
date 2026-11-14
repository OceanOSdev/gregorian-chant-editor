import { describe, expect, it } from 'vitest';
import { etLuxCorpus } from '../../../docs/verification/word-composition/et-lux';
import {
  findSyllableAtNeume,
  findSyllableForNeume,
  hasValidLyricAnchors,
} from '../domain/lyrics';
import { isValidNeume } from '../domain/neume';
import { layoutChant, staffEndX, intraSyllableInkGap } from './layout-chant';
import { alignLyricText, type MeasureLyricText } from './lyric-text-metrics';
const measure: MeasureLyricText = (text) => ({
  width: text.length * 10,
  boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 10),
});
describe.each(etLuxCorpus)('$id', (sample) => {
  it('owns both same-pitch puncta with one et syllable and no fabricated lyric boundary', () => {
    const d = sample.document,
      et = d.syllables[0],
      at = d.neumes.findIndex((n) => n.id === et.startsAtNeumeId),
      pair = d.neumes.slice(at, at + 2);
    expect(hasValidLyricAnchors(d)).toBe(true);
    expect(d.neumes.every(isValidNeume)).toBe(true);
    expect(
      pair.map((n) => [n.kind, ...n.notes.map((note) => note.staffPosition)]),
    ).toEqual([
      ['punctum', 5],
      ['punctum', 5],
    ]);
    expect(pair.map((n) => findSyllableForNeume(d, n.id)?.id)).toEqual([
      et.id,
      et.id,
    ]);
    expect(findSyllableAtNeume(d, pair[1].id)).toBeNull();
    const l = layoutChant(d, measure),
      lyrics = l.systems.flatMap((s) => s.lyrics);
    expect(lyrics.filter((t) => t.syllableId === et.id)).toHaveLength(1);
    const owner = l.systems.find((s) =>
      s.lyrics.some((t) => t.syllableId === et.id),
    );
    const luxSystem = l.systems.find((s) =>
      s.lyrics.some((t) => t.syllableId === d.syllables[1].id),
    );
    const end =
      luxSystem?.index === owner?.index ? Number(lyrics[1].left) : staffEndX;
    expect(owner?.hyphens.filter((h) => h.x <= end)).toHaveLength(0); // Later perpetua marks remain legitimate.
    const notes = l.systems.flatMap((s) => s.neumes),
      first = notes.find((n) => n.neumeId === pair[0].id),
      second = notes.find((n) => n.neumeId === pair[1].id),
      text = lyrics[0];
    expect(text.alignment.segment).toEqual({ start: 0, end: 1 });
    expect(text.anchorX).toBe(first?.lyricAnchorX);
    expect(text.x).toBe(
      text.anchorX + alignLyricText(et, 'la', measure).offset,
    );
    if (sample.id === 'et-lux-split-span')
      expect(
        l.systems.find((s) => s.neumes.some((n) => n.neumeId === pair[0].id))
          ?.index,
      ).not.toBe(
        l.systems.find((s) => s.neumes.some((n) => n.neumeId === pair[1].id))
          ?.index,
      );
    else if (first && second)
      expect(second.bounds.x - first.bounds.x - first.bounds.width).toBe(
        intraSyllableInkGap,
      );
  });
});
it('preserves the full reference pitch sequence while decomposing unsupported compound glyphs', () => {
  const d = etLuxCorpus[1].document;
  expect(d.syllables.map((s) => [s.text, s.boundaryBefore])).toEqual([
    ['et', 'word'],
    ['lux', 'word'],
    ['per', 'word'],
    ['pé', 'continuation'],
    ['tu', 'continuation'],
    ['a', 'continuation'],
  ]);
  const bySyllable = d.syllables.map((s) =>
    d.neumes
      .filter((n) => findSyllableForNeume(d, n.id)?.id === s.id)
      .flatMap((n) => n.notes.map((note) => note.staffPosition)),
  );
  expect(bySyllable).toEqual([
    [5, 5],
    [5],
    [5],
    [5, 4, 5, 6, 7, 5, 4, 5, 5, 4, 6, 5, 6, 5, 3],
    [3],
    [3, 5, 3, 2, 3, 5, 5, 3, 5, 5, 4, 3, 5, 2, 2, 1],
  ]);
});
