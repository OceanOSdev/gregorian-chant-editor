import { reconcileAccidentals } from '../domain/accidentals';
import type { ChantDocument } from '../domain/chant-document';
import { hasValidLyricAnchors } from '../domain/lyrics';

function reassignLyricSyllableCandidate(
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

function updateLyricBoundaryCandidate(
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

export function reassignLyricSyllable(
  ...args: Parameters<typeof reassignLyricSyllableCandidate>
): ChantDocument {
  return (
    reconcileAccidentals(args[0], reassignLyricSyllableCandidate(...args)) ??
    args[0]
  );
}

export function updateLyricBoundary(
  ...args: Parameters<typeof updateLyricBoundaryCandidate>
): ChantDocument {
  return (
    reconcileAccidentals(args[0], updateLyricBoundaryCandidate(...args)) ??
    args[0]
  );
}
