import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import { deleteNeume } from './delete-neume'

const neumes: Neume[] = [
  {
    id: 'neume-punctum',
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id: 'note-punctum', staffPosition: staffPosition(2) }],
  },
  {
    id: 'neume-podatus',
    kind: 'podatus',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: 'note-podatus-lower', staffPosition: staffPosition(2) },
      { id: 'note-podatus-upper', staffPosition: staffPosition(4) },
    ],
  },
  {
    id: 'neume-clivis',
    kind: 'clivis',
    lyricSyllableId: 'syllable-2',
    notes: [
      { id: 'note-clivis-upper', staffPosition: staffPosition(5) },
      { id: 'note-clivis-lower', staffPosition: staffPosition(3) },
    ],
  },
  {
    id: 'neume-scandicus',
    kind: 'scandicus',
    lyricSyllableId: 'syllable-2',
    notes: [
      { id: 'note-scandicus-1', staffPosition: staffPosition(1) },
      { id: 'note-scandicus-2', staffPosition: staffPosition(3) },
      { id: 'note-scandicus-3', staffPosition: staffPosition(6) },
    ],
  },
]

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'syllable-2', text: 'ri-' },
    ],
    neumes: [...neumes],
  }
}

describe('deleteNeume', () => {
  it.each([
    'neume-punctum',
    'neume-podatus',
    'neume-clivis',
    'neume-scandicus',
  ])('removes the complete %s and preserves its lyric syllable', (neumeId) => {
    const document = createDocument()
    const deleted = deleteNeume(document, neumeId)

    expect(deleted.neumes.some((neume) => neume.id === neumeId)).toBe(false)
    expect(deleted.syllables).toBe(document.syllables)
    expect(deleted.syllables).toEqual(document.syllables)
  })

  it('returns the exact document for an unknown ID', () => {
    const document = createDocument()

    expect(deleteNeume(document, 'missing')).toBe(document)
  })

  it('does not mutate input and preserves unrelated references and order', () => {
    const document = createDocument()
    const originalNeumes = [...document.neumes]
    const deleted = deleteNeume(document, 'neume-podatus')

    expect(document.neumes).toEqual(originalNeumes)
    expect(deleted.neumes).toEqual([neumes[0], neumes[2], neumes[3]])
    expect(deleted.neumes[0]).toBe(neumes[0])
    expect(deleted.neumes[1]).toBe(neumes[2])
    expect(deleted.neumes[2]).toBe(neumes[3])
    expect(deleted.neumes).not.toBe(document.neumes)
  })

  it('creates one history entry and undo/redo restores exact notation', () => {
    const document = createDocument()
    const deleted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => deleteNeume(current, 'neume-podatus'),
    )
    const undone = undoDocumentEdit(deleted)
    const redone = redoDocumentEdit(undone)

    expect(deleted.past).toHaveLength(1)
    expect(undone.present.neumes[1]).toBe(neumes[1])
    expect(undone.present.neumes[1]).toEqual({
      id: 'neume-podatus',
      kind: 'podatus',
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'note-podatus-lower', staffPosition: 2 },
        { id: 'note-podatus-upper', staffPosition: 4 },
      ],
    })
    expect(redone.present).toBe(deleted.present)
    expect(
      redone.present.neumes.some(
        (neume) => neume.id === 'neume-podatus',
      ),
    ).toBe(false)
  })

  it('removes and atomically restores a complete Scandicus', () => {
    const document = createDocument()
    const deleted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => deleteNeume(current, 'neume-scandicus'),
    )
    const undone = undoDocumentEdit(deleted)
    const redone = redoDocumentEdit(undone)

    expect(deleted.past).toHaveLength(1)
    expect(deleted.present.neumes.map((neume) => neume.id)).toEqual([
      'neume-punctum',
      'neume-podatus',
      'neume-clivis',
    ])
    expect(deleted.present.syllables).toBe(document.syllables)
    expect(undone.present.neumes[3]).toBe(neumes[3])
    expect(undone.present.neumes[3]?.notes.map((note) => note.id)).toEqual([
      'note-scandicus-1',
      'note-scandicus-2',
      'note-scandicus-3',
    ])
    expect(redone.present).toBe(deleted.present)
  })
})
