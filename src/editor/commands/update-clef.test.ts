import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Clef,
  type Neume,
} from '../domain/chant-document';
import { exampleDocument } from '../domain/example-document';
import { isValidNeume } from '../domain/neume';
import { updateClef } from './update-clef';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history';

const note = (id: string, pitch: number) => ({
  id,
  staffPosition: staffPosition(pitch),
});
const neumes: Neume[] = [
  { id: 'p', kind: 'punctum', notes: [note('p1', -8)] },
  { id: 'u', kind: 'podatus', notes: [note('u1', 2), note('u2', 3)] },
  { id: 'd', kind: 'clivis', notes: [note('d1', 8), note('d2', 1)] },
  {
    id: 's',
    kind: 'scandicus',
    notes: [note('s1', 0), note('s2', 1), note('s3', 3)],
  },
  {
    id: 't',
    kind: 'torculus',
    notes: [note('t1', 2), note('t2', 4), note('t3', 3)],
  },
  {
    id: 'c',
    kind: 'climacus',
    notes: [note('c1', 8), note('c2', 5), note('c3', 2)],
  },
  {
    id: 'r',
    kind: 'porrectus',
    notes: [note('r1', 4), note('r2', 1), note('r3', 10)],
  },
];
const document: ChantDocument = {
  ...exampleDocument,
  neumes,
  clefChanges: [],
  divisions: [{ id: 'bar', kind: 'minor', beforeNeumeId: 'd' }],
  syllables: [
    { id: 'lyric', text: 'Ky', startsAtNeumeId: 'p', boundaryBefore: 'word' },
  ],
};
const clefs: Clef[] = (['c', 'f'] as const).flatMap((type) =>
  ([1, 2, 3, 4] as const).map((staffLine) => ({ type, staffLine })),
);
const degree = (clef: Clef, pitch: number) =>
  (clef.type === 'c' ? 0 : 3) + pitch - 2 * (clef.staffLine - 1);

describe('initial clef melody preservation', () => {
  it('keeps the unchanged sample by exact reference', () => {
    expect(updateClef(exampleDocument, { type: 'c', staffLine: 3 })).toBe(
      exampleDocument,
    );
  });
  it.each([
    { type: 'c', staffLine: 4, delta: 2 },
    { type: 'f', staffLine: 3, delta: -3 },
  ] as const)(
    'moves C3 to $type$staffLine by $delta',
    ({ type, staffLine, delta }) => {
      const result = updateClef(document, { type, staffLine });
      expect(
        result.neumes.flatMap((n) => n.notes.map((note) => note.staffPosition)),
      ).toEqual(
        document.neumes.flatMap((n) =>
          n.notes.map((note) => note.staffPosition + delta),
        ),
      );
      expect(result.syllables).toBe(document.syllables);
      expect(result.divisions).toBe(document.divisions);
    },
  );
  for (const from of clefs)
    for (const to of clefs) {
      it(`preserves every degree, contour and ID on ${from.type}${from.staffLine} → ${to.type}${to.staffLine}`, () => {
        const source = { ...document, clef: from };
        const result = updateClef(source, to);
        result.neumes.forEach((n, i) => {
          expect(isValidNeume(n)).toBe(true);
          expect(n.kind).toBe(source.neumes[i].kind);
          expect(n.id).toBe(source.neumes[i].id);
          n.notes.forEach((note, j) => {
            const original = source.neumes[i].notes[j];
            expect(note.id).toBe(original.id);
            expect(degree(to, note.staffPosition)).toBe(
              degree(from, original.staffPosition),
            );
          });
        });
        expect(updateClef(result, from)).toEqual(source);
      });
    }
  it.each([
    null,
    {},
    { type: 'g', staffLine: 3 },
    { type: 'c', staffLine: 0 },
    { type: 'f', staffLine: 5 },
    { type: 'c', staffLine: 2.5 },
    { type: 'c', staffLine: '3' },
  ])('rejects invalid runtime clefs %j without edits', (value) => {
    expect(updateClef(document, value as Clef)).toBe(document);
  });
  it('rejects malformed or unsafe pitches before changing any notes', () => {
    for (const pitch of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
      const invalid: ChantDocument = {
        ...document,
        neumes: [
          ...neumes,
          {
            id: 'bad',
            kind: 'punctum',
            notes: [
              {
                id: 'bad-note',
                staffPosition: pitch as ReturnType<typeof staffPosition>,
              },
            ],
          },
        ],
      };
      expect(updateClef(invalid, { type: 'c', staffLine: 4 })).toBe(invalid);
    }
    const invalid = {
      ...document,
      clef: { type: 'g', staffLine: 3 },
    } as unknown as ChantDocument;
    expect(updateClef(invalid, { type: 'c', staffLine: 4 })).toBe(invalid);
  });
  it('rejects malformed neume contours and cardinality atomically', () => {
    const wrongContour: ChantDocument = {
      ...document,
      neumes: [
        ...neumes,
        { id: 'wrong', kind: 'clivis', notes: [note('x', 1), note('y', 3)] },
      ],
    };
    expect(updateClef(wrongContour, { type: 'f', staffLine: 3 })).toBe(
      wrongContour,
    );
    const missing = {
      ...document,
      neumes: [{ id: 'empty', kind: 'punctum', notes: [] }],
    } as unknown as ChantDocument;
    expect(updateClef(missing, { type: 'f', staffLine: 3 })).toBe(missing);
  });
  it('records clef and all pitches in one undo/redo snapshot', () => {
    const history = applyDocumentEdit(createDocumentHistory(document), (d) =>
      updateClef(d, { type: 'f', staffLine: 2 }),
    );
    expect(history.past).toEqual([document]);
    const undone = undoDocumentEdit(history);
    expect(undone.present).toBe(document);
    expect(redoDocumentEdit(undone).present).toBe(history.present);
    expect(applyDocumentEdit(history, (d) => updateClef(d, d.clef))).toBe(
      history,
    );
  });
});
