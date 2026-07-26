import type { ChantDocument } from '../domain/chant-document';
import { findNote, normalizeNeumeAfterNoteDeletion } from '../domain/neume';

export function deleteNote(
  document: ChantDocument,
  noteId: string,
): ChantDocument {
  const locatedNote = findNote(document, noteId);

  if (!locatedNote) {
    return document;
  }

  const normalizedNeume = normalizeNeumeAfterNoteDeletion(
    locatedNote.neume,
    noteId,
  );

  return {
    ...document,
    neumes: normalizedNeume
      ? document.neumes.map((neume, index) =>
          index === locatedNote.neumeIndex ? normalizedNeume : neume,
        )
      : document.neumes.filter((_, index) => index !== locatedNote.neumeIndex),
  };
}
