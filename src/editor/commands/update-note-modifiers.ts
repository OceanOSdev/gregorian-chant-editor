import type { ChantDocument, ChantNote } from '../domain/chant-document';
import {
  getMoraScope,
  moraChoices,
  moraIndexes,
  type MoraScope,
} from '../domain/mora';
import { isValidNeume, findNote, mapNeumeNotes } from '../domain/neume';

export type NoteModifierEdit =
  | { kind: 'mora'; value: 0 | 1 }
  | { kind: 'episema' | 'verticalEpisema'; value: boolean };

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
  } else if (edit.kind === 'episema' || edit.kind === 'verticalEpisema') {
    if (typeof edit.value !== 'boolean') return document;
    if (!!note[edit.kind] === edit.value) return document;
    if (edit.value) note[edit.kind] = true;
    else delete note[edit.kind];
  } else return document;
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

/** A scope edit targets its owning neume and changes the pair in one snapshot. */
export function updateMoraScope(
  document: ChantDocument,
  neumeId: string,
  scope: MoraScope,
): ChantDocument {
  const neume = document.neumes.find((n) => n.id === neumeId);
  if (
    !neume ||
    !moraChoices(neume.kind, neume.notes.length).some(
      (c) => c.value === scope,
    ) ||
    getMoraScope(neume) === scope
  )
    return document;
  const indexes = moraIndexes(scope, neume.notes.length);
  const replace = (note: ChantNote, index: number): ChantNote => {
    const marked = indexes.includes(index);
    if (!!note.mora === marked) return note;
    const result = { ...note };
    if (marked) result.mora = 1;
    else delete result.mora;
    return result;
  };
  const updated = mapNeumeNotes(neume, replace);
  if (!updated || !isValidNeume(updated)) return document;
  return {
    ...document,
    neumes: document.neumes.map((n) => (n === neume ? updated : n)),
  };
}
