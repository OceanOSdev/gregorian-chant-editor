import type {
  ChantDocument,
  ScandicusNeume,
} from '../domain/chant-document'
import { isValidNeume } from '../domain/neume'

export function insertScandicus(
  document: ChantDocument,
  scandicus: ScandicusNeume,
  insertionIndex: number,
): ChantDocument {
  const [firstNote, secondNote, thirdNote] = scandicus.notes
  const candidateNoteIds = [
    firstNote?.id,
    secondNote?.id,
    thirdNote?.id,
  ]
  const hasUniqueCandidateNoteIds =
    candidateNoteIds.every((id) => id !== undefined) &&
    new Set(candidateNoteIds).size === 3
  const hasIdCollision = document.neumes.some(
    (neume) =>
      neume.id === scandicus.id ||
      neume.notes.some((note) => candidateNoteIds.includes(note.id)),
  )
  const hasSyllable = document.syllables.some(
    (syllable) => syllable.id === scandicus.lyricSyllableId,
  )

  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document.neumes.length ||
    !hasSyllable ||
    !hasUniqueCandidateNoteIds ||
    hasIdCollision ||
    !isValidNeume(scandicus)
  ) {
    return document
  }

  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      scandicus,
      ...document.neumes.slice(insertionIndex),
    ],
  }
}
