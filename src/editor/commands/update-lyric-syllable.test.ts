import { describe, expect, it } from 'vitest'
import { staffPosition, type ChantDocument } from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import { updateLyricSyllableText } from './update-lyric-syllable'

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'syllable-2', text: 'ri-' },
    ],
    neumes: [
      {
        id: 'neume-1',
        kind: 'punctum',
        lyricSyllableId: 'syllable-1',
        notes: [{ id: 'note-1', staffPosition: staffPosition(3) }],
      },
      {
        id: 'neume-2',
        kind: 'punctum',
        lyricSyllableId: 'syllable-1',
        notes: [{ id: 'note-2', staffPosition: staffPosition(4) }],
      },
      {
        id: 'neume-3',
        kind: 'punctum',
        lyricSyllableId: 'syllable-2',
        notes: [{ id: 'note-3', staffPosition: staffPosition(5) }],
      },
    ],
  }
}

describe('updateLyricSyllableText', () => {
  it('updates only the targeted syllable and preserves note references', () => {
    const document = createDocument()
    const updatedDocument = updateLyricSyllableText(
      document,
      'syllable-1',
      'Kyr-',
    )

    expect(updatedDocument.syllables[0]?.text).toBe('Kyr-')
    expect(updatedDocument.syllables[1]).toBe(document.syllables[1])
    expect(updatedDocument.neumes).toBe(document.neumes)
    expect(updatedDocument.neumes.map((neume) => neume.lyricSyllableId)).toEqual(
      document.neumes.map((neume) => neume.lyricSyllableId),
    )
  })

  it('does not mutate the original document', () => {
    const document = createDocument()
    const originalSyllables = document.syllables
    const originalSyllable = document.syllables[0]
    const updatedDocument = updateLyricSyllableText(
      document,
      'syllable-1',
      'Kyr-',
    )

    expect(document.syllables).toBe(originalSyllables)
    expect(document.syllables[0]).toBe(originalSyllable)
    expect(document.syllables[0]?.text).toBe('Ky-')
    expect(updatedDocument).not.toBe(document)
    expect(updatedDocument.syllables).not.toBe(originalSyllables)
  })

  it('returns the original document for an unknown syllable', () => {
    const document = createDocument()

    expect(
      updateLyricSyllableText(document, 'unknown-syllable', 'text'),
    ).toBe(document)
  })

  it('returns the original document when the text is unchanged', () => {
    const document = createDocument()

    expect(updateLyricSyllableText(document, 'syllable-1', 'Ky-')).toBe(
      document,
    )
  })

  it('can be undone and redone', () => {
    const document = createDocument()
    const editedHistory = applyDocumentEdit(
      createDocumentHistory(document),
      (currentDocument) =>
        updateLyricSyllableText(currentDocument, 'syllable-1', 'Kyr-'),
    )
    const undoneHistory = undoDocumentEdit(editedHistory)
    const redoneHistory = redoDocumentEdit(undoneHistory)

    expect(editedHistory.present.syllables[0]?.text).toBe('Kyr-')
    expect(undoneHistory.present.syllables[0]?.text).toBe('Ky-')
    expect(redoneHistory.present.syllables[0]?.text).toBe('Kyr-')
  })

  it('does not create a history entry for an unchanged edit', () => {
    const history = createDocumentHistory(createDocument())

    expect(
      applyDocumentEdit(history, (document) =>
        updateLyricSyllableText(document, 'syllable-1', 'Ky-'),
      ),
    ).toBe(history)
  })

  it('lays out updated shared text exactly once', () => {
    const layout = layoutChant(
      updateLyricSyllableText(createDocument(), 'syllable-1', 'Kyr-'),
    )
    const updatedLyrics = layout.lyrics.filter(
      (lyric) => lyric.syllableId === 'syllable-1',
    )

    expect(updatedLyrics).toHaveLength(1)
    expect(updatedLyrics[0]?.text).toBe('Kyr-')
  })
})
