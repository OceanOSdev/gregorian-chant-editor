import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type PunctumNeume,
} from '../domain/chant-document'
import {
  applyDocumentEdit,
  createDocumentHistory,
} from '../state/document-history'
import { insertPunctum } from './insert-punctum'
import { resolveSyllableNeumeInsertionIndex } from './resolve-syllable-neume-insertion'

function punctum(id: string, lyricSyllableId: string): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId,
    notes: [{ id, staffPosition: staffPosition(2) }],
  }
}

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
    neumes: [
      punctum('note-1', 'syllable-1'),
      punctum('note-2', 'syllable-3'),
      punctum('note-3', 'syllable-3'),
      punctum('note-4', 'syllable-5'),
    ],
  }
}

describe('resolveSyllableNeumeInsertionIndex', () => {
  it.each([
    { preferredIndex: -10, expectedIndex: 1 },
    { preferredIndex: 1, expectedIndex: 1 },
    { preferredIndex: 2, expectedIndex: 2 },
    { preferredIndex: 3, expectedIndex: 3 },
    { preferredIndex: 20, expectedIndex: 3 },
  ])(
    'constrains $preferredIndex to the syllable neume group',
    ({ preferredIndex, expectedIndex }) => {
      expect(
        resolveSyllableNeumeInsertionIndex(
          createDocument(),
          'syllable-3',
          preferredIndex,
        ),
      ).toBe(expectedIndex)
    },
  )

  it('places empty syllables before, between, and after existing groups', () => {
    const document = createDocument()

    expect(
      resolveSyllableNeumeInsertionIndex(document, 'syllable-2', 4),
    ).toBe(1)
    expect(
      resolveSyllableNeumeInsertionIndex(document, 'syllable-4', 0),
    ).toBe(3)
    expect(
      resolveSyllableNeumeInsertionIndex(document, 'syllable-6', 0),
    ).toBe(4)
  })

  it('preserves multiple neume order and contiguous syllable groups', () => {
    const document = createDocument()
    const insertionIndex = resolveSyllableNeumeInsertionIndex(
      document,
      'syllable-3',
      2,
    )

    if (insertionIndex === null) {
      throw new Error('Expected an insertion boundary')
    }

    const inserted = insertPunctum(
      document,
      punctum('inserted-note', 'syllable-3'),
      insertionIndex,
    )

    expect(inserted.neumes.map((neume) => neume.lyricSyllableId)).toEqual([
      'syllable-1',
      'syllable-3',
      'syllable-3',
      'syllable-3',
      'syllable-5',
    ])
    expect(inserted.neumes.map((neume) => neume.id)).toEqual([
      'neume-note-1',
      'neume-note-2',
      'neume-inserted-note',
      'neume-note-3',
      'neume-note-4',
    ])
  })

  it('rejects an unknown syllable without creating history', () => {
    const document = createDocument()
    const history = createDocumentHistory(document)
    const rejected = applyDocumentEdit(history, (current) => {
      const index = resolveSyllableNeumeInsertionIndex(
        current,
        'unknown',
        0,
      )

      return index === null
        ? current
        : insertPunctum(current, punctum('rejected', 'unknown'), index)
    })

    expect(rejected).toBe(history)
  })
})
