import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type PodatusNeume,
  type PunctumNeume,
} from '../domain/chant-document'
import { countNotes } from '../domain/neume'
import {
  canInsertNotesInSingleSystem,
  canInsertPunctumInSingleSystem,
  singleSystemNoteCapacity,
} from '../layout/layout-chant'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import { insertPodatus } from './insert-podatus'

function punctum(id: string): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id, staffPosition: staffPosition(3) }],
  }
}

function podatus(
  id = 'podatus',
  lowerNoteId = 'lower',
  upperNoteId = 'upper',
): PodatusNeume {
  return {
    id,
    kind: 'podatus',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: lowerNoteId, staffPosition: staffPosition(2) },
      { id: upperNoteId, staffPosition: staffPosition(3) },
    ],
  }
}

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes: [punctum('note-1'), punctum('note-2')],
  }
}

describe('insertPodatus', () => {
  it.each([
    { index: 0, ids: ['inserted', 'neume-note-1', 'neume-note-2'] },
    { index: 1, ids: ['neume-note-1', 'inserted', 'neume-note-2'] },
    { index: 2, ids: ['neume-note-1', 'neume-note-2', 'inserted'] },
  ])('inserts at neume boundary $index', ({ index, ids }) => {
    const inserted = insertPodatus(
      createDocument(),
      podatus('inserted'),
      index,
    )

    expect(inserted.neumes.map((neume) => neume.id)).toEqual(ids)
  })

  it('preserves supplied identities and unrelated references immutably', () => {
    const document = createDocument()
    const insertedPodatus = podatus(
      'stable-neume',
      'stable-lower',
      'stable-upper',
    )
    const inserted = insertPodatus(document, insertedPodatus, 1)

    expect(inserted.neumes[1]).toBe(insertedPodatus)
    expect(inserted.neumes[1]?.notes.map((note) => note.id)).toEqual([
      'stable-lower',
      'stable-upper',
    ])
    expect(inserted.neumes[0]).toBe(document.neumes[0])
    expect(inserted.neumes[2]).toBe(document.neumes[1])
    expect(document.neumes).toHaveLength(2)
  })

  it.each([
    { insertionIndex: -1, candidate: podatus() },
    { insertionIndex: 3, candidate: podatus() },
    {
      insertionIndex: 1,
      candidate: {
        ...podatus(),
        lyricSyllableId: 'unknown',
      },
    },
    {
      insertionIndex: 1,
      candidate: {
        ...podatus(),
        notes: [
          podatus().notes[0],
          {
            ...podatus().notes[1],
            staffPosition: staffPosition(2),
          },
        ],
      },
    },
    {
      insertionIndex: 1,
      candidate: podatus('neume-note-1'),
    },
  ])(
    'returns the original document for an invalid insertion',
    ({ insertionIndex, candidate }) => {
      const document = createDocument()

      expect(
        insertPodatus(
          document,
          candidate as PodatusNeume,
          insertionIndex,
        ),
      ).toBe(document)
    },
  )

  it('undoes and redoes the complete Podatus as one edit', () => {
    const document = createDocument()
    const insertedPodatus = podatus(
      'stable-neume',
      'stable-lower',
      'stable-upper',
    )
    const inserted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => insertPodatus(current, insertedPodatus, 1),
    )
    const undone = undoDocumentEdit(inserted)
    const redone = redoDocumentEdit(undone)

    expect(inserted.past).toHaveLength(1)
    expect(undone.present).toBe(document)
    expect(redone.present.neumes[1]).toBe(insertedPodatus)
  })

  it('allows exactly two remaining units and counts a Podatus as two', () => {
    const document: ChantDocument = {
      ...createDocument(),
      neumes: Array.from(
        { length: singleSystemNoteCapacity - 2 },
        (_, index) => punctum(`note-${index}`),
      ),
    }
    const currentNoteCount = countNotes(document.neumes)
    const inserted = canInsertNotesInSingleSystem(currentNoteCount, 2)
      ? insertPodatus(document, podatus(), document.neumes.length)
      : document

    expect(countNotes(inserted.neumes)).toBe(singleSystemNoteCapacity)
    expect(inserted).not.toBe(document)
  })

  it('rejects one remaining unit without history while punctum remains available', () => {
    const document: ChantDocument = {
      ...createDocument(),
      neumes: Array.from(
        { length: singleSystemNoteCapacity - 1 },
        (_, index) => punctum(`note-${index}`),
      ),
    }
    const history = createDocumentHistory(document)
    const currentNoteCount = countNotes(document.neumes)
    const rejected = applyDocumentEdit(history, (current) =>
      canInsertNotesInSingleSystem(countNotes(current.neumes), 2)
        ? insertPodatus(current, podatus(), current.neumes.length)
        : current,
    )

    expect(canInsertPunctumInSingleSystem(currentNoteCount)).toBe(true)
    expect(canInsertNotesInSingleSystem(currentNoteCount, 2)).toBe(false)
    expect(rejected).toBe(history)
  })
})
