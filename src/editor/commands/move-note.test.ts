import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type ClivisNeume,
  type PodatusNeume,
  type PunctumNeume,
} from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import { moveNoteVertically, type StaffPositionDelta } from './move-note'

const punctum: PunctumNeume = {
  id: 'neume-punctum',
  kind: 'punctum',
  lyricSyllableId: 'syllable-1',
  notes: [{ id: 'note-punctum', staffPosition: staffPosition(3) }],
}
const podatus: PodatusNeume = {
  id: 'neume-podatus',
  kind: 'podatus',
  lyricSyllableId: 'syllable-1',
  notes: [
    { id: 'note-podatus-1', staffPosition: staffPosition(2) },
    { id: 'note-podatus-2', staffPosition: staffPosition(4) },
  ],
}
const clivis: ClivisNeume = {
  id: 'neume-clivis',
  kind: 'clivis',
  lyricSyllableId: 'syllable-1',
  notes: [
    { id: 'note-clivis-1', staffPosition: staffPosition(5) },
    { id: 'note-clivis-2', staffPosition: staffPosition(3) },
  ],
}

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes: [punctum, podatus, clivis],
  }
}

function noteCenterY(document: ChantDocument, noteId: string) {
  const note = layoutChant(document).neumes
    .flatMap((neume) => neume.notes)
    .find((candidate) => candidate.noteId === noteId)

  if (!note) {
    throw new Error(`Missing layout for ${noteId}`)
  }

  return note.y + note.height / 2
}

describe('moveNoteVertically', () => {
  it.each([
    { delta: 1 as StaffPositionDelta, expected: 4 },
    { delta: -1 as StaffPositionDelta, expected: 2 },
  ])('moves a punctum freely by one staff position', ({ delta, expected }) => {
    const moved = moveNoteVertically(createDocument(), 'note-punctum', delta)

    expect(moved.neumes[0]?.notes[0]?.staffPosition).toBe(expected)
  })

  it('updates only the targeted note and owning neume', () => {
    const document = createDocument()
    const moved = moveNoteVertically(document, 'note-podatus-2', 1)

    expect(moved.neumes[0]).toBe(document.neumes[0])
    expect(moved.neumes[2]).toBe(document.neumes[2])
    expect(moved.neumes[1]).not.toBe(document.neumes[1])
    expect(moved.neumes[1]?.notes[0]).toBe(document.neumes[1]?.notes[0])
    expect(moved.neumes[1]?.notes[1]).not.toBe(document.neumes[1]?.notes[1])
  })

  it('accepts valid movement inside podatus and clivis neumes', () => {
    expect(
      moveNoteVertically(createDocument(), 'note-podatus-2', 1)
        .neumes[1]?.notes[1]?.staffPosition,
    ).toBe(5)
    expect(
      moveNoteVertically(createDocument(), 'note-clivis-2', -1)
        .neumes[2]?.notes[1]?.staffPosition,
    ).toBe(2)
  })

  it('rejects equal-pitch and reversed movements with the original document', () => {
    const document = createDocument()
    const nearPodatus: ChantDocument = {
      ...document,
      neumes: [
        {
          ...podatus,
          notes: [
            podatus.notes[0],
            { ...podatus.notes[1], staffPosition: staffPosition(3) },
          ],
        },
      ],
    }

    expect(
      moveNoteVertically(nearPodatus, 'note-podatus-2', -1),
    ).toBe(nearPodatus)
    expect(
      moveNoteVertically(nearPodatus, 'note-podatus-1', 1),
    ).toBe(nearPodatus)
  })

  it('returns the original document for an unknown note', () => {
    const document = createDocument()

    expect(moveNoteVertically(document, 'unknown', 1)).toBe(document)
  })

  it('preserves the existing rendered vertical movement', () => {
    const document = createDocument()
    const moved = moveNoteVertically(document, 'note-punctum', 1)
    const staffLineDistance = Math.abs(
      layoutChant(document).staffLines[0]?.y -
        layoutChant(document).staffLines[1]?.y,
    )

    expect(
      noteCenterY(document, 'note-punctum') -
        noteCenterY(moved, 'note-punctum'),
    ).toBe(staffLineDistance / 2)
  })
})
