import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document'
import { resolveToolbarNeumeInsertion } from './resolve-toolbar-neume-insertion'

function punctum(id: string, syllableId: string, position: number): Neume {
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
        staffPosition(2),
      ),
    ).toEqual({
      insertionIndex: 1,
      referenceStaffPosition: 1,
    })
  })

  it('uses the final note of the active syllable as the fallback', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'syllable-1',
        null,
        staffPosition(2),
      ),
    ).toEqual({
      insertionIndex: 2,
      referenceStaffPosition: 5,
    })
  })

  it('ignores a selection outside the active syllable', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'syllable-1',
        'note-2',
        staffPosition(2),
      ),
    ).toEqual({
      insertionIndex: 2,
      referenceStaffPosition: 5,
    })
  })

  it('uses position 2 and the resolved boundary for an empty syllable', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'syllable-empty',
        null,
        staffPosition(2),
      ),
    ).toEqual({
      insertionIndex: 2,
      referenceStaffPosition: 2,
    })
  })

  it('rejects an unknown active syllable', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'unknown',
        null,
        staffPosition(2),
      ),
    ).toBeNull()
  })

  it('supports constructing an upper pitch exactly one step higher', () => {
    const context = resolveToolbarNeumeInsertion(
      createDocument(),
      'syllable-1',
      'note-1',
      staffPosition(2),
    )

    expect(
      context ? staffPosition(context.referenceStaffPosition + 1) : undefined,
    ).toBe(2)
  })

  it('uses the supplied Clivis fallback for an empty middle syllable', () => {
    const context = resolveToolbarNeumeInsertion(
      createDocument(),
      'syllable-empty',
      null,
      staffPosition(3),
    )

    expect(context).toEqual({
      insertionIndex: 2,
      referenceStaffPosition: 3,
    })
    expect(
      context
        ? [
            context.referenceStaffPosition,
            staffPosition(context.referenceStaffPosition - 1),
          ]
        : undefined,
    ).toEqual([3, 2])
  })

  it('inserts after the whole selected multi-note neume', () => {
    expect(
      resolveToolbarNeumeInsertion(
        createDocument(),
        'syllable-1',
        'note-lower',
        staffPosition(3),
      ),
    ).toEqual({
      insertionIndex: 2,
      referenceStaffPosition: 3,
    })
  })

  it('does not insert inside a selected Clivis', () => {
    const document = createDocument()
    const withClivis: ChantDocument = {
      ...document,
      neumes: document.neumes.map((neume) =>
        neume.id === 'neume-podatus'
          ? {
              id: 'neume-clivis',
              kind: 'clivis',
              lyricSyllableId: 'syllable-1',
              notes: [
                { id: 'note-clivis-upper', staffPosition: staffPosition(5) },
                { id: 'note-clivis-lower', staffPosition: staffPosition(3) },
              ],
            }
          : neume,
      ),
    }

    expect(
      resolveToolbarNeumeInsertion(
        withClivis,
        'syllable-1',
        'note-clivis-lower',
        staffPosition(3),
      ),
    ).toEqual({
      insertionIndex: 2,
      referenceStaffPosition: 3,
    })
  })
})
