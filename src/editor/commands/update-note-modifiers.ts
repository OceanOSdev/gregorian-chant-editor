import type { ChantDocument, ChantNote, Neume } from '../domain/chant-document';
import { findNote } from '../domain/neume';

export type NoteModifierEdit =
  { kind: 'mora'; value: 0 | 1 | 2 } | { kind: 'episema'; value: boolean };

/** One note, one semantic edit. Omitted properties are the canonical off state. */
export function updateNoteModifiers(
  document: ChantDocument,
  noteId: string,
  edit: NoteModifierEdit,
): ChantDocument {
  const located = findNote(document, noteId);
  if (!located) return document;
  const note: ChantNote = { ...located.note };
  if (edit.kind === 'mora') {
    if (![0, 1, 2].includes(edit.value)) return document;
    if ((note.mora ?? 0) === edit.value) return document;
    if (edit.value === 0) delete note.mora;
    else note.mora = edit.value;
  } else if (edit.kind === 'episema') {
    if (typeof edit.value !== 'boolean') return document;
    if (!!note.episema === edit.value) return document;
    if (edit.value) note.episema = true;
    else delete note.episema;
  } else return document;
  // Reconstruct the existing correlated tuple without widening the Neume union.
  const replace = (n: ChantNote) => (n.id === noteId ? note : n);
  const neume = located.neume;
  let updated: Neume;
  switch (neume.kind) {
    case 'punctum':
      updated = { ...neume, notes: [replace(neume.notes[0])] };
      break;
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
  return {
    ...document,
    neumes: document.neumes.map((n) => (n === neume ? updated : n)),
  };
}
