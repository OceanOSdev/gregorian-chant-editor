import {
  pesSubpunctisNotes,
  type ChantDocument,
  type ChantNote,
  type Neume,
  type NoteForm,
} from '../domain/chant-document';
import { findNote, isValidNeume } from '../domain/neume';
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
  let updated: Neume;
  switch (neume.kind) {
    case 'pes-subpunctis': {
      const notes = pesSubpunctisNotes(neume.notes.map(replace));
      if (!notes) return document;
      updated = { ...neume, notes };
      break;
    }
    case 'punctum':
      updated = { ...neume, notes: [replace(neume.notes[0])] };
      break;
    case 'bistropha':
    case 'podatus':
    case 'clivis': {
      const [a, b] = neume.notes;
      updated = { ...neume, notes: [replace(a), replace(b)] };
      break;
    }
    default: {
      const [a, b, c] = neume.notes;
      updated = { ...neume, notes: [replace(a), replace(b), replace(c)] };
    }
  }
  if (!isValidNeume(updated)) return document;
  return {
    ...document,
    neumes: document.neumes.map((n) => (n === neume ? updated : n)),
  };
}
