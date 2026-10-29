import type { ChantDocument } from '../domain/chant-document';
import { hasValidLyricAnchors } from '../domain/lyrics';

export function reassignLyricSyllable(
  document: ChantDocument,
  syllableId: string,
  neumeId: string,
): ChantDocument {
  const syllable = document.syllables.find((s) => s.id === syllableId);
  if (!syllable || syllable.startsAtNeumeId === neumeId) return document;
  const candidate = {
    ...document,
    syllables: document.syllables.map((s) =>
      s.id === syllableId ? { ...s, startsAtNeumeId: neumeId } : s,
    ),
  };
  return hasValidLyricAnchors(candidate) ? candidate : document;
}

export function updateLyricBoundary(
  document: ChantDocument,
  syllableId: string,
  boundaryBefore: 'word' | 'continuation',
): ChantDocument {
  const syllable = document.syllables.find((s) => s.id === syllableId);
  if (!syllable || syllable.boundaryBefore === boundaryBefore) return document;
  const candidate = {
    ...document,
    syllables: document.syllables.map((s) =>
      s.id === syllableId ? { ...s, boundaryBefore } : s,
    ),
  };
  return hasValidLyricAnchors(candidate) ? candidate : document;
}
