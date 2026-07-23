import { describe, expect, it } from 'vitest'
import { staffPosition, type ChantDocument, type Punctum } from '../domain/chant-document'
import {
  applyDocumentEdit,
  createDocumentHistory,
} from '../state/document-history'
import { insertPunctum } from './insert-punctum'
import { resolveSyllableNoteInsertionIndex } from './resolve-syllable-note-insertion'

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'syllable-2', text: '' },
      { id: 'syllable-3', text: 'ri-' },
      { id: 'syllable-4', text: '' },
      { id: 'syllable-5', text: 'e' },
      { id: 'syllable-6', text: '' },
    ],
    notes: [
      createPunctum('note-1', 'syllable-1'),
      createPunctum('note-2', 'syllable-3'),
      createPunctum('note-3', 'syllable-3'),
      createPunctum('note-4', 'syllable-5'),
    ],
  }
}

function createPunctum(id: string, lyricSyllableId: string): Punctum {
  return {
    id,
    kind: 'punctum',
    staffPosition: staffPosition(2),
    lyricSyllableId,
  }
}

describe('resolveSyllableNoteInsertionIndex', () => {
  it.each([
    { preferredIndex: -10, expectedIndex: 1 },
    { preferredIndex: 1, expectedIndex: 1 },
    { preferredIndex: 2, expectedIndex: 2 },
    { preferredIndex: 3, expectedIndex: 3 },
    { preferredIndex: 20, expectedIndex: 3 },
  ])(
    'constrains $preferredIndex to an existing group at $expectedIndex',
    ({ preferredIndex, expectedIndex }) => {
      expect(
        resolveSyllableNoteInsertionIndex(
          createDocument(),
          'syllable-3',
          preferredIndex,
        ),
      ).toBe(expectedIndex)
    },
  )

  it('resolves an empty first syllable before all note groups', () => {
    const document = createDocument()
    const firstSyllable = { id: 'syllable-0', text: '' }

    expect(
      resolveSyllableNoteInsertionIndex(
        {
          ...document,
          syllables: [firstSyllable, ...document.syllables],
        },
        firstSyllable.id,
        document.notes.length,
      ),
    ).toBe(0)
  })

  it('resolves an empty middle syllable between adjacent groups', () => {
    expect(
      resolveSyllableNoteInsertionIndex(
        createDocument(),
        'syllable-4',
        0,
      ),
    ).toBe(3)
  })

  it('resolves an empty last syllable after all note groups', () => {
    expect(
      resolveSyllableNoteInsertionIndex(
        createDocument(),
        'syllable-6',
        0,
      ),
    ).toBe(4)
  })

  it('preserves contiguous note groups and syllable order', () => {
    const document = createDocument()
    const insertionIndex = resolveSyllableNoteInsertionIndex(
      document,
      'syllable-4',
      0,
    )

    if (insertionIndex === null) {
      throw new Error('Expected a valid insertion index')
    }

    const insertedDocument = insertPunctum(
      document,
      createPunctum('inserted-note', 'syllable-4'),
      insertionIndex,
    )

    expect(
      insertedDocument.notes.map((note) => note.lyricSyllableId),
    ).toEqual([
      'syllable-1',
      'syllable-3',
      'syllable-3',
      'syllable-4',
      'syllable-5',
    ])
  })

  it('links toolbar-style and graphical insertions to the active syllable', () => {
    const document = createDocument()
    const toolbarIndex = resolveSyllableNoteInsertionIndex(
      document,
      'syllable-3',
      document.notes.length,
    )
    const graphicalIndex = resolveSyllableNoteInsertionIndex(
      document,
      'syllable-4',
      0,
    )

    if (toolbarIndex === null || graphicalIndex === null) {
      throw new Error('Expected valid insertion indexes')
    }

    expect(
      insertPunctum(
        document,
        createPunctum('toolbar-note', 'syllable-3'),
        toolbarIndex,
      ).notes[toolbarIndex]?.lyricSyllableId,
    ).toBe('syllable-3')
    expect(
      insertPunctum(
        document,
        createPunctum('graphical-note', 'syllable-4'),
        graphicalIndex,
      ).notes[graphicalIndex]?.lyricSyllableId,
    ).toBe('syllable-4')
  })

  it('returns null for an unknown syllable without creating history', () => {
    const document = createDocument()
    const history = createDocumentHistory(document)
    const rejectedHistory = applyDocumentEdit(history, (currentDocument) => {
      const insertionIndex = resolveSyllableNoteInsertionIndex(
        currentDocument,
        'unknown-syllable',
        0,
      )

      return insertionIndex === null
        ? currentDocument
        : insertPunctum(
            currentDocument,
            createPunctum('rejected-note', 'unknown-syllable'),
            insertionIndex,
          )
    })

    expect(rejectedHistory).toBe(history)
  })
})
