import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type PunctumNeume,
} from '../domain/chant-document'
import {
  layoutChant,
  singleSystemNoteCapacity,
  type GraphicalNeumeKind,
} from '../layout/layout-chant'
import { resolveGraphicalNeumePlacement } from './resolve-graphical-neume-placement'

function punctum(id: string, lyricSyllableId: string): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId,
    notes: [{ id, staffPosition: staffPosition(2) }],
  }
}

function twoNoteNeume(kind: 'podatus' | 'clivis', id: string): Neume {
  return {
    id: `neume-${id}`,
    kind,
    lyricSyllableId: 'syllable-2',
    notes: kind === 'podatus'
      ? [
          { id: `${id}-1`, staffPosition: staffPosition(2) },
          { id: `${id}-2`, staffPosition: staffPosition(3) },
        ]
      : [
          { id: `${id}-1`, staffPosition: staffPosition(3) },
          { id: `${id}-2`, staffPosition: staffPosition(2) },
        ],
  }
}

function scandicus(id: string, lyricSyllableId = 'syllable-2'): Neume {
  return {
    id: `neume-${id}`,
    kind: 'scandicus',
    lyricSyllableId,
    notes: [
      { id: `${id}-1`, staffPosition: staffPosition(2) },
      { id: `${id}-2`, staffPosition: staffPosition(3) },
      { id: `${id}-3`, staffPosition: staffPosition(4) },
    ],
  }
}

function createDocument(neumes: Neume[] = []): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-empty-first', text: '' },
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'syllable-empty-middle', text: '' },
      { id: 'syllable-2', text: 'ri-' },
      { id: 'syllable-empty-final', text: '' },
    ],
    neumes,
  }
}

function geometry(document: ChantDocument) {
  const layout = layoutChant(document)
  const bottomStaffY = Math.max(...layout.staffLines.map((line) => line.y))
  const firstStaffLine = layout.staffLines[0]

  if (!firstStaffLine) {
    throw new Error('Missing staff geometry')
  }

  return {
    bottomStaffY,
    staffStartX: firstStaffLine.x1,
    staffEndX: firstStaffLine.x2,
  }
}

function resolveAt(
  document: ChantDocument,
  activeSyllableId: string | null,
  kind: GraphicalNeumeKind,
  x: number,
) {
  const { bottomStaffY } = geometry(document)

  return resolveGraphicalNeumePlacement(
    document,
    activeSyllableId,
    kind,
    { x, y: bottomStaffY - 24 },
  )
}

