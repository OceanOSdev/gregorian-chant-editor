import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
} from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import {
  moveNoteVertically,
  type StaffPositionDelta,
} from './move-note'

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: {
      type: 'c',
      staffLine: 3,
    },
    syllables: [
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'syllable-2', text: 'ri-' },
    ],
    notes: [
      {
        id: 'note-1',
        kind: 'punctum',
        staffPosition: staffPosition(3),
        lyricSyllableId: 'syllable-1',
      },
      {
        id: 'note-2',
        kind: 'punctum',
        staffPosition: staffPosition(5),
        lyricSyllableId: 'syllable-2',
      },
    ],
  }
}

function noteCenterY(
  layout: ReturnType<typeof layoutChant>,
  noteId: string,
) {
  const note = layout.notes.find((candidate) => candidate.noteId === noteId)

  if (!note) {
    throw new Error(`Missing layout for ${noteId}`)
  }

  return note.y + note.height / 2
}

describe('moveNoteVertically', () => {
  it('moves a note upward by one StaffPosition', () => {
    const movedDocument = moveNoteVertically(createDocument(), 'note-1', 1)

    expect(movedDocument.notes[0]?.staffPosition).toBe(4)
  })

  it('moves a note downward by one StaffPosition', () => {
    const movedDocument = moveNoteVertically(createDocument(), 'note-1', -1)

    expect(movedDocument.notes[0]?.staffPosition).toBe(2)
  })

  it('does not change neighboring notes', () => {
    const document = createDocument()
    const movedDocument = moveNoteVertically(document, 'note-1', 1)

    expect(movedDocument.notes[1]).toBe(document.notes[1])
    expect(movedDocument.notes[1]?.staffPosition).toBe(5)
  })

  it('does not mutate the original document', () => {
    const document = createDocument()
    const originalNote = document.notes[0]
    const movedDocument = moveNoteVertically(document, 'note-1', 1)

    expect(document.notes[0]).toBe(originalNote)
    expect(document.notes[0]?.staffPosition).toBe(3)
    expect(movedDocument).not.toBe(document)
    expect(movedDocument.notes).not.toBe(document.notes)
    expect(movedDocument.notes[0]).not.toBe(originalNote)
  })

  it.each([
    { direction: 'above', delta: 1 as StaffPositionDelta },
    { direction: 'below', delta: -1 as StaffPositionDelta },
  ])(
    'lays out the updated note one staff step $direction its previous position',
    ({ delta }) => {
      const document = createDocument()
      const originalLayout = layoutChant(document)
      const movedLayout = layoutChant(
        moveNoteVertically(document, 'note-1', delta),
      )
      const staffLineDistance = Math.abs(
        originalLayout.staffLines[0]?.y - originalLayout.staffLines[1]?.y,
      )
      const renderedMovement =
        noteCenterY(originalLayout, 'note-1') -
        noteCenterY(movedLayout, 'note-1')

      expect(renderedMovement).toBe((staffLineDistance / 2) * delta)
    },
  )
})
