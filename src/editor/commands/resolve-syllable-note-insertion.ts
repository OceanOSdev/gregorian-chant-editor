import type { ChantDocument } from '../domain/chant-document'

export function resolveSyllableNoteInsertionIndex(
  document: ChantDocument,
  syllableId: string,
  preferredIndex: number,
): number | null {
  const syllableIndex = document.syllables.findIndex(
    (syllable) => syllable.id === syllableId,
  )

  if (syllableIndex < 0) {
    return null
  }

  const associatedNoteIndexes = document.notes.flatMap((note, index) =>
    note.lyricSyllableId === syllableId ? [index] : [],
  )
  const firstNoteIndex = associatedNoteIndexes[0]
  const lastNoteIndex = associatedNoteIndexes.at(-1)

  if (firstNoteIndex !== undefined && lastNoteIndex !== undefined) {
    return Math.min(
      lastNoteIndex + 1,
      Math.max(firstNoteIndex, preferredIndex),
    )
  }

  const followingGroupIndex = document.notes.findIndex((note) => {
    const noteSyllableIndex = document.syllables.findIndex(
      (syllable) => syllable.id === note.lyricSyllableId,
    )

    return noteSyllableIndex > syllableIndex
  })

  return followingGroupIndex < 0 ? document.notes.length : followingGroupIndex
}
