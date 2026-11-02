import { expect, it } from 'vitest';
import { assertRenderedContinuations } from '../../../docs/verification/word-composition/assert-rendered-corpus.ts';
const boundary = {
  beforeId: 'a',
  afterId: 'b',
  before: 'di',
  after: 'ti',
  kind: 'hyphen',
  gap: 12,
};
const system = {
  index: 0,
  lyrics: [
    { id: 'a', left: 0, right: 20 },
    { id: 'b', left: 32, right: 45 },
  ],
  marks: [{ left: 23, right: 29, outgoing: false }],
};
it('requires a displayed mark for each separated continuation', () => {
  expect(() => assertRenderedContinuations([boundary], [system])).not.toThrow();
  expect(() =>
    assertRenderedContinuations([boundary], [{ ...system, marks: [] }]),
  ).toThrow('required rendered continuation');
  expect(() =>
    assertRenderedContinuations(
      [boundary],
      [{ ...system, marks: [{ ...system.marks[0], outgoing: true }] }],
    ),
  ).toThrow('required rendered continuation');
});
it('rejects extra marks and marks on a different system', () => {
  expect(() =>
    assertRenderedContinuations([{ ...boundary, kind: 'join' }], [system]),
  ).toThrow('unexpected');
  expect(() =>
    assertRenderedContinuations(
      [boundary],
      [
        { ...system, marks: [] },
        { index: 1, lyrics: [], marks: system.marks },
      ],
    ),
  ).toThrow('required rendered continuation');
});
it('requires a source-system outgoing mark when lyrics move to different systems', () => {
  const source = {
    ...system,
    lyrics: [system.lyrics[0]],
    marks: [{ left: 30, right: 36, outgoing: true }],
  };
  const next = { index: 1, lyrics: [system.lyrics[1]], marks: [] };
  expect(() =>
    assertRenderedContinuations(
      [{ ...boundary, kind: 'outgoing', gap: null }],
      [source, next],
    ),
  ).not.toThrow();
  expect(() =>
    assertRenderedContinuations(
      [{ ...boundary, kind: 'outgoing', gap: null }],
      [{ ...source, marks: [] }, next],
    ),
  ).toThrow('required rendered continuation');
});
