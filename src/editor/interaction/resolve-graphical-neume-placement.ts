import { resolveSyllableNeumeInsertionIndex } from '../commands/resolve-syllable-neume-insertion'
import type {
  ChantDocument,
  StaffPosition,
} from '../domain/chant-document'
import {
  getSingleSystemNeumePlacement,
  type GraphicalNeumeKind,
} from '../layout/layout-chant'

export interface ResolvedGraphicalNeumePlacement {
  kind: GraphicalNeumeKind
  staffPositions:
    | readonly [StaffPosition]
    | readonly [StaffPosition, StaffPosition]
  insertionIndex: number
}

export function resolveGraphicalNeumePlacement(
  document: ChantDocument,
  activeSyllableId: string | null,
  kind: GraphicalNeumeKind,
  point: { x: number; y: number },
): ResolvedGraphicalNeumePlacement | null {
  if (
    !activeSyllableId ||
    !document.syllables.some(
      (syllable) => syllable.id === activeSyllableId,
    )
  ) {
    return null
  }

  const placement = getSingleSystemNeumePlacement(
    point,
    kind,
    document.neumes,
  )

  if (!placement) {
    return null
  }

  const insertionIndex = resolveSyllableNeumeInsertionIndex(
    document,
    activeSyllableId,
    placement.preferredNeumeInsertionIndex,
  )

  if (insertionIndex === null) {
    return null
  }

  return {
    kind,
    staffPositions: placement.staffPositions,
    insertionIndex,
  }
}
