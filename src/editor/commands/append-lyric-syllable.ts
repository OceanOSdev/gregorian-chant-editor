import type {
  ChantDocument,
  LyricSyllable,
} from '../domain/chant-document'

export function appendLyricSyllable(
  document: ChantDocument,
  syllable: LyricSyllable,
): ChantDocument {
  if (document.syllables.some((candidate) => candidate.id === syllable.id)) {
    return document
  }

  return {
    ...document,
    syllables: [...document.syllables, syllable],
  }
}
