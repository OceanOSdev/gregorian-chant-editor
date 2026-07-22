import {
  staffPosition,
  type ChantDocument,
} from '../domain/chant-document'

export type StaffPositionDelta = -1 | 1

export function moveNoteVertically(
  document: ChantDocument,
  noteId: string,
  delta: StaffPositionDelta,
): ChantDocument {
  return {
    ...document,
    notes: document.notes.map((note) => {
      if (note.id !== noteId) {
        return note
      }

      return {
        ...note,
        staffPosition: staffPosition(note.staffPosition + delta),
      }
    }),
  }
}
