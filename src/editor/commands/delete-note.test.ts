import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type ClivisNeume,
  type PodatusNeume,
  type PunctumNeume,
} from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import { deleteNote } from './delete-note'

const punctum: PunctumNeume = {
  id: 'neume-punctum',
  kind: 'punctum',
  lyricSyllableId: 'syllable-alone',
  notes: [{ id: 'note-punctum', staffPosition: staffPosition(2) }],
}
const podatus: PodatusNeume = {
  id: 'neume-podatus',
  kind: 'podatus',
  lyricSyllableId: 'syllable-shared',
  notes: [
    { id: 'note-podatus-1', staffPosition: staffPosition(2) },
    { id: 'note-podatus-2', staffPosition: staffPosition(4) },
  ],
}
const clivis: ClivisNeume = {
  id: 'neume-clivis',
  kind: 'clivis',
  lyricSyllableId: 'syllable-shared',
  notes: [
    { id: 'note-clivis-1', staffPosition: staffPosition(5) },
    { id: 'note-clivis-2', staffPosition: staffPosition(3) },
  ],
}

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-alone', text: 'Ky-' },
      { id: 'syllable-shared', text: 'ri-' },
    ],
    neumes: [punctum, podatus, clivis],
  }
}

describe('deleteNote', () => {
  it('removes the neume when its final punctum note is deleted', () => {
    const deleted = deleteNote(createDocument(), 'note-punctum')

    expect(deleted.neumes.map((neume) => neume.id)).toEqual([
      'neume-podatus',
      'neume-clivis',
    ])
    expect(deleted.syllables).toHaveLength(2)
  })

  it.each([
    { noteId: 'note-podatus-1', neumeId: 'neume-podatus', survivor: 'note-podatus-2' },
    { noteId: 'note-podatus-2', neumeId: 'neume-podatus', survivor: 'note-podatus-1' },
    { noteId: 'note-clivis-2', neumeId: 'neume-clivis', survivor: 'note-clivis-1' },
  ])(
    'normalizes a two-note neume to punctum and preserves identities',
    ({ noteId, neumeId, survivor }) => {
      const deleted = deleteNote(createDocument(), noteId)
      const normalized = deleted.neumes.find((neume) => neume.id === neumeId)

      expect(normalized).toMatchObject({
        id: neumeId,
        kind: 'punctum',
        lyricSyllableId: 'syllable-shared',
      })
      expect(normalized?.notes[0]?.id).toBe(survivor)
    },
  )

  it('preserves unrelated references and does not mutate the input', () => {
    const document = createDocument()
    const deleted = deleteNote(document, 'note-podatus-1')

    expect(deleted.neumes[0]).toBe(document.neumes[0])
    expect(deleted.neumes[2]).toBe(document.neumes[2])
    expect(deleted.neumes).not.toBe(document.neumes)
    expect(document.neumes[1]?.kind).toBe('podatus')
  })

  it('returns the original document for an unknown note', () => {
    const document = createDocument()

    expect(deleteNote(document, 'unknown')).toBe(document)
  })

  it('updates lyric layout according to remaining associated notes', () => {
    const withoutAlone = layoutChant(
      deleteNote(createDocument(), 'note-punctum'),
    )
    const normalizedShared = layoutChant(
      deleteNote(createDocument(), 'note-podatus-1'),
    )

    expect(
      withoutAlone.lyrics.some(
        (lyric) => lyric.syllableId === 'syllable-alone',
      ),
    ).toBe(false)
    expect(
      normalizedShared.lyrics.filter(
        (lyric) => lyric.syllableId === 'syllable-shared',
      ),
    ).toHaveLength(1)
  })

  it('undoes and redoes normalized deletion', () => {
    const document = createDocument()
    const deleted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => deleteNote(current, 'note-podatus-1'),
    )
    const undone = undoDocumentEdit(deleted)
    const redone = redoDocumentEdit(undone)

    expect(undone.present.neumes[1]?.kind).toBe('podatus')
    expect(undone.present.neumes[1]?.notes).toHaveLength(2)
    expect(redone.present.neumes[1]?.kind).toBe('punctum')
    expect(redone.present.neumes[1]?.notes[0]?.id).toBe('note-podatus-2')
  })
})
