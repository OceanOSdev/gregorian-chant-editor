import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../../../src/editor/domain/chant-document';
import type { CompositionCase } from './corpus';

type Recipe =
  | { kind: 'punctum'; pitches: [number] }
  | { kind: 'podatus' | 'clivis'; pitches: [number, number] }
  | { kind: 'climacus'; pitches: [number, number, number] };
const punctum = (p: number): Recipe => ({ kind: 'punctum', pitches: [p] });
const podatus = (a: number, b: number): Recipe => ({
  kind: 'podatus',
  pitches: [a, b],
});
const clivis = (a: number, b: number): Recipe => ({
  kind: 'clivis',
  pitches: [a, b],
});
const climacus = (a: number, b: number, c: number): Recipe => ({
  kind: 'climacus',
  pitches: [a, b, c],
});
function makeNeume(id: string, recipe: Recipe): Neume {
  const note = (i: number) => ({
    id: `${id}-note-${i}`,
    staffPosition: staffPosition(recipe.pitches[i]),
  });
  switch (recipe.kind) {
    case 'punctum':
      return { id, kind: recipe.kind, notes: [note(0)] };
    case 'podatus':
      return { id, kind: recipe.kind, notes: [note(0), note(1)] };
    case 'clivis':
      return { id, kind: recipe.kind, notes: [note(0), note(1)] };
    case 'climacus':
      return { id, kind: recipe.kind, notes: [note(0), note(1), note(2)] };
  }
}
// Manual transcription, not a GABC importer. h=5, i=6 under the source C3 clef.
const sections = [
  { text: 'et', boundaryBefore: 'word', recipes: [punctum(5), punctum(5)] }, // et(hh)
  { text: 'lux', boundaryBefore: 'word', recipes: [punctum(5)] },
  { text: 'per', boundaryBefore: 'word', recipes: [punctum(5)] },
  // pé(hg/hi!jvHGhhg)(,)(i_[oh:h]hivHF') — two music groups, one lyric.
  {
    text: 'pé',
    boundaryBefore: 'continuation',
    recipes: [
      clivis(5, 4),
      podatus(5, 6),
      climacus(7, 5, 4),
      punctum(5),
      clivis(5, 4),
      clivis(6, 5),
      climacus(6, 5, 3),
    ],
  },
  { text: 'tu', boundaryBefore: 'continuation', recipes: [punctum(3)] },
  // a(fhF'Efhhf//hvvGF'hee[ll:1]d.0). Repeated virgae/compound glyphs
  // use supported shapes without changing pitch order; rhythmic signs omitted.
  {
    text: 'a',
    boundaryBefore: 'continuation',
    recipes: [
      punctum(3),
      climacus(5, 3, 2),
      podatus(3, 5),
      clivis(5, 3),
      punctum(5),
      climacus(5, 4, 3),
      clivis(5, 2),
      clivis(2, 1),
    ],
  },
] satisfies {
  text: string;
  boundaryBefore: 'word' | 'continuation';
  recipes: Recipe[];
}[];

function specimen(
  id: string,
  sectionCount: number,
  prefix = 0,
): CompositionCase {
  const document: ChantDocument = {
    title: `Et lux perpetua — ${id}`,
    divisions: [],
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    syllables: [],
    neumes: [],
  };
  for (let i = 0; i < prefix; i++)
    document.neumes.push(makeNeume(`${id}-prefix-${i}`, punctum(5)));
  for (const section of sections.slice(0, sectionCount)) {
    const startsAtNeumeId = `${id}-n${document.neumes.length}`;
    document.syllables.push({
      id: `${id}-s${document.syllables.length}`,
      text: section.text,
      startsAtNeumeId,
      boundaryBefore: section.boundaryBefore,
    });
    for (const recipe of section.recipes)
      document.neumes.push(
        makeNeume(`${id}-n${document.neumes.length}`, recipe),
      );
  }
  const words: string[][] = [];
  for (const syllable of document.syllables) {
    if (syllable.boundaryBefore === 'word') words.push([]);
    words.at(-1)?.push(syllable.text);
  }
  return {
    id,
    name: 'Et lux perpetua',
    arrangement: 'reference',
    words,
    document,
  };
}
export const etLuxCorpus = [
  specimen('et-lux-prefix', 2),
  specimen('et-lux-full-supported', 6),
  specimen('et-lux-split-span', 2, 9),
];
