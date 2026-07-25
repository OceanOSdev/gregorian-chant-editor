import type { ChantDocument } from '../domain/chant-document'

export function resolveSyllableNeumeInsertionIndex(
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

  const associatedNeumeIndexes = document.neumes.flatMap((neume, index) =>
    neume.lyricSyllableId === syllableId ? [index] : [],
  )
  const firstNeumeIndex = associatedNeumeIndexes[0]
  const lastNeumeIndex = associatedNeumeIndexes.at(-1)

  if (firstNeumeIndex !== undefined && lastNeumeIndex !== undefined) {
    return Math.min(
      lastNeumeIndex + 1,
      Math.max(firstNeumeIndex, preferredIndex),
    )
  }

  const followingGroupIndex = document.neumes.findIndex((neume) => {
    const neumeSyllableIndex = document.syllables.findIndex(
      (syllable) => syllable.id === neume.lyricSyllableId,
    )

    return neumeSyllableIndex > syllableIndex
  })

  return followingGroupIndex < 0
    ? document.neumes.length
    : followingGroupIndex
}