describe('resolveGraphicalNeumePlacement', () => {
  it.each([
    { kind: 'punctum' as const, staffPositions: [2] },
    { kind: 'podatus' as const, staffPositions: [2, 3] },
    { kind: 'clivis' as const, staffPositions: [2, 1] },
    { kind: 'scandicus' as const, staffPositions: [2, 3, 4] },
  ])('returns the complete $kind pitch tuple', ({ kind, staffPositions }) => {
    const document = createDocument()
    const { staffStartX } = geometry(document)

    expect(
      resolveAt(document, 'syllable-empty-first', kind, staffStartX),
    ).toMatchObject({ kind, staffPositions, insertionIndex: 0 })
  })

  it('rejects missing and unknown active syllables', () => {
    const document = createDocument()
    const { staffStartX } = geometry(document)

    expect(resolveAt(document, null, 'punctum', staffStartX)).toBeNull()
    expect(resolveAt(document, 'unknown', 'punctum', staffStartX)).toBeNull()
  })

  it('clamps preferred boundaries into the active syllable group', () => {
    const document = createDocument([
      punctum('first', 'syllable-1'),
      punctum('second', 'syllable-2'),
      punctum('third', 'syllable-2'),
    ])
    const { staffStartX, staffEndX } = geometry(document)

    expect(
      resolveAt(document, 'syllable-2', 'punctum', staffStartX)
        ?.insertionIndex,
    ).toBe(1)
    expect(
      resolveAt(document, 'syllable-1', 'punctum', staffEndX)
        ?.insertionIndex,
    ).toBe(1)
  })

  it('resolves empty first, middle, and final syllables in order', () => {
    const document = createDocument([
      punctum('first', 'syllable-1'),
      punctum('second', 'syllable-2'),
    ])
    const { staffEndX } = geometry(document)

    expect(
      resolveAt(document, 'syllable-empty-first', 'punctum', staffEndX)
        ?.insertionIndex,
    ).toBe(0)
    expect(
      resolveAt(document, 'syllable-empty-middle', 'punctum', staffEndX)
        ?.insertionIndex,
    ).toBe(1)
    expect(
      resolveAt(document, 'syllable-empty-final', 'punctum', staffEndX)
        ?.insertionIndex,
    ).toBe(2)
  })

  it('invalidates and restores the same stationary point with capacity', () => {
    const available = createDocument(
      Array.from(
        { length: singleSystemNoteCapacity - 2 },
        (_, index) => punctum(`note-${index}`, 'syllable-1'),
      ),
    )
    const full = {
      ...available,
      neumes: [
        ...available.neumes,
        punctum('last-1', 'syllable-1'),
        punctum('last-2', 'syllable-1'),
      ],
    }
    const pointX = geometry(available).staffStartX

    expect(
      resolveAt(available, 'syllable-1', 'podatus', pointX),
    ).not.toBeNull()
    expect(resolveAt(full, 'syllable-1', 'podatus', pointX)).toBeNull()
    expect(
      resolveAt(available, 'syllable-1', 'podatus', pointX),
    ).not.toBeNull()
  })

  it('independently enforces three-unit Scandicus capacity', () => {
    const withThreeRemaining = createDocument(
      Array.from(
        { length: singleSystemNoteCapacity - 3 },
        (_, index) => punctum(`note-${index}`, 'syllable-1'),
      ),
    )
    const withTwoRemaining = {
      ...withThreeRemaining,
      neumes: [
        ...withThreeRemaining.neumes,
        punctum('leaves-two', 'syllable-1'),
      ],
    }
    const pointX = geometry(withThreeRemaining).staffStartX

    expect(
      resolveAt(
        withThreeRemaining,
        'syllable-1',
        'scandicus',
        pointX,
      ),
    ).not.toBeNull()
    expect(
      resolveAt(withTwoRemaining, 'syllable-1', 'scandicus', pointX),
    ).toBeNull()
    expect(
      resolveAt(withTwoRemaining, 'syllable-1', 'podatus', pointX),
    ).not.toBeNull()
    expect(
      resolveAt(withTwoRemaining, 'syllable-1', 'clivis', pointX),
    ).not.toBeNull()
  })

  it.each([
    { kind: 'podatus' as const },
    { kind: 'clivis' as const },
  ])(
    'never resolves a boundary inside an existing $kind',
    ({ kind }) => {
      const existing = twoNoteNeume(kind, kind)
      const document = createDocument([
        punctum('before', 'syllable-1'),
        existing,
        punctum('after', 'syllable-2'),
      ])
      const existingLayout = layoutChant(document).neumes[1]
      const first = existingLayout?.notes[0]
      const second = existingLayout?.notes[1]

      if (!first || !second) {
        throw new Error('Missing two-note geometry')
      }

      const firstCenter = first.x + first.width / 2
      const secondCenter = second.x + second.width / 2
      const resolvedIndexes = [
        resolveAt(document, 'syllable-2', 'punctum', firstCenter)
          ?.insertionIndex,
        resolveAt(document, 'syllable-2', 'punctum', secondCenter)
          ?.insertionIndex,
      ]

      expect(resolvedIndexes.every((index) => index === 1 || index === 2))
        .toBe(true)
    },
  )

  it('constrains Scandicus as one whole neume in a populated syllable', () => {
    const document = createDocument([
      punctum('first', 'syllable-1'),
      scandicus('existing'),
      punctum('last', 'syllable-2'),
    ])
    const existingLayout = layoutChant(document).neumes[1]
    const middle = existingLayout?.notes[1]

    if (!middle) {
      throw new Error('Missing Scandicus middle note')
    }

    const middleCenter = middle.x + middle.width / 2

    expect(
      resolveAt(document, 'syllable-2', 'scandicus', middleCenter),
    ).toMatchObject({
      kind: 'scandicus',
      staffPositions: [2, 3, 4],
      insertionIndex: 1,
    })
  })

  it('recomputes kind, tuple, and active-syllable constraint for one point', () => {
    const document = createDocument([
      punctum('first', 'syllable-1'),
      punctum('second', 'syllable-2'),
    ])
    const { staffEndX } = geometry(document)

    expect(resolveAt(document, 'syllable-1', 'punctum', staffEndX))
      .toMatchObject({ staffPositions: [2], insertionIndex: 1 })
    expect(resolveAt(document, 'syllable-2', 'clivis', staffEndX))
      .toMatchObject({ staffPositions: [2, 1], insertionIndex: 2 })
    expect(resolveAt(document, 'syllable-2', 'scandicus', staffEndX))
      .toMatchObject({ staffPositions: [2, 3, 4], insertionIndex: 2 })
  })
})
