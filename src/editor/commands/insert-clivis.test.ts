import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantNote,
  type ChantDocument,
  type ClivisNeume,
  type PunctumNeume,
} from '../domain/chant-document'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import { insertClivis } from './insert-clivis'

function punctum(id: string): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id, staffPosition: staffPosition(3) }],
  }
}

function clivis(
  id = 'clivis',
  upperNoteId = 'upper',
  lowerNoteId = 'lower',
): ClivisNeume {
  return {
    id,
    kind: 'clivis',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: upperNoteId, staffPosition: staffPosition(3) },
      { id: lowerNoteId, staffPosition: staffPosition(2) },
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

describe('insertClivis', () => {
  it.each([
    { index: 0, ids: ['inserted', 'neume-note-1', 'neume-note-2'] },
    { index: 1, ids: ['neume-note-1', 'inserted', 'neume-note-2'] },
    { index: 2, ids: ['neume-note-1', 'neume-note-2', 'inserted'] },
  ])('inserts at neume boundary $index', ({ index, ids }) => {
    const inserted = insertClivis(createDocument(), clivis('inserted'), index)

    expect(inserted.neumes.map((neume) => neume.id)).toEqual(ids)
  })

  it('preserves supplied identities and unrelated references immutably', () => {
    const document = createDocument()
    const insertedClivis = clivis(
      'stable-neume',
      'stable-upper',
      'stable-lower',
    )
    const inserted = insertClivis(document, insertedClivis, 1)

    expect(inserted.neumes[1]).toBe(insertedClivis)
    expect(inserted.neumes[1]?.notes.map((note) => note.id)).toEqual([
      'stable-upper',
      'stable-lower',
    ])
    expect(inserted.neumes[0]).toBe(document.neumes[0])
    expect(inserted.neumes[2]).toBe(document.neumes[1])
    expect(document.neumes).toHaveLength(2)
  })

  it.each([
    { name: 'negative boundary', insertionIndex: -1, candidate: clivis() },
    { name: 'boundary past the end', insertionIndex: 3, candidate: clivis() },
    { name: 'fractional boundary', insertionIndex: 1.5, candidate: clivis() },
    {
      name: 'unknown syllable',
      insertionIndex: 1,
      candidate: { ...clivis(), lyricSyllableId: 'unknown' },
    },
    {
      name: 'duplicate neume ID',
      insertionIndex: 1,
      candidate: clivis('neume-note-1'),
    },
    {
      name: 'duplicate existing constituent ID',
      insertionIndex: 1,
      candidate: clivis('new-neume', 'note-1', 'new-lower'),
    },
    {
      name: 'duplicate constituent IDs',
      insertionIndex: 1,
      candidate: clivis('new-neume', 'same-note', 'same-note'),
    },
    {
      name: 'equal contour',
      insertionIndex: 1,
      candidate: {
        ...clivis(),
        notes: [
          clivis().notes[0],
          { ...clivis().notes[1], staffPosition: staffPosition(3) },
        ] satisfies [ChantNote, ChantNote],
      },
    },
    {
      name: 'ascending contour',
      insertionIndex: 1,
      candidate: {
        ...clivis(),
        notes: [
          clivis().notes[0],
          { ...clivis().notes[1], staffPosition: staffPosition(4) },
        ] satisfies [ChantNote, ChantNote],
      },
    },
  ])(
    'returns the original document for $name',
    ({ insertionIndex, candidate }) => {
      const document = createDocument()

      expect(insertClivis(document, candidate, insertionIndex)).toBe(document)
    },
  )

  it('undoes and redoes the complete Clivis with the same IDs', () => {
    const document = createDocument()
    const insertedClivis = clivis(
      'stable-neume',
      'stable-upper',
      'stable-lower',
    )
    const inserted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => insertClivis(current, insertedClivis, 1),
    )
    const undone = undoDocumentEdit(inserted)
    const redone = redoDocumentEdit(undone)

    expect(inserted.past).toHaveLength(1)
    expect(undone.present).toBe(document)
    expect(redone.present.neumes[1]).toBe(insertedClivis)
    expect(redone.present.neumes[1]?.notes.map((note) => note.id)).toEqual([
      'stable-upper',
      'stable-lower',
    ])
  })

})
