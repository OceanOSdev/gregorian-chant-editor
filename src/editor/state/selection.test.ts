import { describe, expect, it } from 'vitest'
import { deleteNote } from '../commands/delete-note'
import {
  staffPosition,
  type ChantDocument,
} from '../domain/chant-document'
import {
  clearSelection,
  reconcileSelection,
  resolveSelectionSyllableId,
  selectNeume,
  selectNote,
  type EditorSelection,
} from './selection'

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
        kind: 'podatus',
        lyricSyllableId: 'syllable-1',
        notes: [
          { id: 'note-1', staffPosition: staffPosition(2) },
          { id: 'note-2', staffPosition: staffPosition(4) },
        ],
      },
      {
        id: 'neume-2',
        kind: 'punctum',
        lyricSyllableId: 'syllable-2',
        notes: [{ id: 'note-3', staffPosition: staffPosition(3) }],
      },
    ],
  }
}

describe('selection', () => {
  it('stores only the stable ID for each selection kind', () => {
    expect(selectNote('note-1')).toEqual({
      kind: 'note',
      noteId: 'note-1',
    })
    expect(selectNeume('neume-1')).toEqual({
      kind: 'neume',
      neumeId: 'neume-1',
    })
  })

  it.each([
    selectNote('note-1'),
    selectNeume('neume-1'),
  ])('clears a $kind selection', () => {
    expect(clearSelection()).toEqual({ kind: 'none' })
  })

  it('clears stale note and neume selections', () => {
    const document = createDocument()

    expect(
      reconcileSelection(document, selectNote('missing-note')),
    ).toEqual({ kind: 'none' })
    expect(
      reconcileSelection(document, selectNeume('missing-neume')),
    ).toEqual({ kind: 'none' })
  })

  it.each([
    selectNote('note-1'),
    selectNeume('neume-1'),
    clearSelection(),
  ])('returns the exact valid $kind selection object', (selection) => {
    expect(reconcileSelection(createDocument(), selection)).toBe(selection)
  })

  it('preserves valid selections across unrelated edits', () => {
    const document = createDocument()
    const noteSelection = selectNote('note-1')
    const neumeSelection = selectNeume('neume-1')
    const editedDocument = deleteNote(document, 'note-3')

    expect(reconcileSelection(editedDocument, noteSelection)).toBe(
      noteSelection,
    )
    expect(reconcileSelection(editedDocument, neumeSelection)).toBe(
      neumeSelection,
    )
  })

  it('preserves the selected neume and surviving note after normalization', () => {
    const document = deleteNote(createDocument(), 'note-1')
    const neumeSelection = selectNeume('neume-1')
    const noteSelection = selectNote('note-2')

    expect(document.neumes[0]?.kind).toBe('punctum')
    expect(reconcileSelection(document, neumeSelection)).toBe(neumeSelection)
    expect(reconcileSelection(document, noteSelection)).toBe(noteSelection)
  })

  it.each<{
    selection: EditorSelection
    syllableId: string | null
  }>([
    { selection: selectNote('note-1'), syllableId: 'syllable-1' },
    { selection: selectNeume('neume-2'), syllableId: 'syllable-2' },
    { selection: selectNote('missing-note'), syllableId: null },
    { selection: selectNeume('missing-neume'), syllableId: null },
    { selection: clearSelection(), syllableId: null },
  ])(
    'resolves $selection.kind selection ownership',
    ({ selection, syllableId }) => {
      expect(resolveSelectionSyllableId(createDocument(), selection)).toBe(
        syllableId,
      )
    },
  )
})
