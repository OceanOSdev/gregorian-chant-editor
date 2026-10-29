import type { ChantDocument, LyricSyllable } from '../domain/chant-document';
import { hasValidLyricAnchors } from '../domain/lyrics';

export function createLyricSyllable(
  document: ChantDocument,
  syllable: LyricSyllable,
): ChantDocument {
  const at = document.neumes.findIndex(
    (n) => n.id === syllable.startsAtNeumeId,
  );
  if (
    at < 0 ||
    document.syllables.some(
      (s) =>
        s.id === syllable.id || s.startsAtNeumeId === syllable.startsAtNeumeId,
    )
  )
    return document;
  const next = document.syllables.findIndex(
    (s) => document.neumes.findIndex((n) => n.id === s.startsAtNeumeId) > at,
  );
  const index = next < 0 ? document.syllables.length : next;
  const candidate = {
    ...document,
    syllables: [
      ...document.syllables.slice(0, index),
      index === 0 ? { ...syllable, boundaryBefore: 'word' as const } : syllable,
      ...document.syllables.slice(index),
    ],
  };
  return hasValidLyricAnchors(candidate) ? candidate : document;
}
