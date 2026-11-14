import type {
  ChantDocument,
  ChantNote,
  NoteForm,
} from '../domain/chant-document';
import { findNote, isValidNeume, mapNeumeNotes } from '../domain/neume';
import { isNoteForm } from '../domain/note-forms';

/** Omission is the canonical contextual/default form. */
export function updateNoteForm(
  document: ChantDocument,
  noteId: string,
  form: NoteForm | undefined,
): ChantDocument {
  const located = findNote(document, noteId);
  if (
    !located ||
    (form !== undefined && !isNoteForm(form)) ||
    located.note.form === form
  )
    return document;
  const note: ChantNote = { ...located.note };
  if (form === undefined) delete note.form;
  else note.form = form;
  // Reconstruct the existing correlated tuple without widening the Neume union.
  const replace = (n: ChantNote) => (n.id === noteId ? note : n);
  const neume = located.neume;
  const updated = mapNeumeNotes(neume, replace);
  if (!updated || !isValidNeume(updated)) return document;
  return {
    ...document,
    neumes: document.neumes.map((n) => (n === neume ? updated : n)),
  };
}
