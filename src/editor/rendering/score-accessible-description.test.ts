import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { layoutChant } from '../layout/layout-chant';
import { getScoreAccessibleDescription } from './score-accessible-description';

function documentWith(count: number): ChantDocument {
  return {
    divisions: [],
    lyricLanguage: 'la',
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: count
      ? [
          {
            id: 'syllable-1',
            text: 'Ky',
            startsAtNeumeId: 'neume-0',
            boundaryBefore: 'word',
          },
        ]
      : [],
    neumes: Array.from({ length: count }, (_, index) => ({
      id: `neume-${index}`,
      kind: 'punctum',
      notes: [
        {
          id: `note-${index}`,
          staffPosition: staffPosition(2),
        },
      ],
    })),
  };
}

describe('getScoreAccessibleDescription', () => {
  it('reports singular one-system totals', () => {
    expect(getScoreAccessibleDescription(layoutChant(documentWith(1)))).toBe(
      'A Gregorian chant score with 1 four-line system, 1 neume, ' +
        '1 note, and 1 rendered lyric syllable. Initial C (do) clef on staff line 3 from bottom, repeated on every system.',
    );
  });

  it('reports totals flattened across multiple systems', () => {
    expect(getScoreAccessibleDescription(layoutChant(documentWith(13)))).toBe(
      'A Gregorian chant score with 2 four-line systems, 13 neumes, ' +
        '13 notes, and 1 rendered lyric syllable. Initial C (do) clef on staff line 3 from bottom, repeated on every system.',
    );
  });

  it('counts all three notes in a Torculus', () => {
    const document: ChantDocument = {
      ...documentWith(0),
      neumes: [
        {
          id: 'neume-torculus',
          kind: 'torculus',
          notes: [
            { id: 'note-1', staffPosition: staffPosition(2) },
            { id: 'note-2', staffPosition: staffPosition(4) },
            { id: 'note-3', staffPosition: staffPosition(3) },
          ],
        },
      ],
    };

    expect(getScoreAccessibleDescription(layoutChant(document))).toContain(
      '1 neume, 3 notes',
    );
  });
});
