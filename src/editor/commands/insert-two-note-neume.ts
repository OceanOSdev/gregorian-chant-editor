import type {
  ChantDocument,
  ClivisNeume,
  PodatusNeume,
} from '../domain/chant-document'
import { isValidNeume } from '../domain/neume'

export type TwoNoteNeume = PodatusNeume | ClivisNeume

export function insertTwoNoteNeume(
  document: ChantDocument,
  neume: TwoNoteNeume,
  insertionIndex: number,
): ChantDocument {
  const [firstNote, secondNote] = neume.notes
  const hasDuplicateId =
    firstNote.id === secondNote.id ||
    document.neumes.some(
      (existingNeume) =>
        existingNeume.id === neume.id ||
        existingNeume.notes.some(
          (note) => note.id === firstNote.id || note.id === secondNote.id,
        ),
    )
  const hasSyllable = document.syllables.some(
    (syllable) => syllable.id === neume.lyricSyllableId,
  )

  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document.neumes.length ||
    !hasSyllable ||
    hasDuplicateId ||
    !isValidNeume(neume)
  ) {
    return document
  }

  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      neume,
      ...document.neumes.slice(insertionIndex),
    ],
  }
}
