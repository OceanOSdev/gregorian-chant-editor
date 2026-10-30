import type { ChantDocument } from '../domain/chant-document';

export function deleteLyricSyllable(
  document: ChantDocument,
  syllableId: string,
): ChantDocument {
  const index = document.syllables.findIndex((s) => s.id === syllableId);
  const removed = document.syllables[index];
  if (!removed) return document;
  const syllables = document.syllables.filter((s) => s.id !== syllableId);
  const successor = syllables[index];
  if (
    successor &&
    (index === 0 || removed.boundaryBefore === 'word') &&
    successor.boundaryBefore !== 'word'
  ) {
    syllables[index] = { ...successor, boundaryBefore: 'word' };
  }
  return { ...document, syllables };
}
