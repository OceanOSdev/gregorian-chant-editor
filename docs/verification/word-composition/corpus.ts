import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../../../src/editor/domain/chant-document';

/** Explicit editorial words, never inferred from case, vowels or rendered gaps. */
export const wordCorpus = [
  { name: 'Alleluia', words: [['Al', 'le', 'lu', 'ia']] },
  { name: 'Gregario', words: [['gre', 'gar', 'io']] },
  { name: 'Miserere', words: [['mi', 'se', 're', 're']] },
  { name: 'Gloria', words: [['Glo', 'ri', 'a']] },
  {
    name: 'Kyrie eleison',
    words: [
      ['Ky', 'ri', 'e'],
      ['e', 'lei', 'son'],
    ],
  },
  { name: 'Dominus', words: [['Do', 'mi', 'nus']] },
  { name: 'Sanctus', words: [['Sanc', 'tus']] },
  { name: 'Deo', words: [['De', 'o']] },
];
export const arrangements = [
  'puncta',
  'melisma',
  'wide',
  'break',
  'two-words',
] as const;
export type CorpusArrangement = (typeof arrangements)[number] | 'reference';
export interface CompositionCase {
  id: string;
  name: string;
  arrangement: CorpusArrangement;
  words: string[][];
  document: ChantDocument;
}
function neume(id: string, wide: boolean, index: number): Neume {
  const note = (p: number, j: number) => ({
    id: `${id}-note-${j}`,
    staffPosition: staffPosition(p),
  });
  if (!wide) return { id, kind: 'punctum', notes: [note(2, 0)] };
  switch (index % 6) {
    case 0:
      return { id, kind: 'podatus', notes: [note(2, 0), note(4, 1)] };
    case 1:
      return { id, kind: 'clivis', notes: [note(5, 0), note(1, 1)] };
    case 2:
      return {
        id,
        kind: 'scandicus',
        notes: [note(1, 0), note(2, 1), note(4, 2)],
      };
    case 3:
      return {
        id,
        kind: 'torculus',
        notes: [note(2, 0), note(4, 1), note(3, 2)],
      };
    case 4:
      return {
        id,
        kind: 'climacus',
        notes: [note(4, 0), note(3, 1), note(2, 2)],
      };
    default:
      return {
        id,
        kind: 'porrectus',
        notes: [note(5, 0), note(1, 1), note(4, 2)],
      };
  }
}
export const compositionCorpus: CompositionCase[] = wordCorpus.flatMap(
  (entry, wordIndex) =>
    arrangements.map((arrangement) => {
      const id = `${wordIndex}-${arrangement}`;
      const words =
        arrangement === 'two-words'
          ? [
              ...entry.words,
              wordCorpus[(wordIndex + 1) % wordCorpus.length].words[0],
            ]
          : entry.words;
      const document: ChantDocument = {
        accidentals: [],
        title: `${entry.name} / ${arrangement}`,
        clefChanges: [],
        divisions: [],
        lyricLanguage: 'la',
        clef: { type: 'c', staffLine: 3 },
        syllables: [],
        neumes: [],
      };
      for (const word of words)
        for (const [part, text] of word.entries()) {
          const index = document.syllables.length;
          const neumeId = `${id}-n${document.neumes.length}`;
          document.neumes.push(
            neume(neumeId, arrangement === 'wide', index + wordIndex),
          );
          document.syllables.push({
            id: `${id}-s${index}`,
            text,
            startsAtNeumeId: neumeId,
            boundaryBefore: part === 0 ? 'word' : 'continuation',
          });
          // Break fixtures place the first syllable before a long melisma; no
          // manual breaks or width overrides are introduced into the document.
          if (
            index === 0 &&
            (arrangement === 'melisma' || arrangement === 'break')
          )
            for (let j = 0; j < (arrangement === 'break' ? 11 : 3); j++) {
              const next = `${id}-n${document.neumes.length}`;
              document.neumes.push(neume(next, false, 0));
            }
        }
      return { id, name: entry.name, arrangement, words, document };
    }),
);
