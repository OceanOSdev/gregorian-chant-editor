import { describe, expect, it } from 'vitest'
import { staffPosition, type ChantDocument } from '../domain/chant-document'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import { appendLyricSyllable } from './append-lyric-syllable'

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
    ],
  }
}

describe('appendLyricSyllable', () => {
  it('appends a syllable while preserving existing entities', () => {
    const document = createDocument()
    const newSyllable = { id: 'syllable-2', text: '' }
    const appendedDocument = appendLyricSyllable(document, newSyllable)

    expect(appendedDocument.syllables).toEqual([
      document.syllables[0],
      newSyllable,
    ])
    expect(appendedDocument.syllables[0]).toBe(document.syllables[0])
    expect(appendedDocument.notes).toBe(document.notes)
    expect(document.syllables).toHaveLength(1)
  })

  it('returns the original document for a duplicate ID', () => {
    const document = createDocument()

    expect(
      appendLyricSyllable(document, { id: 'syllable-1', text: '' }),
    ).toBe(document)
  })

  it('can be undone and redone', () => {
    const document = createDocument()
    const appendedHistory = applyDocumentEdit(
      createDocumentHistory(document),
      (currentDocument) =>
        appendLyricSyllable(currentDocument, {
          id: 'syllable-2',
          text: '',
        }),
    )
    const undoneHistory = undoDocumentEdit(appendedHistory)
    const redoneHistory = redoDocumentEdit(undoneHistory)

    expect(appendedHistory.present.syllables).toHaveLength(2)
    expect(undoneHistory.present).toBe(document)
    expect(redoneHistory.present).toBe(appendedHistory.present)
  })

  it('clears redo history when appending after undo', () => {
    const firstAppend = applyDocumentEdit(
      createDocumentHistory(createDocument()),
      (document) =>
        appendLyricSyllable(document, { id: 'syllable-2', text: '' }),
    )
    const undoneHistory = undoDocumentEdit(firstAppend)
    const replacementAppend = applyDocumentEdit(
      undoneHistory,
      (document) =>
        appendLyricSyllable(document, { id: 'syllable-3', text: '' }),
    )

    expect(replacementAppend.future).toEqual([])
    expect(replacementAppend.present.syllables.at(-1)?.id).toBe('syllable-3')
  })
})
