import { describe, expect, it } from 'vitest';
import { demoDocument } from '../../app/demo-document';
import {
  createChant,
  parseChant,
  serializeChant,
  chantFileFormat,
} from './chant-file';

const envelope = (document: unknown, version = 1) =>
  JSON.stringify({ format: chantFileFormat, version, document });
const firstNeume = demoDocument.neumes[0];
const firstSyllable = demoDocument.syllables[0];
describe('versioned chant files', () => {
  it('round trips semantic identity, editorial alignment, language, and empty scores', () => {
    const document = structuredClone(demoDocument);
    document.syllables[0].alignment = { start: 1, end: 2 };
    expect(parseChant(serializeChant(document))).toEqual(document);
    expect(parseChant(serializeChant(createChant()))).toEqual(createChant());
  });
  it.each([
    () => envelope(demoDocument, 2),
    () => envelope({ ...demoDocument, title: 'Title\u0000' }),
    () => envelope({ ...demoDocument, clef: { type: 'f', staffLine: 3 } }),
    () => envelope({ ...demoDocument, lyricLanguage: 'guess' }),
    () =>
      envelope({
        ...demoDocument,
        neumes: [
          { ...firstNeume, notes: [{ id: 'fractional', staffPosition: 0.5 }] },
        ],
      }),
    () =>
      envelope({
        ...demoDocument,
        neumes: [
          {
            id: 'wrong-pes',
            kind: 'podatus',
            notes: [
              { id: 'a', staffPosition: 2 },
              { id: 'b', staffPosition: 2 },
            ],
          },
        ],
      }),
    () =>
      envelope({
        ...demoDocument,
        syllables: [{ ...firstSyllable, startsAtNeumeId: 'missing' }],
      }),
    () =>
      envelope({
        ...demoDocument,
        syllables: [firstSyllable, { ...firstSyllable, id: 'another' }],
      }),
    () =>
      envelope({
        ...demoDocument,
        syllables: [{ ...firstSyllable, alignment: { start: -1, end: 2 } }],
      }),
    () =>
      envelope({
        ...demoDocument,
        syllables: [{ ...firstSyllable, id: firstNeume.id }],
      }),
    () =>
      envelope({
        ...demoDocument,
        syllables: [{ ...firstSyllable, text: 'two words' }],
      }),
    () =>
      envelope({ ...demoDocument, neumes: [{ ...firstNeume, notes: [null] }] }),
  ])(
    'rejects malformed or unsupported data before replacing any score',
    (invalid) => {
      const before = serializeChant(demoDocument);
      expect(() => parseChant(invalid())).toThrow();
      expect(serializeChant(demoDocument)).toBe(before);
    },
  );
  it('rejects malformed JSON and oversized files', () => {
    expect(() => parseChant('not json')).toThrow('valid JSON');
    expect(() => parseChant(' '.repeat(2_000_001))).toThrow('2 MB');
  });
});
