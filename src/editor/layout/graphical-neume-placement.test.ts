import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type PunctumNeume,
} from '../domain/chant-document'
import {
  getSingleSystemNeumePlacement,
  layoutChant,
  singleSystemNoteCapacity,
  type GraphicalNeumeKind,
} from './layout-chant'

function punctum(id: string): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id, staffPosition: staffPosition(2) }],
  }
}

function podatus(id: string): Neume {
  return {
    id: `neume-${id}`,
    kind: 'podatus',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: `${id}-lower`, staffPosition: staffPosition(2) },
      { id: `${id}-upper`, staffPosition: staffPosition(3) },
    ],
  }
}

function clivis(id: string): Neume {
  return {
    id: `neume-${id}`,
    kind: 'clivis',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: `${id}-upper`, staffPosition: staffPosition(3) },
      { id: `${id}-lower`, staffPosition: staffPosition(2) },
    ],
  }
}

function scandicus(id: string): Neume {
  return {
    id: `neume-${id}`,
    kind: 'scandicus',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: `${id}-first`, staffPosition: staffPosition(2) },
      { id: `${id}-middle`, staffPosition: staffPosition(3) },
      { id: `${id}-final`, staffPosition: staffPosition(4) },
    ],
  }
}

function createDocument(neumes: Neume[]): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes,
  }
}

function placementGeometry(neumes: Neume[] = [
  punctum('note-1'),
  punctum('note-2'),
  punctum('note-3'),
]) {
  const layout = layoutChant(createDocument(neumes))
  const staffYs = layout.staffLines
    .map((line) => line.y)
    .sort((first, second) => first - second)
  const staffStartX = layout.staffLines[0]?.x1
  const staffEndX = layout.staffLines[0]?.x2
  const topStaffY = staffYs[0]
  const nextStaffY = staffYs[1]
  const bottomStaffY = staffYs.at(-1)

  if (
    staffStartX === undefined ||
    staffEndX === undefined ||
    topStaffY === undefined ||
    nextStaffY === undefined ||
    bottomStaffY === undefined
  ) {
    throw new Error('Missing fixed-system geometry')
  }

  return {
    layout,
    staffStartX,
    staffEndX,
    topStaffY,
    bottomStaffY,
    staffStep: (nextStaffY - topStaffY) / 2,
    staffMiddleX: (staffStartX + staffEndX) / 2,
  }
}

function placeAtPosition(
  kind: GraphicalNeumeKind,
  position: number,
  neumes: Neume[] = [],
) {
  const { bottomStaffY, staffMiddleX, staffStep } =
    placementGeometry(neumes)

  return getSingleSystemNeumePlacement(
    {
      x: staffMiddleX,
      y: bottomStaffY - position * staffStep,
    },
    kind,
    neumes,
  )
}

function noteCenterX(note: { x: number; width: number }) {
  return note.x + note.width / 2
}

