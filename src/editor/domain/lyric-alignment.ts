import type { LyricAlignmentSegment, LyricLanguage } from './chant-document';

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
export function lyricGraphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

export function lyricLanguage(value: unknown): LyricLanguage {
  return value === 'la' || value === 'en' || value === 'el' ? value : 'und';
}

export function validAlignment(
  text: string,
  range: LyricAlignmentSegment,
): boolean {
  return (
    Number.isInteger(range.start) &&
    Number.isInteger(range.end) &&
    range.start >= 0 &&
    range.end > range.start &&
    range.end <= lyricGraphemes(text).length
  );
}

/** Conservative spelling rules, never language detection or syllabification. */
export function automaticLyricSegment(
  text: string,
  language: LyricLanguage,
): LyricAlignmentSegment {
  const graphemes = lyricGraphemes(text);
  const whole = { start: 0, end: graphemes.length };
  const letters = graphemes.map((g) =>
    g.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(),
  );
  const normalized = letters.join('');
  const greek = language === 'el';
  if (
    language === 'und' ||
    !(greek ? /^[α-ω]+$/u : /^[a-zæœ]+$/u).test(normalized)
  )
    return whole;
  const vowels = greek ? 'αεηιουω' : 'aeiouyæœ';
  const indexes = letters.flatMap((g, i) =>
    vowels.includes(g) &&
    !(language === 'la' && g === 'u' && letters[i - 1] === 'q')
      ? [i]
      : [],
  );
  const first = indexes[0];
  if (first === undefined) return whole;
  if (language === 'en') {
    // Single a/e/i/o/u with consonants on either side is the deliberately small supported case.
    if (
      indexes.length !== 1 ||
      !/^[bcdfghjklmnpqrstvwxz]+[aeiou][bcdfghjklmnpqrstvwxz]+$/.test(
        normalized,
      )
    )
      return whole;
  }
  if (indexes.length === 1) return { start: first, end: first + 1 };
  const pair = letters.slice(first, first + 2).join('');
  const pairs = greek
    ? ['αι', 'ει', 'οι', 'υι', 'αυ', 'ευ', 'ου', 'ηυ']
    : ['ae', 'au', 'oe'];
  if (
    language !== 'en' &&
    indexes.length === 2 &&
    indexes[1] === first + 1 &&
    pairs.includes(pair)
  )
    return { start: first, end: first + 2 };
  return whole;
}
