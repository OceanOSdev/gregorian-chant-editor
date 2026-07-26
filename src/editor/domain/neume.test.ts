import { describe, expect, it } from 'vitest'
import {
  type ChantDocument,
  staffPosition,
  type ClivisNeume,
  type PodatusNeume,
  type PunctumNeume,
  type ScandicusNeume,
} from './chant-document'
import { countNotes, findNeume, findNote, isValidNeume } from './neume'

const punctum: PunctumNeume = {
  id: 'neume-punctum',
  kind: 'punctum',
  lyricSyllableId: 'syllable-1',
  notes: [{ id: 'note-1', staffPosition: staffPosition(2) }],
}

function podatus(firstPosition: number, secondPosition: number): PodatusNeume {
  return {
    id: 'neume-podatus',
    kind: 'podatus',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: 'note-1', staffPosition: staffPosition(firstPosition) },
      { id: 'note-2', staffPosition: staffPosition(secondPosition) },
    ],
  }
}

function clivis(firstPosition: number, secondPosition: number): ClivisNeume {
  return {
    id: 'neume-clivis',
    kind: 'clivis',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: 'note-1', staffPosition: staffPosition(firstPosition) },
      { id: 'note-2', staffPosition: staffPosition(secondPosition) },
    ],
  }
}

function scandicus(
  firstPosition: number,
  secondPosition: number,
  thirdPosition: number,
): ScandicusNeume {
  return {
    id: 'neume-scandicus',
    kind: 'scandicus',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: 'note-scandicus-1', staffPosition: staffPosition(firstPosition) },
      { id: 'note-scandicus-2', staffPosition: staffPosition(secondPosition) },
      { id: 'note-scandicus-3', staffPosition: staffPosition(thirdPosition) },
    ],
  }
}

describe('neume validation', () => {
  it('accepts a one-note punctum', () => {
    expect(isValidNeume(punctum)).toBe(true)
  })

  it('accepts an ascending podatus', () => {
    expect(isValidNeume(podatus(2, 4))).toBe(true)
  })

  it('accepts a descending clivis', () => {
    expect(isValidNeume(clivis(4, 2))).toBe(true)
  })

  it('rejects equal-pitch two-note neumes', () => {
    expect(isValidNeume(podatus(3, 3))).toBe(false)
    expect(isValidNeume(clivis(3, 3))).toBe(false)
  })

  it('rejects reversed podatus and clivis structures', () => {
    expect(isValidNeume(podatus(4, 2))).toBe(false)
    expect(isValidNeume(clivis(2, 4))).toBe(false)
  })

  it.each([
    [2, 3, 4],
    [2, 4, 7],
    [-1, 1, 6],
  ])(
    'accepts a strictly ascending Scandicus %s, %s, %s',
    (first, second, third) => {
      expect(isValidNeume(scandicus(first, second, third))).toBe(true)
    },
  )

  it.each([
    [2, 2, 4],
    [2, 4, 4],
    [3, 2, 4],
    [2, 5, 4],
  ])('rejects a non-ascending Scandicus %s, %s, %s', (first, second, third) => {
    expect(isValidNeume(scandicus(first, second, third))).toBe(false)
  })

  it('rejects malformed Scandicus cardinality at runtime', () => {
    const malformed = scandicus(2, 4, 7)

    malformed.notes.pop()

    expect(isValidNeume(malformed)).toBe(false)
  })
})

describe('neume lookup', () => {
  const document: ChantDocument = {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes: [punctum, podatus(2, 4), scandicus(2, 4, 7)],
  }

  it('finds a neume and its document index', () => {
    expect(findNeume(document, 'neume-podatus')).toEqual({
      neume: document.neumes[1],
      neumeIndex: 1,
    })
  })

  it('returns null for a missing neume', () => {
    expect(findNeume(document, 'missing')).toBeNull()
  })

  it('resolves a note to its owning neume', () => {
    expect(findNote(document, 'note-2')?.neume).toBe(document.neumes[1])
  })

  it('resolves every Scandicus constituent and counts its three units', () => {
    const locatedScandicus = document.neumes[2]

    if (!locatedScandicus) {
      throw new Error('Missing Scandicus fixture')
    }

    expect(findNote(document, 'note-scandicus-1')?.noteIndex).toBe(0)
    expect(findNote(document, 'note-scandicus-2')?.noteIndex).toBe(1)
    expect(findNote(document, 'note-scandicus-3')?.noteIndex).toBe(2)
    expect(countNotes([locatedScandicus])).toBe(3)
    expect(locatedScandicus).toMatchObject({
      id: 'neume-scandicus',
      lyricSyllableId: 'syllable-1',
    })
    expect(locatedScandicus.notes.map((note) => note.id)).toEqual([
      'note-scandicus-1',
      'note-scandicus-2',
      'note-scandicus-3',
    ])
  })
})
