import type {
  ChantDocument,
  ClivisNeume,
  PodatusNeume,
} from '../domain/chant-document';
import { isValidNeume } from '../domain/neume';

export type TwoNoteNeume = PodatusNeume | ClivisNeume;

/**
 * Accepts only a complete boundary, collision-free
 * identities, and a runtime-valid Podatus or Clivis contour.
 */
export function insertTwoNoteNeume(
  document: ChantDocument,
  neume: TwoNoteNeume,
  insertionIndex: number,
): ChantDocument {
  if (!isValidNeume(neume)) return document;
  const [firstNote, secondNote] = neume.notes;
  const hasDuplicateId =
    firstNote.id === secondNote.id ||
    document.neumes.some(
      (existingNeume) =>
        existingNeume.id === neume.id ||
        existingNeume.notes.some(
          (note) => note.id === firstNote.id || note.id === secondNote.id,
        ),
    );

  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document.neumes.length ||
    hasDuplicateId ||
    !isValidNeume(neume)
  ) {
    return document;
  }

  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      neume,
      ...document.neumes.slice(insertionIndex),
    ],
  };
}
