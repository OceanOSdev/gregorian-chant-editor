import { describe, expect, it } from 'vitest'
import { deleteNote } from '../commands/delete-note'
import { moveNoteVertically } from '../commands/move-note'
import {
  staffPosition,
  type ChantDocument,
} from '../domain/chant-document'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from './document-history'

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes: [
      {
        id: 'neume-1',
        kind: 'punctum',
        lyricSyllableId: 'syllable-1',
        notes: [{ id: 'note-1', staffPosition: staffPosition(3) }],
      },
    ],
  }
}

describe('document history', () => {
  it('moves the previous document into past when applying an edit', () => {
    const document = createDocument()
    const history = createDocumentHistory(document)
    const editedHistory = applyDocumentEdit(history, (currentDocument) =>
      moveNoteVertically(currentDocument, 'note-1', 1),
    )

    expect(editedHistory.past).toEqual([document])
    expect(editedHistory.present.neumes[0]?.notes[0]?.staffPosition).toBe(4)
    expect(editedHistory.future).toEqual([])
  })

  it('undoes and redoes an edit', () => {
    const document = createDocument()
    const editedHistory = applyDocumentEdit(
      createDocumentHistory(document),
      (currentDocument) =>
        moveNoteVertically(currentDocument, 'note-1', 1),
    )
    const undoneHistory = undoDocumentEdit(editedHistory)
    const redoneHistory = redoDocumentEdit(undoneHistory)

    expect(undoneHistory.present).toBe(document)
    expect(redoneHistory.present).toBe(editedHistory.present)
  })

  it('clears future history when applying a new edit after undo', () => {
    const movedHistory = applyDocumentEdit(
      createDocumentHistory(createDocument()),
      (document) => moveNoteVertically(document, 'note-1', 1),
    )
    const undoneHistory = undoDocumentEdit(movedHistory)
    const replacedHistory = applyDocumentEdit(undoneHistory, (document) =>
      moveNoteVertically(document, 'note-1', -1),
    )

    expect(replacedHistory.future).toEqual([])
    expect(replacedHistory.present.neumes[0]?.notes[0]?.staffPosition).toBe(2)
  })

  it('does not create a history entry for a no-op edit', () => {
    const history = createDocumentHistory(createDocument())

    expect(
      applyDocumentEdit(history, (document) =>
        deleteNote(document, 'unknown-note'),
      ),
    ).toBe(history)
  })

  it('does not mutate history inputs', () => {
    const initialHistory = createDocumentHistory(createDocument())
    const editedHistory = applyDocumentEdit(
      initialHistory,
      (document) => moveNoteVertically(document, 'note-1', 1),
    )
    const originalPast = editedHistory.past
    const originalFuture = editedHistory.future

    undoDocumentEdit(editedHistory)

    expect(initialHistory.past).toEqual([])
    expect(initialHistory.future).toEqual([])
    expect(editedHistory.past).toBe(originalPast)
    expect(editedHistory.future).toBe(originalFuture)
    expect(editedHistory.past).toHaveLength(1)
    expect(editedHistory.future).toHaveLength(0)
  })

  it('treats undo at the beginning and redo at the end as no-ops', () => {
    const history = createDocumentHistory(createDocument())

    expect(undoDocumentEdit(history)).toBe(history)
    expect(redoDocumentEdit(history)).toBe(history)
  })

  it('undoes and redoes note deletion', () => {
    const document = createDocument()
    const deletedHistory = applyDocumentEdit(
      createDocumentHistory(document),
      (currentDocument) => deleteNote(currentDocument, 'note-1'),
    )
    const undoneHistory = undoDocumentEdit(deletedHistory)
    const redoneHistory = redoDocumentEdit(undoneHistory)

    expect(deletedHistory.present.neumes).toHaveLength(0)
    expect(undoneHistory.present.neumes).toHaveLength(1)
    expect(redoneHistory.present.neumes).toHaveLength(0)
  })

  it('undoes and redoes note movement', () => {
    const movedHistory = applyDocumentEdit(
      createDocumentHistory(createDocument()),
      (document) => moveNoteVertically(document, 'note-1', 1),
    )
    const undoneHistory = undoDocumentEdit(movedHistory)
    const redoneHistory = redoDocumentEdit(undoneHistory)

    expect(movedHistory.present.neumes[0]?.notes[0]?.staffPosition).toBe(4)
    expect(undoneHistory.present.neumes[0]?.notes[0]?.staffPosition).toBe(3)
    expect(redoneHistory.present.neumes[0]?.notes[0]?.staffPosition).toBe(4)
  })
})
