import type {
  ChantDocument,
  PodatusNeume,
} from '../domain/chant-document'
import { isValidNeume } from '../domain/neume'

export function insertPodatus(
  document: ChantDocument,
  podatus: PodatusNeume,
  insertionIndex: number,
): ChantDocument {
  const [lowerNote, upperNote] = podatus.notes
  const hasDuplicateId =
    lowerNote.id === upperNote.id ||
    document.neumes.some(
      (neume) =>
        neume.id === podatus.id ||
        neume.notes.some(
          (note) => note.id === lowerNote.id || note.id === upperNote.id,
        ),
    )
  const hasSyllable = document.syllables.some(
    (syllable) => syllable.id === podatus.lyricSyllableId,
  )

  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > document.neumes.length ||
    !hasSyllable ||
    hasDuplicateId ||
    !isValidNeume(podatus)
  ) {
    return document
  }

  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      podatus,
      ...document.neumes.slice(insertionIndex),
    ],
  }
}