describe('single-system graphical neume placement', () => {
  it.each([
    { kind: 'punctum' as const, positions: [2] },
    { kind: 'podatus' as const, positions: [2, 3] },
    { kind: 'clivis' as const, positions: [2, 1] },
    { kind: 'scandicus' as const, positions: [2, 3, 4] },
  ])('derives the complete $kind pitch tuple', ({ kind, positions }) => {
    const placement = placeAtPosition(kind, 2)

    expect(placement?.firstStaffPosition).toBe(2)
    expect(placement?.staffPositions).toEqual(positions)
  })

  it('snaps lines, spaces, and vertical halfway ties upward', () => {
    const { bottomStaffY, staffMiddleX, staffStep } = placementGeometry()

    expect(placeAtPosition('punctum', 0)?.staffPositions).toEqual([0])
    expect(placeAtPosition('punctum', 1)?.staffPositions).toEqual([1])
    expect(
      getSingleSystemNeumePlacement(
        {
          x: staffMiddleX,
          y: bottomStaffY - staffStep / 2,
        },
        'punctum',
        [],
      )?.staffPositions,
    ).toEqual([1])
    expect(placeAtPosition('scandicus', 0)?.staffPositions).toEqual([
      0, 1, 2,
    ])
    expect(placeAtPosition('scandicus', 1)?.staffPositions).toEqual([
      1, 2, 3,
    ])
    expect(
      getSingleSystemNeumePlacement(
        {
          x: staffMiddleX,
          y: bottomStaffY - staffStep / 2,
        },
        'scandicus',
        [],
      )?.staffPositions,
    ).toEqual([1, 2, 3])
  })

  it('supports existing first-note off-staff bounds and unbounded derived pitches', () => {
    expect(placeAtPosition('podatus', 7)?.staffPositions).toEqual([7, 8])
    expect(placeAtPosition('clivis', -1)?.staffPositions).toEqual([-1, -2])
    expect(placeAtPosition('scandicus', 7)?.staffPositions).toEqual([
      7, 8, 9,
    ])
    expect(placeAtPosition('scandicus', -1)?.staffPositions).toEqual([
      -1, 0, 1,
    ])
  })

  it('rejects points outside horizontal and vertical placement bounds', () => {
    const {
      bottomStaffY,
      staffEndX,
      staffMiddleX,
      staffStartX,
      staffStep,
      topStaffY,
    } = placementGeometry()

    expect(
      getSingleSystemNeumePlacement(
        { x: staffStartX - 0.1, y: bottomStaffY },
        'punctum',
        [],
      ),
    ).toBeNull()
    expect(
      getSingleSystemNeumePlacement(
        {
          x: staffMiddleX,
          y: topStaffY - staffStep - 0.1,
        },
        'scandicus',
        [],
      ),
    ).toBeNull()
    expect(
      getSingleSystemNeumePlacement(
        {
          x: staffMiddleX,
          y: bottomStaffY + staffStep + 0.1,
        },
        'scandicus',
        [],
      ),
    ).toBeNull()
    expect(
      getSingleSystemNeumePlacement(
        { x: staffEndX + 0.1, y: bottomStaffY },
        'podatus',
        [],
      ),
    ).toBeNull()
    expect(
      getSingleSystemNeumePlacement(
        { x: staffMiddleX, y: bottomStaffY + staffStep + 0.1 },
        'clivis',
        [],
      ),
    ).toBeNull()
    expect(
      getSingleSystemNeumePlacement(
        { x: staffMiddleX, y: topStaffY - staffStep - 0.1 },
        'punctum',
        [],
      ),
    ).toBeNull()
  })

  it('resolves beginning, middle, and end Punctum boundaries unchanged', () => {
    const neumes = [punctum('note-1'), punctum('note-2'), punctum('note-3')]
    const { bottomStaffY, layout, staffEndX } = placementGeometry(neumes)
    const notes = layout.neumes.flatMap((neume) => neume.notes)
    const firstNote = notes[0]
    const secondNote = notes[1]

    if (!firstNote || !secondNote) {
      throw new Error('Missing note layout')
    }

    expect(
      getSingleSystemNeumePlacement(
        { x: noteCenterX(firstNote), y: bottomStaffY },
        'punctum',
        neumes,
      )?.preferredNeumeInsertionIndex,
    ).toBe(0)
    expect(
      getSingleSystemNeumePlacement(
        { x: noteCenterX(secondNote), y: bottomStaffY },
        'punctum',
        neumes,
      )?.preferredNeumeInsertionIndex,
    ).toBe(1)
    expect(
      getSingleSystemNeumePlacement(
        { x: staffEndX, y: bottomStaffY },
        'punctum',
        neumes,
      )?.preferredNeumeInsertionIndex,
    ).toBe(3)
  })

  it.each([
    { existing: podatus('podatus'), name: 'Podatus' },
    { existing: clivis('clivis'), name: 'Clivis' },
  ])(
    'resolves clicks around both $name notes only to whole-neume boundaries',
    ({ existing }) => {
      const neumes = [existing, punctum('following')]
      const { bottomStaffY, layout } = placementGeometry(neumes)
      const notes = layout.neumes[0]?.notes
      const first = notes?.[0]
      const second = notes?.[1]

      if (!first || !second) {
        throw new Error('Missing two-note layout')
      }

      const firstCenter = noteCenterX(first)
      const secondCenter = noteCenterX(second)
      const midpoint = (firstCenter + secondCenter) / 2
      const resolve = (x: number) =>
        getSingleSystemNeumePlacement(
          { x, y: bottomStaffY },
          'podatus',
          neumes,
        )?.preferredNeumeInsertionIndex

      expect(resolve(firstCenter)).toBe(0)
      expect(resolve(midpoint)).toBe(0)
      expect(resolve(midpoint + Number.EPSILON * midpoint)).toBe(1)
      expect(resolve(secondCenter)).toBe(1)
      expect([resolve(firstCenter), resolve(secondCenter)]).not.toContain(
        undefined,
      )
    },
  )

  it('resolves a compact Scandicus only before or after its complete span', () => {
    const existing = scandicus('scandicus')
    const neumes = [existing, punctum('following')]
    const { bottomStaffY, layout } = placementGeometry(neumes)
    const existingLayout = layout.neumes[0]
    const notes = existingLayout?.notes
    const first = notes?.[0]
    const middle = notes?.[1]
    const final = notes?.[2]
    const firstConnector = existingLayout?.connectors[0]
    const secondConnector = existingLayout?.connectors[1]

    if (
      !first ||
      !middle ||
      !final ||
      !firstConnector ||
      !secondConnector
    ) {
      throw new Error('Missing Scandicus geometry')
    }

    const firstCenter = noteCenterX(first)
    const middleCenter = noteCenterX(middle)
    const finalCenter = noteCenterX(final)
    const midpoint = (firstCenter + finalCenter) / 2
    const rightOfMidpoint = midpoint + Number.EPSILON * midpoint
    const resolve = (x: number) =>
      getSingleSystemNeumePlacement(
        { x, y: bottomStaffY },
        'scandicus',
        neumes,
      )?.preferredNeumeInsertionIndex
    const resolvedIndexes = [
      resolve(firstCenter),
      resolve(middleCenter),
      resolve(finalCenter),
      resolve(firstConnector.x),
      resolve(secondConnector.x),
      resolve(midpoint),
      resolve(rightOfMidpoint),
    ]

    expect(rightOfMidpoint).toBeGreaterThan(midpoint)
    expect(resolve(firstCenter)).toBe(0)
    expect(resolve(middleCenter)).toBe(0)
    expect(resolve(midpoint)).toBe(0)
    expect(resolve(rightOfMidpoint)).toBe(1)
    expect(resolve(finalCenter)).toBe(1)
    expect(resolve(firstConnector.x)).toBe(0)
    expect(resolve(secondConnector.x)).toBe(1)
    expect(resolvedIndexes.every((index) => index === 0 || index === 1))
      .toBe(true)
  })

  it('charges one unit for Punctum and two for both two-note kinds', () => {
    const withTwoRemaining = Array.from(
      { length: singleSystemNoteCapacity - 2 },
      (_, index) => punctum(`note-${index}`),
    )
    const withOneRemaining = [
      ...withTwoRemaining,
      punctum('one-more-note'),
    ]

    expect(placeAtPosition('podatus', 2, withTwoRemaining)).not.toBeNull()
    expect(placeAtPosition('clivis', 2, withTwoRemaining)).not.toBeNull()
    expect(placeAtPosition('podatus', 2, withOneRemaining)).toBeNull()
    expect(placeAtPosition('clivis', 2, withOneRemaining)).toBeNull()
    expect(placeAtPosition('punctum', 2, withOneRemaining)).not.toBeNull()
    expect(
      placeAtPosition('punctum', 2, [
        ...withOneRemaining,
        punctum('at-capacity'),
      ]),
    ).toBeNull()
  })

  it('charges three semantic capacity units for Scandicus', () => {
    const withThreeRemaining = Array.from(
      { length: singleSystemNoteCapacity - 3 },
      (_, index) => punctum(`note-${index}`),
    )
    const withTwoRemaining = [
      ...withThreeRemaining,
      punctum('leaves-two'),
    ]
    const withOneRemaining = [
      ...withTwoRemaining,
      punctum('leaves-one'),
    ]
    const full = [...withOneRemaining, punctum('at-capacity')]

    expect(placeAtPosition('scandicus', 2, withThreeRemaining))
      .not.toBeNull()
    expect(placeAtPosition('scandicus', 2, withTwoRemaining)).toBeNull()
    expect(placeAtPosition('podatus', 2, withTwoRemaining)).not.toBeNull()
    expect(placeAtPosition('clivis', 2, withTwoRemaining)).not.toBeNull()
    expect(placeAtPosition('punctum', 2, withOneRemaining)).not.toBeNull()
    expect(placeAtPosition('podatus', 2, withOneRemaining)).toBeNull()
    expect(placeAtPosition('punctum', 2, full)).toBeNull()
    expect(placeAtPosition('scandicus', 2, full)).toBeNull()
  })
})
