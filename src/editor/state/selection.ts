import type { ChantDocument } from '../domain/chant-document'
import { findNeume, findNote } from '../domain/neume'

export type EditorSelection =
  | { kind: 'none' }
  | { kind: 'note'; noteId: string }
  | { kind: 'neume'; neumeId: string }

export function clearSelection(): EditorSelection {
  return { kind: 'none' }
}

export function selectNote(noteId: string): EditorSelection {
  return { kind: 'note', noteId }
}

export function selectNeume(neumeId: string): EditorSelection {
  return { kind: 'neume', neumeId }
}

export function reconcileSelection(
  document: ChantDocument,
  selection: EditorSelection,
): EditorSelection {
  if (selection.kind === 'none') {
    return selection
  }

  const selectionExists =
    selection.kind === 'note'
      ? findNote(document, selection.noteId)
      : findNeume(document, selection.neumeId)

  return selectionExists ? selection : clearSelection()
}

export function resolveSelectionSyllableId(
  document: ChantDocument,
  selection: EditorSelection,
): string | null {
  if (selection.kind === 'note') {
    return findNote(document, selection.noteId)?.neume.lyricSyllableId ?? null
  }

  if (selection.kind === 'neume') {
    return (
      findNeume(document, selection.neumeId)?.neume.lyricSyllableId ?? null
    )
  }

  return null
}
