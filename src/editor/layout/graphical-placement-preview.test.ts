import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type StaffPosition,
} from '../domain/chant-document'
import {
  getNeumeBoundaryCenterX,
  layoutChant,
  layoutGraphicalPlacementPreview,
  type GraphicalNeumeKind,
  type GraphicalStaffPositions,
} from './layout-chant'

function punctum(id: string, position = 2): Neume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id, staffPosition: staffPosition(position) }],
  }
}

function existingTwoNote(kind: 'podatus' | 'clivis', id: string): Neume {
  const positions = kind === 'podatus' ? [2, 3] : [3, 2]

  return {
    id: `neume-${id}`,
    kind,
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: `${id}-1`, staffPosition: staffPosition(positions[0]) },
      { id: `${id}-2`, staffPosition: staffPosition(positions[1]) },
    ],
  }
}

function documentWith(neumes: Neume[]): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes,
  }
}

function hypotheticalNeume(
  kind: GraphicalNeumeKind,
  positions: GraphicalStaffPositions,
): Neume {
  const [first, second] = positions

  if (kind === 'punctum') {
    return {
      id: 'inserted-neume',
      kind,
      lyricSyllableId: 'syllable-1',
      notes: [{ id: 'inserted-1', staffPosition: first }],
    }
  }

  if (second === undefined) {
    throw new Error('Missing second position')
  }

  return {
    id: 'inserted-neume',
    kind,
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: 'inserted-1', staffPosition: first },
      { id: 'inserted-2', staffPosition: second },
    ],
  }
}

function expectPreviewMatchesCommitted(
  existing: Neume[],
  insertionIndex: number,
  kind: GraphicalNeumeKind,
  positions: GraphicalStaffPositions,
) {
  const preview = layoutGraphicalPlacementPreview(existing, {
    kind,
    staffPositions: positions,
    insertionIndex,
  })
  const inserted = hypotheticalNeume(kind, positions)
  const committed = layoutChant(
    documentWith([
      ...existing.slice(0, insertionIndex),
      inserted,
      ...existing.slice(insertionIndex),
    ]),
  ).neumes[insertionIndex]

  expect(preview?.notes).toEqual(
    committed?.notes.map(({ noteId: _noteId, ...geometry }) => geometry),
  )
  expect(preview?.connector).toEqual(committed?.connector)
}

describe('graphical placement preview layout', () => {
  it.each([
    {
      name: 'beginning',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 0,
    },
    {
      name: 'middle',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 1,
    },
    {
      name: 'final',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 2,
    },
    {
      name: 'empty document',
      existing: [],
      insertionIndex: 0,
    },
  ])(
    'matches committed Punctum geometry at the $name boundary',
    ({ existing, insertionIndex }) => {
      expectPreviewMatchesCommitted(
        existing,
        insertionIndex,
        'punctum',
        [staffPosition(4)],
      )
    },
  )

  it.each([
    {
      kind: 'podatus' as const,
      positions: [staffPosition(2), staffPosition(4)] as const,
    },
    {
      kind: 'clivis' as const,
      positions: [staffPosition(5), staffPosition(3)] as const,
    },
  ])(
    'matches committed $kind note and connector geometry',
    ({ kind, positions }) => {
      expectPreviewMatchesCommitted(
        [punctum('before'), punctum('after')],
        1,
        kind,
        positions,
      )

      const preview = layoutGraphicalPlacementPreview(
        [punctum('before')],
        {
          kind,
          staffPositions: positions,
          insertionIndex: 1,
        },
      )
      const first = preview?.notes[0]
      const second = preview?.notes[1]

      if (!first || !second) {
        throw new Error('Missing preview notes')
      }

      expect(second.x - first.x).toBe(12)
    },
  )

  it('uses only whole-neume boundary centers around compact neumes', () => {
    const neumes = [
      existingTwoNote('podatus', 'podatus'),
      existingTwoNote('clivis', 'clivis'),
    ]
    const layout = layoutChant(documentWith(neumes))

    expect(getNeumeBoundaryCenterX(neumes, 0)).toBe(
      layout.neumes[0]?.notes[0]?.x + 7.5,
    )
    expect(getNeumeBoundaryCenterX(neumes, 1)).toBe(
      layout.neumes[1]?.notes[0]?.x + 7.5,
    )
    expect(getNeumeBoundaryCenterX(neumes, 2)).toBeGreaterThan(
      layout.neumes[1]?.notes[1]?.x ?? 0,
    )
  })

  it('contains geometry and kind only, without semantic or UI identity', () => {
    const preview = layoutGraphicalPlacementPreview([], {
      kind: 'podatus',
      staffPositions: [staffPosition(2), staffPosition(3)],
      insertionIndex: 0,
    })

    if (!preview) {
      throw new Error('Missing preview')
    }

    const forbiddenKeys = [
      'id',
      'noteId',
      'neumeId',
      'lyricSyllableId',
      'selection',
      'selected',
      'focus',
      'focused',
    ]
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        expect(forbiddenKeys).not.toContain(key)
        visit(nestedValue)
      }
    }

    visit(preview)
  })

  it('rejects non-boundary indexes', () => {
    expect(
      layoutGraphicalPlacementPreview([punctum('one')], {
        kind: 'punctum',
        staffPositions: [staffPosition(2)],
        insertionIndex: 2,
      }),
    ).toBeNull()
  })

  it('preserves exact staff-position y geometry off the staff', () => {
    const positions: readonly [StaffPosition, StaffPosition] = [
      staffPosition(7),
      staffPosition(8),
    ]

    expectPreviewMatchesCommitted([], 0, 'podatus', positions)
  })
})
