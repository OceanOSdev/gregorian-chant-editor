import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
} from '../domain/chant-document'
import { layoutChant, type PunctumLayout } from './layout-chant'

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
})
