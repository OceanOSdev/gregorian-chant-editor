import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
} from '../domain/chant-document'
import {
  canInsertPunctumInSingleSystem,
  layoutChant,
  singleSystemNoteCapacity,
  type PunctumLayout,
} from './layout-chant'

function createDocument(positions: number[]): ChantDocument {
  return {
    title: 'Test chant',
    clef: {
      type: 'c',
      staffLine: 3,
    },
    syllables: [
      {
        id: 'syllable-1',
        text: 'Ky-',
      },
    ],
    notes: positions.map((position, index) => ({
      id: `note-${index + 1}`,
      kind: 'punctum',
      staffPosition: staffPosition(position),
      lyricSyllableId: 'syllable-1',
    })),
  }
}

function noteCenterY(note: PunctumLayout) {
  return note.y + note.height / 2
}

function noteCenterX(note: PunctumLayout) {
  return note.x + note.width / 2
}

describe('layoutChant', () => {
  it('produces exactly four staff lines', () => {
    const layout = layoutChant(createDocument([0]))

    expect(layout.staffLines).toHaveLength(4)
  })

  it('places staff position 0 on the bottom staff line', () => {
    const layout = layoutChant(createDocument([0]))
    const note = layout.notes[0]
    const bottomStaffLineY = Math.max(
      ...layout.staffLines.map((line) => line.y),
    )

    expect(note).toBeDefined()
    if (!note) {
      return
    }

    expect(noteCenterY(note)).toBe(bottomStaffLineY)
  })

  it('moves a note upward by half a staff-line interval per position', () => {
    const layout = layoutChant(createDocument([0, 1]))
    const lowerNote = layout.notes[0]
    const upperNote = layout.notes[1]
    const staffLineYs = layout.staffLines
      .map((line) => line.y)
      .sort((first, second) => first - second)
    const firstStaffLineY = staffLineYs[0]
    const secondStaffLineY = staffLineYs[1]

    expect(lowerNote).toBeDefined()
    expect(upperNote).toBeDefined()
    expect(firstStaffLineY).toBeDefined()
    expect(secondStaffLineY).toBeDefined()
    if (
      !lowerNote ||
      !upperNote ||
      firstStaffLineY === undefined ||
      secondStaffLineY === undefined
    ) {
      return
    }

    const staffLineDistance = secondStaffLineY - firstStaffLineY
    const upwardMovement = noteCenterY(lowerNote) - noteCenterY(upperNote)

    expect(upwardMovement).toBe(staffLineDistance / 2)
  })

  it('produces one lyric layout for notes linked to the same syllable', () => {
    const layout = layoutChant(createDocument([0, 1, 2]))

    expect(layout.lyrics).toHaveLength(1)
    expect(layout.lyrics[0]?.syllableId).toBe('syllable-1')
  })

  it('centers a lyric between its first and last associated note centers', () => {
    const layout = layoutChant(createDocument([0, 1, 2]))
    const firstNote = layout.notes[0]
    const lastNote = layout.notes.at(-1)
    const lyric = layout.lyrics[0]

    expect(firstNote).toBeDefined()
    expect(lastNote).toBeDefined()
    expect(lyric).toBeDefined()
    if (!firstNote || !lastNote || !lyric) {
      return
    }

    const associatedNotesMidpoint =
      (noteCenterX(firstNote) + noteCenterX(lastNote)) / 2

    expect(lyric.x).toBe(associatedNotesMidpoint)
  })

  it('renders associated syllables once and omits syllables without notes', () => {
    const document: ChantDocument = {
      ...createDocument([]),
      syllables: [
        { id: 'syllable-1', text: 'Ky-' },
        { id: 'syllable-2', text: '' },
        { id: 'syllable-3', text: 'ri-' },
      ],
      notes: [
        {
          id: 'note-1',
          kind: 'punctum',
          staffPosition: staffPosition(2),
          lyricSyllableId: 'syllable-1',
        },
        {
          id: 'note-2',
          kind: 'punctum',
          staffPosition: staffPosition(3),
          lyricSyllableId: 'syllable-1',
        },
        {
          id: 'note-3',
          kind: 'punctum',
          staffPosition: staffPosition(4),
          lyricSyllableId: 'syllable-3',
        },
      ],
    }
    const layout = layoutChant(document)

    expect(layout.lyrics.map((lyric) => lyric.syllableId)).toEqual([
      'syllable-1',
      'syllable-3',
    ])
    expect(
      layout.lyrics.filter((lyric) => lyric.syllableId === 'syllable-1'),
    ).toHaveLength(1)
  })

  it('fits the maximum single-system note count within the staff', () => {
    const layout = layoutChant(
      createDocument(Array.from({ length: singleSystemNoteCapacity }, () => 3)),
    )
    const finalNote = layout.notes.at(-1)
    const staffEndX = layout.staffLines[0]?.x2

    expect(finalNote).toBeDefined()
    expect(staffEndX).toBeDefined()
    if (!finalNote || staffEndX === undefined) {
      return
    }

    expect(finalNote.x + finalNote.width).toBeLessThanOrEqual(staffEndX)
  })

  it('places one note beyond the single-system capacity outside the staff', () => {
    const layout = layoutChant(
      createDocument(
        Array.from({ length: singleSystemNoteCapacity + 1 }, () => 3),
      ),
    )
    const excessNote = layout.notes.at(-1)
    const staffEndX = layout.staffLines[0]?.x2

    expect(excessNote).toBeDefined()
    expect(staffEndX).toBeDefined()
    if (!excessNote || staffEndX === undefined) {
      return
    }

    expect(excessNote.x + excessNote.width).toBeGreaterThan(staffEndX)
  })

  it('reports insertion unavailable at single-system capacity', () => {
    expect(
      canInsertPunctumInSingleSystem(singleSystemNoteCapacity - 1),
    ).toBe(true)
    expect(canInsertPunctumInSingleSystem(singleSystemNoteCapacity)).toBe(
      false,
    )
  })
})
