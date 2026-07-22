export type EditorSelection =
  | { kind: 'none' }
  | { kind: 'note'; noteId: string }

export function clearSelection(): EditorSelection {
  return { kind: 'none' }
}

export function selectNote(noteId: string): EditorSelection {
  return { kind: 'note', noteId }
}
