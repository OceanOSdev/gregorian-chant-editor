import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
} from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import { deleteNote } from './delete-note'

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: {
      type: 'c',
      staffLine: 3,
    },
    syllables: [
      { id: 'syllable-alone', text: 'Ky-' },
      { id: 'syllable-shared', text: 'ri-' },
    ],
    notes: [
      {
        id: 'note-alone',
        kind: 'punctum',
        staffPosition: staffPosition(2),
        lyricSyllableId: 'syllable-alone',
      },
      {
        id: 'note-shared-1',
        kind: 'punctum',
        staffPosition: staffPosition(3),
        lyricSyllableId: 'syllable-shared',
      },
      {
        id: 'note-shared-2',
        kind: 'punctum',
        staffPosition: staffPosition(4),
        lyricSyllableId: 'syllable-shared',
      },
    ],
  }
}

describe('deleteNote', () => {
  it('removes only the targeted note', () => {
    const deletedDocument = deleteNote(createDocument(), 'note-shared-1')

    expect(deletedDocument.notes.map((note) => note.id)).toEqual([
      'note-alone',
      'note-shared-2',
    ])
  })

  it('leaves neighboring notes unchanged', () => {
    const document = createDocument()
    const deletedDocument = deleteNote(document, 'note-shared-1')

    expect(deletedDocument.notes[0]).toBe(document.notes[0])
    expect(deletedDocument.notes[1]).toBe(document.notes[2])
  })

  it('does not mutate the original document', () => {
    const document = createDocument()
    const originalNotes = document.notes
    const originalNoteIds = document.notes.map((note) => note.id)
    const deletedDocument = deleteNote(document, 'note-alone')

    expect(document.notes).toBe(originalNotes)
    expect(document.notes.map((note) => note.id)).toEqual(originalNoteIds)
    expect(deletedDocument).not.toBe(document)
    expect(deletedDocument.notes).not.toBe(document.notes)
  })

  it('returns the unchanged document for an unknown note ID', () => {
    const document = createDocument()

    expect(deleteNote(document, 'unknown-note')).toBe(document)
  })

  it('omits a lyric when its last associated note is deleted', () => {
    const layout = layoutChant(deleteNote(createDocument(), 'note-alone'))

    expect(
      layout.lyrics.some((lyric) => lyric.syllableId === 'syllable-alone'),
    ).toBe(false)
  })

  it('keeps one lyric when another associated note remains', () => {
    const layout = layoutChant(
      deleteNote(createDocument(), 'note-shared-1'),
    )

    expect(
      layout.lyrics.filter(
        (lyric) => lyric.syllableId === 'syllable-shared',
      ),
    ).toHaveLength(1)
  })
})
