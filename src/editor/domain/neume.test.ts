import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ClivisNeume,
  type PodatusNeume,
  type PunctumNeume,
} from './chant-document'
import { isValidNeume } from './neume'

const punctum: PunctumNeume = {
  id: 'neume-punctum',
  kind: 'punctum',
  lyricSyllableId: 'syllable-1',
  notes: [{ id: 'note-1', staffPosition: staffPosition(2) }],
}

function podatus(
  firstPosition: number,
  secondPosition: number,
): PodatusNeume {
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

function clivis(
  firstPosition: number,
  secondPosition: number,
): ClivisNeume {
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
})
