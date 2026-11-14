import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
  type NoteAppearance,
} from '../../../src/editor/domain/chant-document';
import { etLuxCorpus } from '../word-composition/et-lux';

const note = (
  id: string,
  p: number,
  marks: NoteAppearance = {},
): ChantNote => ({
  id,
  staffPosition: staffPosition(p),
  ...marks,
});
const punctum = (id: string, p = 3, marks: NoteAppearance = {}): Neume => ({
  id,
  kind: 'punctum',
  notes: [note(id + '-note', p, marks)],
});
const base = (title: string): ChantDocument => ({
  title,
  clef: { type: 'c', staffLine: 4 },
  lyricLanguage: 'la',
  neumes: [],
  syllables: [],
  divisions: [],
  clefChanges: [],
  accidentals: [],
});
const pes = (
  id: string,
  p: [number, number, number, number, number],
): Neume => ({
  id,
  kind: 'pes-subpunctis',
  notes: [
    note(id + '0', p[0]),
    note(id + '1', p[1]),
    note(id + '2', p[2]),
    note(id + '3', p[3], { verticalEpisema: true }),
    note(id + '4', p[4]),
  ],
});
const christe = base('Kyrie XI — Christe (LU 1961 p. 46)');
christe.neumes = [
  { id: 'chri', kind: 'clivis', notes: [note('h', 4), note('g', 3)] },
  punctum('start', 7, { form: 'virga', mora: 1 }),
  pes('pes', [6, 7, 6, 4, 3]),
  punctum('end', 4, { mora: 1 }),
];
christe.syllables = [
  {
    id: 'chri-text',
    text: 'Chri',
    startsAtNeumeId: 'chri',
    boundaryBefore: 'word',
  },
  {
    id: 'ste',
    text: 'ste',
    startsAtNeumeId: 'start',
    boundaryBefore: 'continuation',
  },
];
const last = base('Kyrie XI — final Kyrie (LU 1961 p. 46)');
last.neumes = [
  {
    id: 'ky',
    kind: 'torculus',
    notes: [note('d0', 0), note('f', 2), note('d1', 0)],
  },
  { id: 'ri', kind: 'podatus', notes: [note('c', -1), note('d2', 0)] },
  punctum('start', 0, { mora: 1 }),
  punctum('virga', 3, { form: 'virga', mora: 1 }),
  pes('pes', [2, 3, 2, 0, -1]),
  punctum('end', 0, { mora: 1 }),
];
last.syllables = [
  { id: 'ky-text', text: 'Ký', startsAtNeumeId: 'ky', boundaryBefore: 'word' },
  {
    id: 'ri-text',
    text: 'ri',
    startsAtNeumeId: 'ri',
    boundaryBefore: 'continuation',
  },
  {
    id: 'e-text',
    text: 'e',
    startsAtNeumeId: 'start',
    boundaryBefore: 'continuation',
  },
];
const eleison = base('Kyrie XI — nine-note eleison (LU 1961 p. 46)');
eleison.neumes = [
  {
    id: 'rising',
    kind: 'scandicus',
    notes: [note('f', 2), note('g', 3), note('h', 4)],
  },
  {
    id: 'upper-tail',
    kind: 'climacus',
    notes: [note('i', 5), note('h2', 4), note('g2', 3)],
  },
  {
    id: 'lower-tail',
    kind: 'climacus',
    notes: [note('f2', 2), note('e', 1), note('d', 0)],
  },
  punctum('le', -1, { verticalEpisema: true }),
  punctum('i-neume', 0),
  punctum('son', 0, { mora: 1 }),
];
eleison.syllables = ['e', 'lé', 'i', 'son'].map((text, i) => ({
  id: 's' + i,
  text,
  startsAtNeumeId: ['rising', 'le', 'i-neume', 'son'][i],
  boundaryBefore: i ? 'continuation' : 'word',
}));
eleison.accidentals = [
  {
    id: 'flat',
    kind: 'flat',
    ownerNoteId: 'i',
    placement: { kind: 'above-note', noteId: 'f' },
  },
];
const long = base(
  'Long melisma — divisions, clef, earlier flat, modifiers and next syllable',
);
long.neumes = Array.from({ length: 90 }, (_, i) =>
  punctum(
    'n' + i,
    i === 12 || i === 13 ? 5 : 3,
    i === 60 ? { mora: 1, episema: true, verticalEpisema: true } : {},
  ),
);
long.syllables = [
  { id: 'ky-text', text: 'Ký', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
  {
    id: 'ri-text',
    text: 'ri',
    startsAtNeumeId: 'n85',
    boundaryBefore: 'continuation',
  },
];
long.divisions = [{ id: 'division', kind: 'minima', beforeNeumeId: 'n30' }];
long.clefChanges = [
  {
    id: 'clef',
    clef: { type: 'c', staffLine: 4 },
    beforeNeumeId: 'n50',
    beforeDivisionId: null,
  },
];
long.accidentals = [
  {
    id: 'flat',
    kind: 'flat',
    ownerNoteId: 'n12-note',
    placement: { kind: 'above-note', noteId: 'n10-note' },
  },
];

/** Selected supported shapes, not a complete Kyrie transcription or facsimile. */
export const spacingSpecimens = [
  ...etLuxCorpus.slice(0, 2).map((s) => ({ id: s.id, document: s.document })),
  { id: 'kyrie-christe', document: christe },
  { id: 'kyrie-last', document: last },
  { id: 'kyrie-eleison', document: eleison },
  { id: 'long-boundaries', document: long },
];

/** One dense span containing all fourteen independent kinds, including signs. */
const allKinds = base(
  'All fourteen kinds — independent neumes on one syllable',
);
let serial = 0;
const q = (p: number) => note('q' + serial++, p);
allKinds.neumes = [
  punctum('punctum', 3, { mora: 1, episema: true, verticalEpisema: true }),
  { id: 'bistropha', kind: 'bistropha', notes: [q(3), q(3)] },
  { id: 'tristropha', kind: 'tristropha', notes: [q(3), q(3), q(3)] },
  { id: 'podatus', kind: 'podatus', notes: [q(2), q(3)] },
  { id: 'clivis', kind: 'clivis', notes: [q(3), q(2)] },
  { id: 'scandicus', kind: 'scandicus', notes: [q(1), q(2), q(3)] },
  { id: 'torculus', kind: 'torculus', notes: [q(2), q(4), q(3)] },
  { id: 'climacus', kind: 'climacus', notes: [q(4), q(3), q(2)] },
  { id: 'porrectus', kind: 'porrectus', notes: [q(4), q(2), q(3)] },
  pes('pes-subpunctis', [2, 4, 3, 2, 1]),
  {
    id: 'torculus-resupinus',
    kind: 'torculus-resupinus',
    notes: [q(2), q(4), q(1), q(3)],
  },
  {
    id: 'porrectus-flexus',
    kind: 'porrectus-flexus',
    notes: [q(4), q(2), q(3), q(1)],
  },
  {
    id: 'scandicus-flexus',
    kind: 'scandicus-flexus',
    notes: [
      note('sf0', 0, { episema: true }),
      note('sf1', 1, { episema: true, verticalEpisema: true }),
      note('sf2', 2, { episema: true }),
      note('sf3', 1, { episema: true }),
    ],
  },
  {
    id: 'climacus-resupinus',
    kind: 'climacus-resupinus',
    notes: [q(4), q(3), q(1), q(2)],
  },
];
allKinds.syllables = [
  {
    id: 'one-syllable',
    text: 'a',
    startsAtNeumeId: 'punctum',
    boundaryBefore: 'word',
  },
];
export const ownershipSpecimen = allKinds;
