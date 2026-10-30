import { findSyllableForNeume } from '../domain/lyrics';
import type { ChantDocument } from '../domain/chant-document';
import { findNeume, findNote } from '../domain/neume';

/** Transient selection stores stable semantic IDs, never layout objects. */
export type EditorSelection =
  | { kind: 'none' }
  | { kind: 'note'; noteId: string }
  | { kind: 'neume'; neumeId: string }
  | { kind: 'syllable'; syllableId: string };

export function clearSelection(): EditorSelection {
  return { kind: 'none' };
}

export function selectNote(noteId: string): EditorSelection {
  return { kind: 'note', noteId };
}

export function selectNeume(neumeId: string): EditorSelection {
  return { kind: 'neume', neumeId };
}

/** Clears selection only when its stable semantic target no longer exists. */
export function reconcileSelection(
  document: ChantDocument,
  selection: EditorSelection,
): EditorSelection {
  if (selection.kind === 'none') {
    return selection;
  }

  if (selection.kind === 'syllable')
    return document.syllables.some((s) => s.id === selection.syllableId)
      ? selection
      : clearSelection();

  const selectionExists =
    selection.kind === 'note'
      ? findNote(document, selection.noteId)
      : findNeume(document, selection.neumeId);

  return selectionExists ? selection : clearSelection();
}

export function resolveSelectionSyllableId(
  document: ChantDocument,
  selection: EditorSelection,
): string | null {
  if (selection.kind === 'syllable')
    return document.syllables.some((s) => s.id === selection.syllableId)
      ? selection.syllableId
      : null;
  if (selection.kind === 'note') {
    const neume = findNote(document, selection.noteId)?.neume;
    return neume
      ? (findSyllableForNeume(document, neume.id)?.id ?? null)
      : null;
  }

  if (selection.kind === 'neume') {
    return findSyllableForNeume(document, selection.neumeId)?.id ?? null;
  }

  return null;
}

export function selectSyllable(syllableId: string): EditorSelection {
  return { kind: 'syllable', syllableId };
}
