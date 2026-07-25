import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document'
import { resolveToolbarNeumeInsertion } from './resolve-toolbar-neume-insertion'

function punctum(
  id: string,
  syllableId: string,
  position: number,
): Neume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: syllableId,
    notes: [{ id, staffPosition: staffPosition(position) }],
  }
}

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'syllable-empty', text: '' },
      { id: 'syllable-2', text: 'ri-' },
    ],
    neumes: [
      punctum('note-1', 'syllable-1', 1),
      {
        id: 'neume-podatus',
        kind: 'podatus',
        lyricSyllableId: 'syllable-1',
        notes: [
          { id: 'note-lower', staffPosition: staffPosition(3) },
          { id: 'note-upper', staffPosition: staffPosition(5) },
        ],
      },
      punctum('note-2', 'syllable-2', 4),
    ],
  }
}

describe('resolveToolbarNeumeInsertion', () => {
  it('uses a selected active-syllable note and inserts after its neume', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'syllable-1',
        'note-1',
      ),
    ).toEqual({
      insertionIndex: 1,
      lowerStaffPosition: 1,
    })
  })

  it('uses the final note of the active syllable as the fallback', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'syllable-1',
        null,
      ),
    ).toEqual({
      insertionIndex: 2,
      lowerStaffPosition: 5,
    })
  })

  it('ignores a selection outside the active syllable', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'syllable-1',
        'note-2',
      ),
    ).toEqual({
      insertionIndex: 2,
      lowerStaffPosition: 5,
    })
  })

  it('uses position 2 and the resolved boundary for an empty syllable', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'syllable-empty',
        null,
      ),
    ).toEqual({
      insertionIndex: 2,
      lowerStaffPosition: 2,
    })
  })

  it('rejects an unknown active syllable', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'unknown',
        null,
      ),
    ).toBeNull()
  })

  it('supports constructing an upper pitch exactly one step higher', () => {
    const context = resolveToolbarNeumeInsertion(
      createDocument(),
      'syllable-1',
      'note-1',
    )

    expect(
      context
        ? staffPosition(context.lowerStaffPosition + 1)
        : undefined,
    ).toBe(2)
  })
})
