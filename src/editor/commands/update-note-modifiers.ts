import type { ChantDocument, ChantNote, Neume } from '../domain/chant-document';
import {
  getMoraScope,
  moraChoices,
  moraIndexes,
  type MoraScope,
} from '../domain/mora';
import { isValidNeume, findNote } from '../domain/neume';

export type NoteModifierEdit =
  { kind: 'mora'; value: 0 | 1 } | { kind: 'episema'; value: boolean };

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
    if (![0, 1].includes(edit.value)) return document;
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
  if (!isValidNeume(updated)) return document;
  return {
    ...document,
    neumes: document.neumes.map((n) => (n === neume ? updated : n)),
  };
}

/** A scope edit targets its owning neume and changes the pair in one snapshot. */
export function updateMoraScope(
  document: ChantDocument,
  neumeId: string,
  scope: MoraScope,
): ChantDocument {
  const neume = document.neumes.find((n) => n.id === neumeId);
  if (
    !neume ||
    !moraChoices(neume.kind).some((c) => c.value === scope) ||
    getMoraScope(neume) === scope
  )
    return document;
  const indexes = moraIndexes(scope);
  const replace = (note: ChantNote, index: number): ChantNote => {
    const marked = indexes.includes(index);
    if (!!note.mora === marked) return note;
    const result = { ...note };
    if (marked) result.mora = 1;
    else delete result.mora;
    return result;
  };
  let updated: Neume;
  switch (neume.kind) {
    case 'punctum':
      updated = { ...neume, notes: [replace(neume.notes[0], 0)] };
      break;
    case 'podatus':
    case 'clivis':
      updated = {
        ...neume,
        notes: [replace(neume.notes[0], 0), replace(neume.notes[1], 1)],
      };
      break;
    default:
      updated = {
        ...neume,
        notes: [
          replace(neume.notes[0], 0),
          replace(neume.notes[1], 1),
          replace(neume.notes[2], 2),
        ],
      };
  }
  if (!isValidNeume(updated)) return document;
  return {
    ...document,
    neumes: document.neumes.map((n) => (n === neume ? updated : n)),
  };
}
