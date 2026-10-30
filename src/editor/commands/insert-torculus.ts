import type { ChantDocument, TorculusNeume } from '../domain/chant-document';
import { isValidNeume } from '../domain/neume';

/**
 * Accepts only a complete boundary, three unique
 * collision-free note IDs, and a runtime-valid rise-then-fall Torculus.
 */
export function insertTorculus(
  document: ChantDocument,
  torculus: TorculusNeume,
  insertionIndex: number,
): ChantDocument {
  const [firstNote, secondNote, thirdNote] = torculus.notes;
  const candidateNoteIds = [firstNote?.id, secondNote?.id, thirdNote?.id];
  const hasUniqueCandidateNoteIds =
    candidateNoteIds.every((id) => id !== undefined) &&
    new Set(candidateNoteIds).size === 3;
  const hasIdCollision = document.neumes.some(
    (neume) =>
      neume.id === torculus.id ||
      neume.notes.some((note) => candidateNoteIds.includes(note.id)),
  );

  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document.neumes.length ||
    !hasUniqueCandidateNoteIds ||
    hasIdCollision ||
    !isValidNeume(torculus)
  ) {
    return document;
  }

  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      torculus,
      ...document.neumes.slice(insertionIndex),
    ],
  };
}
