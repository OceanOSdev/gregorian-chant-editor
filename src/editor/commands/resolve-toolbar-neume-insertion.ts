import {
  type ChantDocument,
  type StaffPosition,
} from '../domain/chant-document'
import { findNote } from '../domain/neume'
import { resolveSyllableNeumeInsertionIndex } from './resolve-syllable-neume-insertion'

export interface ToolbarNeumeInsertion {
  insertionIndex: number
  referenceStaffPosition: StaffPosition
}

export function resolveToolbarNeumeInsertion(
  document: ChantDocument,
  activeSyllableId: string,
  selectedNoteId: string | null,
  emptySyllableFallback: StaffPosition,
): ToolbarNeumeInsertion | null {
  const activeSyllable = document.syllables.find(
    (syllable) => syllable.id === activeSyllableId,
  )

  if (!activeSyllable) {
    return null
  }

  const selectedNote = selectedNoteId
    ? findNote(document, selectedNoteId)
    : null
  const selectedActiveNote =
    selectedNote?.neume.lyricSyllableId === activeSyllable.id
      ? selectedNote
      : null
  const activeNeumeIndexes = document.neumes.flatMap((neume, index) =>
    neume.lyricSyllableId === activeSyllable.id ? [index] : [],
  )
  const finalActiveNeumeIndex = activeNeumeIndexes.at(-1)
  const preferredIndex = selectedActiveNote
    ? selectedActiveNote.neumeIndex + 1
    : (finalActiveNeumeIndex ?? document.neumes.length) + 1
  const insertionIndex = resolveSyllableNeumeInsertionIndex(
    document,
    activeSyllable.id,
    preferredIndex,
  )

  if (insertionIndex === null) {
    return null
  }

  const finalActiveNote =
    finalActiveNeumeIndex === undefined
      ? undefined
      : document.neumes[finalActiveNeumeIndex]?.notes.at(-1)

  return {
    insertionIndex,
    referenceStaffPosition:
      selectedActiveNote?.note.staffPosition ??
      finalActiveNote?.staffPosition ??
      emptySyllableFallback,
  }
}
