import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Punctum,
} from '../domain/chant-document'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import {
  canInsertPunctumInSingleSystem,
  singleSystemNoteCapacity,
} from '../layout/layout-chant'
import { insertPunctum } from './insert-punctum'

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
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
        staffPosition: staffPosition(4),
        lyricSyllableId: 'syllable-1',
      },
    ],
  }
}

function createPunctum(id = 'inserted-note'): Punctum {
  return {
    id,
    kind: 'punctum',
    staffPosition: staffPosition(3),
    lyricSyllableId: 'syllable-1',
  }
}

describe('insertPunctum', () => {
  it.each([
    { position: 'beginning', index: 0, ids: ['inserted-note', 'note-1', 'note-2'] },
    { position: 'middle', index: 1, ids: ['note-1', 'inserted-note', 'note-2'] },
    { position: 'end', index: 2, ids: ['note-1', 'note-2', 'inserted-note'] },
  ])('inserts at the $position while preserving note order', ({ index, ids }) => {
    const insertedDocument = insertPunctum(
      createDocument(),
      createPunctum(),
      index,
    )

    expect(insertedDocument.notes.map((note) => note.id)).toEqual(ids)
  })

  it('does not mutate the original document or existing notes', () => {
    const document = createDocument()
    const originalNotes = document.notes
    const insertedDocument = insertPunctum(
      document,
      createPunctum(),
      1,
    )

    expect(document.notes).toBe(originalNotes)
    expect(document.notes.map((note) => note.id)).toEqual(['note-1', 'note-2'])
    expect(insertedDocument).not.toBe(document)
    expect(insertedDocument.notes[0]).toBe(document.notes[0])
    expect(insertedDocument.notes[2]).toBe(document.notes[1])
  })

  it('preserves the supplied punctum ID, pitch, and syllable ID', () => {
    const punctum = createPunctum('stable-note-id')
    const insertedDocument = insertPunctum(createDocument(), punctum, 1)

    expect(insertedDocument.notes[1]).toBe(punctum)
    expect(insertedDocument.notes[1]).toMatchObject({
      id: 'stable-note-id',
      staffPosition: 3,
      lyricSyllableId: 'syllable-1',
    })
  })

  it('can be undone and redone', () => {
    const originalDocument = createDocument()
    const insertedHistory = applyDocumentEdit(
      createDocumentHistory(originalDocument),
      (document) => insertPunctum(document, createPunctum(), 1),
    )
    const undoneHistory = undoDocumentEdit(insertedHistory)
    const redoneHistory = redoDocumentEdit(undoneHistory)

    expect(undoneHistory.present).toBe(originalDocument)
    expect(redoneHistory.present).toBe(insertedHistory.present)
    expect(redoneHistory.present.notes[1]?.id).toBe('inserted-note')
  })

  it('clears redo history when inserted after undo', () => {
    const firstInsertion = applyDocumentEdit(
      createDocumentHistory(createDocument()),
      (document) => insertPunctum(document, createPunctum('first-new-note'), 1),
    )
    const undoneHistory = undoDocumentEdit(firstInsertion)
    const replacementInsertion = applyDocumentEdit(
      undoneHistory,
      (document) =>
        insertPunctum(document, createPunctum('replacement-note'), 1),
    )

    expect(replacementInsertion.future).toEqual([])
    expect(replacementInsertion.present.notes[1]?.id).toBe('replacement-note')
  })

  it('does not create history when insertion is rejected at capacity', () => {
    const document = {
      ...createDocument(),
      notes: Array.from({ length: singleSystemNoteCapacity }, (_, index) => ({
        ...createPunctum(`note-${index + 1}`),
      })),
    }
    const history = createDocumentHistory(document)
    const rejectedHistory = applyDocumentEdit(history, (currentDocument) =>
      canInsertPunctumInSingleSystem(currentDocument.notes.length)
        ? insertPunctum(
            currentDocument,
            createPunctum('rejected-note'),
            currentDocument.notes.length,
          )
        : currentDocument,
    )

    expect(rejectedHistory).toBe(history)
  })
})
