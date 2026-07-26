import { resolveSyllableNeumeInsertionIndex } from '../commands/resolve-syllable-neume-insertion'
import type {
  ChantDocument,
  StaffPosition,
} from '../domain/chant-document'
import {
  getSingleSystemNeumePlacement,
  type GraphicalNeumeKind,
} from '../layout/layout-chant'

export type ResolvedGraphicalNeumePlacement =
  | {
      kind: 'punctum'
      staffPositions: readonly [StaffPosition]
      insertionIndex: number
    }
  | {
      kind: 'podatus'
      staffPositions: readonly [StaffPosition, StaffPosition]
      insertionIndex: number
    }
  | {
      kind: 'clivis'
      staffPositions: readonly [StaffPosition, StaffPosition]
      insertionIndex: number
    }
  | {
      kind: 'scandicus'
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ]
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

  switch (placement.kind) {
    case 'punctum':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
      }
    case 'podatus':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
      }
    case 'clivis':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
      }
    case 'scandicus':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
      }
  }
}
