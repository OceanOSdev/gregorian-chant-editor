import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type PunctumNeume,
} from '../domain/chant-document'
import { countNotes } from '../domain/neume'
import {
  canInsertPunctumInSingleSystem,
  singleSystemNoteCapacity,
} from '../layout/layout-chant'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import { insertPunctum } from './insert-punctum'

function createPunctum(id: string, noteId = `${id}-note`): PunctumNeume {
  return {
    id,
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id: noteId, staffPosition: staffPosition(3) }],
  }
}

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes: [
      createPunctum('neume-1', 'note-1'),
      createPunctum('neume-2', 'note-2'),
    ],
  }
}

describe('insertPunctum', () => {
  it.each([
    { index: 0, ids: ['inserted', 'neume-1', 'neume-2'] },
    { index: 1, ids: ['neume-1', 'inserted', 'neume-2'] },
    { index: 2, ids: ['neume-1', 'neume-2', 'inserted'] },
  ])('inserts at neume boundary $index', ({ index, ids }) => {
    const inserted = insertPunctum(
      createDocument(),
      createPunctum('inserted'),
      index,
    )

    expect(inserted.neumes.map((neume) => neume.id)).toEqual(ids)
  })

  it('preserves supplied neume and note identities without mutation', () => {
    const document = createDocument()
    const punctum = createPunctum('stable-neume', 'stable-note')
    const inserted = insertPunctum(document, punctum, 1)

    expect(inserted.neumes[1]).toBe(punctum)
    expect(inserted.neumes[1]?.notes[0]?.id).toBe('stable-note')
    expect(inserted.neumes[0]).toBe(document.neumes[0])
    expect(inserted.neumes[2]).toBe(document.neumes[1])
    expect(document.neumes).toHaveLength(2)
  })

  it('can be undone and redone and clears redo after replacement', () => {
    const document = createDocument()
    const inserted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => insertPunctum(current, createPunctum('inserted'), 1),
    )
    const undone = undoDocumentEdit(inserted)
    const redone = redoDocumentEdit(undone)
    const replacement = applyDocumentEdit(undone, (current) =>
      insertPunctum(current, createPunctum('replacement'), 1),
    )

    expect(undone.present).toBe(document)
    expect(redone.present).toBe(inserted.present)
    expect(replacement.future).toEqual([])
    expect(replacement.present.neumes[1]?.id).toBe('replacement')
  })

  it('does not create history when rendered-note capacity rejects insertion', () => {
    const document: ChantDocument = {
      ...createDocument(),
      neumes: Array.from({ length: singleSystemNoteCapacity }, (_, index) =>
        createPunctum(`neume-${index}`),
      ),
    }
    const history = createDocumentHistory(document)
    const rejected = applyDocumentEdit(history, (current) =>
      canInsertPunctumInSingleSystem(countNotes(current.neumes))
        ? insertPunctum(current, createPunctum('rejected'), current.neumes.length)
        : current,
    )

    expect(rejected).toBe(history)
  })
})
