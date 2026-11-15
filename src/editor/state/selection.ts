import { findSyllableForNeume } from '../domain/lyrics';
import type { ChantDocument } from '../domain/chant-document';
import { findNeume, findNote } from '../domain/neume';

/** Transient semantic targets: stable entity IDs or the singleton clef tag. */
export type EditorSelection =
  | { kind: 'accidental'; accidentalId: string }
  | { kind: 'clef' }
  | { kind: 'clef-change'; clefChangeId: string }
  | { kind: 'division'; divisionId: string }
  | { kind: 'neume-range'; anchorNeumeId: string; endpointNeumeId: string }
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

/** Clears missing entity targets; the required singleton clef always survives. */
export function reconcileSelection(
  document: ChantDocument,
  selection: EditorSelection,
): EditorSelection {
  if (selection.kind === 'neume-range') {
    if (!resolveNeumeRange(document, selection)) return clearSelection();
    return selection.anchorNeumeId === selection.endpointNeumeId
      ? selectNeume(selection.anchorNeumeId)
      : selection;
  }
  if (selection.kind === 'none' || selection.kind === 'clef') {
    return selection;
  }
  if (selection.kind === 'accidental')
    return document.accidentals.some((a) => a.id === selection.accidentalId)
      ? selection
      : clearSelection();

  if (selection.kind === 'clef-change')
    return document.clefChanges.some((c) => c.id === selection.clefChangeId)
      ? selection
      : clearSelection();

  if (selection.kind === 'division')
    return document.divisions.some((d) => d.id === selection.divisionId)
      ? selection
      : clearSelection();

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

/** Inclusive canonical membership, independent of layout and selection direction. */
export function resolveNeumeRange(
  document: ChantDocument,
  selection: EditorSelection,
) {
  if (selection.kind !== 'neume-range') return null;
  const anchor = document.neumes.findIndex(
    (n) => n.id === selection.anchorNeumeId,
  );
  const endpoint = document.neumes.findIndex(
    (n) => n.id === selection.endpointNeumeId,
  );
  if (anchor < 0 || endpoint < 0) return null;
  const start = Math.min(anchor, endpoint);
  const end = Math.max(anchor, endpoint);
  const neumes = document.neumes.slice(start, end + 1);
  return { start, end, neumes, ids: new Set(neumes.map((n) => n.id)) };
}

export function selectionNeumeId(
  document: ChantDocument,
  selection: EditorSelection,
): string | null {
  if (selection.kind === 'note')
    return findNote(document, selection.noteId)?.neume.id ?? null;
  if (selection.kind === 'neume')
    return findNeume(document, selection.neumeId)?.neume.id ?? null;
  if (
    selection.kind === 'neume-range' &&
    resolveNeumeRange(document, selection)
  )
    return selection.anchorNeumeId;
  return null;
}

export function extendSelection(
  document: ChantDocument,
  selection: EditorSelection,
  noteId: string,
): EditorSelection {
  if (
    selection.kind === 'neume-range' &&
    !resolveNeumeRange(document, selection)
  )
    return selection;
  const target = findNote(document, noteId)?.neume.id;
  if (!target) return selection;
  const anchor = selectionNeumeId(document, selection) ?? target;
  if (anchor === target) return selectNeume(anchor);
  return {
    kind: 'neume-range',
    anchorNeumeId: anchor,
    endpointNeumeId: target,
  };
}

export function stepSelection(
  document: ChantDocument,
  selection: EditorSelection,
  noteId: string,
  direction: -1 | 1,
) {
  if (
    !findNote(document, noteId) ||
    (selection.kind === 'neume-range' &&
      !resolveNeumeRange(document, selection))
  )
    return null;
  const anchor =
    selectionNeumeId(document, selection) ??
    findNote(document, noteId)?.neume.id;
  const endpoint =
    selection.kind === 'neume-range' ? selection.endpointNeumeId : anchor;
  const index = document.neumes.findIndex((n) => n.id === endpoint);
  if (index < 0 || !anchor) return null;
  const next = Math.max(
    0,
    Math.min(document.neumes.length - 1, index + direction),
  );
  if (
    next === index &&
    (selection.kind === 'neume-range' || selection.kind === 'neume')
  )
    return null;
  const target = document.neumes[next];
  return {
    selection: extendSelection(
      document,
      { kind: 'neume', neumeId: anchor },
      target.notes[0].id,
    ),
    focusNoteId: next === index ? undefined : target.notes[0].id,
  };
}
