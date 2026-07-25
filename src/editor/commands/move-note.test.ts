import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type ClivisNeume,
  type PodatusNeume,
  type PunctumNeume,
} from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import {
  applyDocumentEdit,
  createDocumentHistory,
} from '../state/document-history'
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
      moveNoteVertically(createDocument(), 'note-podatus-1', -1)
        .neumes[1]?.notes[0]?.staffPosition,
    ).toBe(1)
    expect(
      moveNoteVertically(createDocument(), 'note-podatus-2', 1)
        .neumes[1]?.notes[1]?.staffPosition,
    ).toBe(5)
    expect(
      moveNoteVertically(createDocument(), 'note-clivis-2', -1)
        .neumes[2]?.notes[1]?.staffPosition,
    ).toBe(2)
  })

  it.each([
    { noteId: 'note-clivis-1', delta: 1 as StaffPositionDelta, expected: 6 },
    { noteId: 'note-clivis-2', delta: -1 as StaffPositionDelta, expected: 2 },
  ])(
    'moves either Clivis constituent when the descending contour remains valid',
    ({ noteId, delta, expected }) => {
      const document = createDocument()
      const moved = moveNoteVertically(document, noteId, delta)
      const movedClivis = moved.neumes[2]
      const originalClivis = document.neumes[2]
      const movedIndex = noteId === 'note-clivis-1' ? 0 : 1
      const otherIndex = movedIndex === 0 ? 1 : 0

      expect(movedClivis?.kind).toBe('clivis')
      expect(movedClivis?.notes[movedIndex]?.staffPosition).toBe(expected)
      expect(movedClivis?.notes[otherIndex]).toBe(
        originalClivis?.notes[otherIndex],
      )
    },
  )

  it.each([
    { noteId: 'note-clivis-1', delta: -1 as StaffPositionDelta },
    { noteId: 'note-clivis-2', delta: 1 as StaffPositionDelta },
  ])(
    'rejects an equal-pitch Clivis move without history for $noteId',
    ({ noteId, delta }) => {
      const document: ChantDocument = {
        ...createDocument(),
        neumes: [
          {
            ...clivis,
            notes: [
              { ...clivis.notes[0], staffPosition: staffPosition(4) },
              clivis.notes[1],
            ],
          },
        ],
      }
      const history = createDocumentHistory(document)
      const rejectedDocument = moveNoteVertically(document, noteId, delta)
      const rejectedHistory = applyDocumentEdit(history, (current) =>
        moveNoteVertically(current, noteId, delta),
      )

      expect(rejectedDocument).toBe(document)
      expect(rejectedHistory).toBe(history)
    },
  )

  it.each([
    { noteId: 'note-clivis-1', delta: -1 as StaffPositionDelta },
    { noteId: 'note-clivis-2', delta: 1 as StaffPositionDelta },
  ])(
    'rejects movement of an already reversed Clivis for $noteId',
    ({ noteId, delta }) => {
      const document: ChantDocument = {
        ...createDocument(),
        neumes: [
          {
            ...clivis,
            notes: [
              { ...clivis.notes[0], staffPosition: staffPosition(2) },
              { ...clivis.notes[1], staffPosition: staffPosition(4) },
            ],
          },
        ],
      }

      expect(moveNoteVertically(document, noteId, delta)).toBe(document)
    },
  )

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

    const reversedLowerMove: ChantDocument = {
      ...document,
      neumes: [
        {
          ...podatus,
          notes: [
            {
              ...podatus.notes[0],
              staffPosition: staffPosition(4),
            },
            {
              ...podatus.notes[1],
              staffPosition: staffPosition(3),
            },
          ],
        },
      ],
    }

    expect(
      moveNoteVertically(reversedLowerMove, 'note-podatus-1', 1),
    ).toBe(reversedLowerMove)
  })

  it('does not create history for a rejected equal-pitch movement', () => {
    const document: ChantDocument = {
      ...createDocument(),
      neumes: [
        {
          ...podatus,
          notes: [
            podatus.notes[0],
            {
              ...podatus.notes[1],
              staffPosition: staffPosition(3),
            },
          ],
        },
      ],
    }
    const history = createDocumentHistory(document)
    const rejected = applyDocumentEdit(history, (current) =>
      moveNoteVertically(current, 'note-podatus-1', 1),
    )

    expect(rejected).toBe(history)
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
