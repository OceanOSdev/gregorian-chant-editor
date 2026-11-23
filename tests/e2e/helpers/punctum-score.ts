// Development-fixture scores of plain punctums at one pitch, used by the
// division and focus specs. By default the first two punctums carry the word
// "Al-le" and one Minima division `D` stands before `n1`.

interface Division {
  id: string;
  kind: 'minima' | 'minor' | 'maior' | 'finalis';
  beforeNeumeId: string | null;
}

interface Syllable {
  id: string;
  text: string;
  startsAtNeumeId: string;
  boundaryBefore: 'word' | 'continuation';
}

export interface PunctumScore {
  title: string;
  lyricLanguage: string;
  clef: { type: 'c'; staffLine: number };
  neumes: {
    id: string;
    kind: 'punctum';
    notes: { id: string; staffPosition: number }[];
  }[];
  clefChanges: [];
  divisions: Division[];
  syllables: Syllable[];
}

export function punctumScore(count = 2): PunctumScore {
  return {
    title: 'Playwright — divisions',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: 2 }],
    })),
    clefChanges: [],
    divisions: [
      { id: 'D', kind: 'minima', beforeNeumeId: count > 1 ? 'n1' : null },
    ],
    syllables:
      count > 1
        ? [
            {
              id: 's0',
              text: 'Al',
              startsAtNeumeId: 'n0',
              boundaryBefore: 'word',
            },
            {
              id: 's1',
              text: 'le',
              startsAtNeumeId: 'n1',
              boundaryBefore: 'continuation',
            },
          ]
        : [],
  };
}
