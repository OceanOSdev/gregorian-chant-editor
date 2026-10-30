import { deleteNeume } from './delete-neume';
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

  if (normalizedNeume === locatedNote.neume) {
    return document;
  }

  if (!normalizedNeume) return deleteNeume(document, locatedNote.neume.id);

  return {
    ...document,
    neumes: document.neumes.map((neume, index) =>
      index === locatedNote.neumeIndex ? normalizedNeume : neume,
    ),
  };
}
