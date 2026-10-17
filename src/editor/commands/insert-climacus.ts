import type { ChantDocument, ClimacusNeume } from '../domain/chant-document';
import { isValidNeume } from '../domain/neume';

/**
 * Accepts only a complete boundary, an existing syllable, three unique
 * collision-free note IDs, and a runtime-valid strictly descending Climacus.
 */
export function insertClimacus(
  document: ChantDocument,
  climacus: ClimacusNeume,
  insertionIndex: number,
): ChantDocument {
  const [firstNote, secondNote, thirdNote] = climacus.notes;
  const candidateNoteIds = [firstNote?.id, secondNote?.id, thirdNote?.id];
  const hasUniqueCandidateNoteIds =
    candidateNoteIds.every((id) => id !== undefined) &&
    new Set(candidateNoteIds).size === 3;
  const hasIdCollision = document.neumes.some(
    (neume) =>
      neume.id === climacus.id ||
      neume.notes.some((note) => candidateNoteIds.includes(note.id)),
  );
  const hasSyllable = document.syllables.some(
    (syllable) => syllable.id === climacus.lyricSyllableId,
  );

  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document.neumes.length ||
    !hasSyllable ||
    !hasUniqueCandidateNoteIds ||
    hasIdCollision ||
    !isValidNeume(climacus)
  ) {
    return document;
  }

  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      climacus,
      ...document.neumes.slice(insertionIndex),
    ],
  };
}
