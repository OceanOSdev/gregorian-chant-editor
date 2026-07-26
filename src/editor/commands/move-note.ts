import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document'
import { findNote, isValidNeume } from '../domain/neume'

export type StaffPositionDelta = -1 | 1

export function moveNoteVertically(
  document: ChantDocument,
  noteId: string,
  delta: StaffPositionDelta,
): ChantDocument {
  const locatedNote = findNote(document, noteId)

  if (!locatedNote) {
    return document
  }

  const movedNote = {
    ...locatedNote.note,
    staffPosition: staffPosition(locatedNote.note.staffPosition + delta),
  }
  let movedNeume: Neume

  // Rebuild the owning kind's fixed tuple before validation so movement never
  // weakens its cardinality or semantic note order.
  switch (locatedNote.neume.kind) {
    case 'punctum':
      movedNeume = {
        ...locatedNote.neume,
        notes: [movedNote],
      }
      break
    case 'podatus':
    case 'clivis': {
      const [firstNote, secondNote] = locatedNote.neume.notes

      movedNeume = {
        ...locatedNote.neume,
        notes:
          locatedNote.noteIndex === 0
            ? [movedNote, secondNote]
            : [firstNote, movedNote],
      }
      break
    }
    case 'scandicus': {
      const [firstNote, secondNote, thirdNote] =
        locatedNote.neume.notes

      movedNeume = {
        ...locatedNote.neume,
        notes:
          locatedNote.noteIndex === 0
            ? [movedNote, secondNote, thirdNote]
            : locatedNote.noteIndex === 1
              ? [firstNote, movedNote, thirdNote]
              : [firstNote, secondNote, movedNote],
      }
      break
    }
  }

  if (!isValidNeume(movedNeume)) {
    return document
  }

  return {
    ...document,
    neumes: document.neumes.map((neume, index) =>
      index === locatedNote.neumeIndex ? movedNeume : neume,
    ),
  }
}
