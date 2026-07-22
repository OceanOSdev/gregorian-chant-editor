import type { ChantDocument } from '../domain/chant-document'

export function deleteNote(
  document: ChantDocument,
  noteId: string,
): ChantDocument {
  if (!document.notes.some((note) => note.id === noteId)) {
    return document
  }

  return {
    ...document,
    notes: document.notes.filter((note) => note.id !== noteId),
  }
}
