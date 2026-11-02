import type {
  ChantDocument,
  LyricAlignmentSegment,
  LyricLanguage,
} from '../domain/chant-document';
import { lyricLanguage, validAlignment } from '../domain/lyric-alignment';

export function updateLyricLanguage(
  document: ChantDocument,
  language: LyricLanguage,
): ChantDocument {
  if (
    lyricLanguage(language) !== language ||
    document.lyricLanguage === language
  )
    return document;
  return { ...document, lyricLanguage: language };
}

export function updateLyricAlignment(
  document: ChantDocument,
  syllableId: string,
  alignment: LyricAlignmentSegment | undefined,
): ChantDocument {
  const syllable = document.syllables.find((s) => s.id === syllableId);
  if (
    !syllable ||
    (alignment && !validAlignment(syllable.text, alignment)) ||
    (syllable.alignment?.start === alignment?.start &&
      syllable.alignment?.end === alignment?.end)
  )
    return document;
  const { alignment: _previous, ...rest } = syllable;
  const next = alignment ? { ...rest, alignment: { ...alignment } } : rest;
  return {
    ...document,
    syllables: document.syllables.map((s) => (s === syllable ? next : s)),
  };
}
