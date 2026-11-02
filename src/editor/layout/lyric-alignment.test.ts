import { describe, expect, it } from 'vitest';
import {
  automaticLyricSegment,
  lyricGraphemes,
  lyricLanguage,
} from '../domain/lyric-alignment';
import type { LyricLanguage, LyricSyllable } from '../domain/chant-document';
import { alignLyricText } from './lyric-text-metrics';
import { layoutChant } from './layout-chant';
import { exampleDocument } from '../domain/example-document';

const syllable = (text: string): LyricSyllable => ({
  id: 's',
  text,
  startsAtNeumeId: 'n',
  boundaryBefore: 'word',
});
const measure = (text: string) => {
  const count = lyricGraphemes(text).length;
  return {
    width: count * 10,
    boundaries: Array.from({ length: count + 1 }, (_, i) => i * 10),
  };
};

describe('language-specific lyric segments', () => {
  it.each([
    ['Ky', 'la', 'y'],
    ['ri', 'la', 'i'],
    ['e', 'la', 'e'],
    ['lé', 'la', 'é'],
    ['son', 'la', 'o'],
    ['au', 'la', 'au'],
    ['qui', 'la', 'i'],
    ['æ', 'la', 'æ'],
    ['lε', 'la', 'lε'],
    ['a\u0313\u0301', 'el', 'a\u0313\u0301'],
    ['κἀ\u0301', 'el', 'ἀ\u0301'],
    ['son', 'en', 'o'],
    ['read', 'en', 'read'],
    ['fire', 'en', 'fire'],
    ['Ky', 'und', 'Ky'],
    ['son', 'el', 'son'],
    ['κἀ', 'la', 'κἀ'],
    ['dea', 'la', 'dea'],
  ] as const)('%s in %s aligns %s', (text, language, expected) => {
    const range = automaticLyricSegment(text, language);
    expect(lyricGraphemes(text).slice(range.start, range.end).join('')).toBe(
      expected,
    );
  });
  it('uses und for malformed or missing runtime language', () => {
    for (const value of [undefined, null, 'fr', 2, {}])
      expect(lyricLanguage(value)).toBe('und');
    expect(lyricLanguage('und')).toBe('und');
  });
  it('handles missing and malformed runtime document languages as whole text', () => {
    for (const value of [undefined, 'fr', null]) {
      const legacy = { ...exampleDocument };
      Object.defineProperty(legacy, 'lyricLanguage', { value });
      const lyric = layoutChant(legacy, measure).systems[0].lyrics[0];
      expect(lyric.x).toBe(lyric.anchorX);
    }
  });
  it('measures a combining sequence as one grapheme and computes explicit offset', () => {
    const result = alignLyricText(syllable('le\u0301'), 'la', measure);
    expect(result).toEqual({
      segment: { start: 1, end: 2 },
      offset: -5,
      width: 20,
      measured: true,
    });
  });
  it('manual multi-grapheme ranges supersede language and reset uses current language', () => {
    const s = { ...syllable('qui'), alignment: { start: 0, end: 2 } };
    expect(alignLyricText(s, 'und', measure).offset).toBe(5);
    expect(alignLyricText(syllable('qui'), 'la', measure).offset).toBe(-10);
    expect(alignLyricText(syllable('qui'), 'und', measure).offset).toBe(0);
  });
  it('rejects malformed metrics deterministically and ignores an invalid override', () => {
    expect(alignLyricText(syllable('Ky'), 'la').offset).toBe(0);
    for (const metrics of [
      null,
      { width: NaN, boundaries: [] },
      { width: 20, boundaries: [0, 30, 20] },
      { width: 20, boundaries: [0, 10] },
    ]) {
      expect(alignLyricText(syllable('Ky'), 'la', () => metrics).measured).toBe(
        false,
      );
    }
    expect(
      alignLyricText(
        { ...syllable('Ky'), alignment: { start: 1, end: 4 } },
        'la',
        measure,
      ).segment,
    ).toEqual({ start: 1, end: 2 });
  });
  it('leaves multi-system music, anchors and wrapping unchanged', () => {
    const document = {
      ...exampleDocument,
      neumes: Array.from({ length: 25 }, (_, i) => ({
        ...exampleDocument.neumes[0],
        id: `n${i}`,
      })),
      syllables: [syllable('qui')],
    };
    document.syllables[0].startsAtNeumeId = 'n0';
    const baseline = layoutChant(document);
    for (const language of ['la', 'en', 'el', 'und'] as LyricLanguage[]) {
      const layout = layoutChant(
        { ...document, lyricLanguage: language },
        measure,
      );
      expect(layout.systems.length).toBeGreaterThan(1);
      expect(layout.systems.map((s) => s.neumes)).toEqual(
        baseline.systems.map((s) => s.neumes),
      );
      expect(layout.height).toBe(baseline.height);
      expect(layout.systems[0].lyrics[0].anchorX).toBe(
        baseline.systems[0].lyrics[0].anchorX,
      );
    }
  });
});
