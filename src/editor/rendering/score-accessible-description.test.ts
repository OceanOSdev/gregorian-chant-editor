import { describe, expect, it } from 'vitest'
import { staffPosition, type ChantDocument } from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import { getScoreAccessibleDescription } from './score-accessible-description'

function documentWith(count: number): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes: Array.from({ length: count }, (_, index) => ({
      id: `neume-${index}`,
      kind: 'punctum',
      lyricSyllableId: 'syllable-1',
      notes: [
        {
          id: `note-${index}`,
          staffPosition: staffPosition(2),
        },
      ],
    })),
  }
}

describe('getScoreAccessibleDescription', () => {
  it('reports singular one-system totals', () => {
    expect(getScoreAccessibleDescription(layoutChant(documentWith(1)))).toBe(
      'A Gregorian chant score with 1 four-line system, 1 neume, ' +
        '1 note, and 1 rendered lyric syllable.',
    )
  })

  it('reports totals flattened across multiple systems', () => {
    expect(getScoreAccessibleDescription(layoutChant(documentWith(10)))).toBe(
      'A Gregorian chant score with 2 four-line systems, 10 neumes, ' +
        '10 notes, and 1 rendered lyric syllable.',
    )
  })
})
