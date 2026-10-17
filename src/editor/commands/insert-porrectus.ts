import type { ChantDocument, PorrectusNeume } from '../domain/chant-document';
import { isValidNeume } from '../domain/neume';

/**
 * Accepts only a complete boundary, an existing syllable, three unique
 * collision-free note IDs, and a runtime-valid fall-then-rise Porrectus.
 */
export function insertPorrectus(
  document: ChantDocument,
  porrectus: PorrectusNeume,
  insertionIndex: number,
): ChantDocument {
  const [firstNote, secondNote, thirdNote] = porrectus.notes;
  const candidateNoteIds = [firstNote?.id, secondNote?.id, thirdNote?.id];
  const hasUniqueCandidateNoteIds =
    candidateNoteIds.every((id) => id !== undefined) &&
    new Set(candidateNoteIds).size === 3;
  const hasIdCollision = document.neumes.some(
    (neume) =>
      neume.id === porrectus.id ||
      neume.notes.some((note) => candidateNoteIds.includes(note.id)),
  );
  const hasSyllable = document.syllables.some(
    (syllable) => syllable.id === porrectus.lyricSyllableId,
  );

  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document.neumes.length ||
    !hasSyllable ||
    !hasUniqueCandidateNoteIds ||
    hasIdCollision ||
    !isValidNeume(porrectus)
  ) {
    return document;
  }

  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      porrectus,
      ...document.neumes.slice(insertionIndex),
    ],
  };
}
