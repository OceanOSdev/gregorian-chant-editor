import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
} from '../domain/chant-document'
import { findNeume, isValidNeume } from '../domain/neume'

function moveNote(note: ChantNote, delta: number): ChantNote {
  return {
    ...note,
    staffPosition: staffPosition(note.staffPosition + delta),
  }
}

export function moveNeumeVertically(
  document: ChantDocument,
  neumeId: string,
  delta: number,
): ChantDocument {
  if (!Number.isInteger(delta)) {
    throw new TypeError('Neume movement deltas must be integers')
  }

  if (delta === 0) {
    return document
  }

  const locatedNeume = findNeume(document, neumeId)

  if (!locatedNeume) {
    return document
  }

  let movedNeume: Neume

  switch (locatedNeume.neume.kind) {
    case 'punctum': {
      const [note] = locatedNeume.neume.notes

      movedNeume = {
        ...locatedNeume.neume,
        notes: [moveNote(note, delta)],
      }
      break
    }
    case 'podatus':
    case 'clivis': {
      const [firstNote, secondNote] = locatedNeume.neume.notes

      movedNeume = {
        ...locatedNeume.neume,
        notes: [
          moveNote(firstNote, delta),
          moveNote(secondNote, delta),
        ],
      }
      break
    }
    case 'scandicus': {
      const [firstNote, secondNote, thirdNote] =
        locatedNeume.neume.notes

      movedNeume = {
        ...locatedNeume.neume,
        notes: [
          moveNote(firstNote, delta),
          moveNote(secondNote, delta),
          moveNote(thirdNote, delta),
        ],
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
      index === locatedNeume.neumeIndex ? movedNeume : neume,
    ),
  }
}
