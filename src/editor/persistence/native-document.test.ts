import { describe, expect, it } from 'vitest';
import type { ChantDocument } from '../domain/chant-document';
import { exampleDocument } from '../domain/example-document';
import { layoutChant } from '../layout/layout-chant';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
  documentFilename,
  maximumDocumentBytes,
} from './native-document';

const envelope = (document: unknown) =>
  JSON.stringify({
    format: 'gregorian-chant-editor',
    version: 1,
    document: withoutAccidentals(document),
  });
function withoutAccidentals(document: unknown) {
  if (
    typeof document !== 'object' ||
    document === null ||
    !('accidentals' in document)
  )
    return document;
  const { accidentals: _accidentals, ...legacy } = document;
  return legacy;
}
function specimen(): ChantDocument {
  return {
    ...structuredClone(exampleDocument),
    lyricLanguage: 'el',
    divisions: [{ id: 'division', kind: 'maior', beforeNeumeId: null }],
    clefChanges: [
      {
        id: 'change',
        clef: { type: 'f', staffLine: 2 },
        beforeNeumeId: null,
        beforeDivisionId: 'division',
      },
    ],
  };
}
describe('native v1 codec', () => {
  it.each<[string, number[]]>([
    ['punctum', [1]],
    ['podatus', [1, 3]],
    ['clivis', [3, 1]],
    ['scandicus', [1, 2, 3]],
    ['torculus', [1, 3, 1]],
    ['climacus', [3, 2, 1]],
    ['porrectus', [3, 1, 3]],
  ])(
    'round trips %s with its exact tuple and rejects extra notes',
    (kind, pitches) => {
      const notes = pitches.map((staffPosition, i) => ({
        id: `note-${i}`,
        staffPosition,
      }));
      const input = {
        ...blankDocument(),
        neumes: [{ id: 'neume', kind, notes }],
      };
      expect(
        decodeDocument(encodeDocument(decodeDocument(envelope(input)))),
      ).toEqual(input);
      expect(() =>
        decodeDocument(
          envelope({
            ...input,
            neumes: [
              {
                id: 'neume',
                kind,
                notes: [...notes, { id: 'extra', staffPosition: 10 }],
              },
            ],
          }),
        ),
      ).toThrow();
    },
  );
  it.each([Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])(
    'preserves safe staff position %s exactly',
    (position) => {
      const document = {
        ...blankDocument(),
        neumes: [
          {
            id: 'n',
            kind: 'punctum',
            notes: [{ id: 'note', staffPosition: position }],
          },
        ],
      };
      expect(
        decodeDocument(encodeDocument(decodeDocument(envelope(document)))),
      ).toEqual(document);
    },
  );
  it.each([
    Number.MIN_SAFE_INTEGER - 1,
    Number.MAX_SAFE_INTEGER + 1,
    1e100,
    -1e100,
  ])(
    'rejects unsafe staff position %s without rounding or coercion',
    (position) => {
      const document = {
        ...blankDocument(),
        neumes: [
          {
            id: 'n',
            kind: 'punctum',
            notes: [{ id: 'note', staffPosition: position }],
          },
        ],
      };
      expect(() => decodeDocument(envelope(document))).toThrow('safe integers');
    },
  );
  it('preserves complete semantic values, IDs, order and layout including an empty score', () => {
    const score = specimen();
    const first = score.syllables[0];
    if (first) first.alignment = { start: 0, end: 1 };
    for (const input of [score, blankDocument()]) {
      const decoded = decodeDocument(envelope(input));
      expect(decodeDocument(encodeDocument(decoded))).toEqual(input);
      expect(layoutChant(decoded)).toEqual(layoutChant(input));
    }
  });
  it.each([
    (d: ReturnType<typeof specimen>) => ({ ...d, neumes: null }),
    (d: ReturnType<typeof specimen>) => ({ ...d, title: 3 }),
    (d: ReturnType<typeof specimen>) => ({ ...d, lyricLanguage: 'auto' }),
    (d: ReturnType<typeof specimen>) => ({ ...d, layout: {} }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      clef: { type: 'x', staffLine: 3 },
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      clef: { type: 'c', staffLine: 0 },
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      clef: { type: 'c', staffLine: 3, x: 1 },
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      neumes: [{ id: 'n', kind: 'punctum', notes: [] }],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      neumes: [{ id: 'n', kind: 'unknown', notes: [] }],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      neumes: [
        { id: 'n', kind: 'punctum', notes: [{ id: 'n', staffPosition: 2 }] },
      ],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      neumes: [
        {
          id: 'n',
          kind: 'podatus',
          notes: [
            { id: 'a', staffPosition: 2 },
            { id: 'b', staffPosition: 1 },
          ],
        },
      ],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      neumes: [
        { id: 'n', kind: 'punctum', notes: [{ id: 'a', staffPosition: 1.5 }] },
      ],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      neumes: [
        {
          id: 'n',
          kind: 'punctum',
          notes: [{ id: 'a', staffPosition: Infinity }],
        },
      ],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      syllables: [{ ...d.syllables[0], startsAtNeumeId: 'missing' }],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      syllables: [{ ...d.syllables[0], text: 'two words' }],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      syllables: [{ ...d.syllables[0], boundaryBefore: 'continuation' }],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      syllables: [{ ...d.syllables[0], alignment: { start: 0, end: 999 } }],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      syllables: [
        ...d.syllables,
        { ...d.syllables[0], id: 'duplicate-anchor' },
      ],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      divisions: [{ id: 'division', kind: 'maior', beforeNeumeId: 'missing' }],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      clefChanges: [
        {
          id: 'division',
          clef: { type: 'c', staffLine: 3 },
          beforeNeumeId: null,
          beforeDivisionId: null,
        },
      ],
    }),
    (d: ReturnType<typeof specimen>) => ({
      ...d,
      clefChanges: [
        {
          id: 'change',
          clef: { type: 'c', staffLine: 3 },
          beforeNeumeId: null,
          beforeDivisionId: 'missing',
        },
      ],
    }),
  ])('rejects malformed semantic structures %#', (mutate) => {
    expect(() => decodeDocument(envelope(mutate(specimen())))).toThrow();
  });
  it('rejects broken, future, foreign and oversized envelopes', () => {
    for (const text of [
      '{',
      '{}',
      envelope(blankDocument()).replace('"version":1', '"version":5'),
      envelope(blankDocument()).replace('gregorian-chant-editor', 'foreign'),
      ' '.repeat(maximumDocumentBytes + 1),
      envelope({
        ...blankDocument(),
        title: 'é'.repeat(maximumDocumentBytes / 2),
      }),
    ])
      expect(() => decodeDocument(text)).toThrow();
  });
  it('uses a bounded safe filename', () => {
    expect(documentFilename('../Salve / Regina!?')).toBe(
      'Salve-Regina.chant.json',
    );
    expect(documentFilename('...')).toBe('untitled.chant.json');
  });
});
