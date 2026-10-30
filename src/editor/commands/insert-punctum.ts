import type { ChantDocument, PunctumNeume } from '../domain/chant-document';
import { isValidNeume } from '../domain/neume';

export function insertPunctum(
  document: ChantDocument,
  punctum: PunctumNeume,
  insertionIndex: number,
): ChantDocument {
  const note = punctum.notes[0];
  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document.neumes.length ||
    !isValidNeume(punctum) ||
    !note ||
    document.neumes.some(
      (n) =>
        n.id === punctum.id ||
        n.notes.some((existing) => existing.id === note.id),
    )
  )
    return document;
  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      punctum,
      ...document.neumes.slice(insertionIndex),
    ],
  };
}
