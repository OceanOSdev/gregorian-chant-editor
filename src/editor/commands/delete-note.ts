import { reconcileAccidentalsResult } from '../domain/accidentals';
import { deleteNeumeCandidate } from './delete-neume';
import type { ChantDocument } from '../domain/chant-document';
import { findNote, normalizeNeumeAfterNoteDeletion } from '../domain/neume';

function deleteNoteCandidate(
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

  if (!normalizedNeume)
    return deleteNeumeCandidate(document, locatedNote.neume.id);

  return {
    ...document,
    neumes: document.neumes.map((neume, index) =>
      index === locatedNote.neumeIndex ? normalizedNeume : neume,
    ),
  };
}

export function deleteNoteResult(
  ...args: Parameters<typeof deleteNoteCandidate>
) {
  return reconcileAccidentalsResult(args[0], deleteNoteCandidate(...args));
}

export function deleteNote(
  ...args: Parameters<typeof deleteNoteCandidate>
): ChantDocument {
  return deleteNoteResult(...args).document;
}
