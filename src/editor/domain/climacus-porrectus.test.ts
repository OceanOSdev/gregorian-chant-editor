import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ClimacusNeume,
  type PorrectusNeume,
} from './chant-document';
import {
  countNotes,
  findNote,
  isValidNeume,
  normalizeNeumeAfterNoteDeletion,
} from './neume';

function neume(
  kind: 'climacus' | 'porrectus',
  pitches: readonly [number, number, number],
): ClimacusNeume | PorrectusNeume {
  return {
    id: 'neume',
    kind,

    notes: [
      { id: 'first', staffPosition: staffPosition(pitches[0]) },
      { id: 'second', staffPosition: staffPosition(pitches[1]) },
      { id: 'third', staffPosition: staffPosition(pitches[2]) },
    ],
  };
}

describe('Climacus and Porrectus domain', () => {
  it.each([
    { kind: 'climacus', pitches: [6, 3, -1] },
    { kind: 'porrectus', pitches: [4, 0, 2] },
    { kind: 'porrectus', pitches: [4, 0, 4] },
    { kind: 'porrectus', pitches: [4, 0, 6] },
  ] as const)('accepts $kind $pitches', ({ kind, pitches }) => {
    expect(isValidNeume(neume(kind, pitches))).toBe(true);
  });
  it.each([
    { kind: 'climacus', pitches: [4, 4, 1] },
    { kind: 'climacus', pitches: [4, 2, 2] },
    { kind: 'climacus', pitches: [2, 4, 1] },
    { kind: 'climacus', pitches: [4, 1, 2] },
    { kind: 'porrectus', pitches: [4, 4, 5] },
    { kind: 'porrectus', pitches: [4, 2, 2] },
    { kind: 'porrectus', pitches: [2, 4, 5] },
    { kind: 'porrectus', pitches: [4, 2, 1] },
  ] as const)('rejects $kind $pitches', ({ kind, pitches }) => {
    expect(isValidNeume(neume(kind, pitches))).toBe(false);
  });
  it.each(['climacus', 'porrectus'] as const)(
    'checks runtime cardinality and missing notes of %s',
    (kind) => {
      const candidate = neume(
        kind,
        kind === 'climacus' ? [4, 2, 0] : [4, 0, 2],
      );
      candidate.notes.pop();
      expect(isValidNeume(candidate)).toBe(false);
      candidate.notes.push({ id: 'third', staffPosition: staffPosition(0) });
      Reflect.deleteProperty(candidate.notes, '1');
      expect(isValidNeume(candidate)).toBe(false);
    },
  );
  it.each([
    { kind: 'climacus', pitches: [6, 3, 0], deleted: 0, result: 'clivis' },
    { kind: 'climacus', pitches: [6, 3, 0], deleted: 1, result: 'clivis' },
    { kind: 'climacus', pitches: [6, 3, 0], deleted: 2, result: 'clivis' },
    { kind: 'porrectus', pitches: [4, 0, 2], deleted: 0, result: 'podatus' },
    { kind: 'porrectus', pitches: [4, 0, 2], deleted: 1, result: 'clivis' },
    { kind: 'porrectus', pitches: [4, 0, 6], deleted: 1, result: 'podatus' },
    { kind: 'porrectus', pitches: [4, 0, 2], deleted: 2, result: 'clivis' },
  ] as const)(
    'normalizes $kind after deleting index $deleted to $result',
    ({ kind, pitches, deleted, result }) => {
      const original = neume(kind, pitches);
      const normalized = normalizeNeumeAfterNoteDeletion(
        original,
        original.notes[deleted].id,
      );
      expect(normalized?.kind).toBe(result);
      expect(normalized?.id).toBe(original.id);
      const survivors = original.notes.filter((_, index) => index !== deleted);
      expect(normalized?.notes).toEqual(survivors);
      survivors.forEach((note, index) =>
        expect(normalized?.notes[index]).toBe(note),
      );
      expect(normalized && isValidNeume(normalized)).toBe(true);
      expect(original.notes).toHaveLength(3);
    },
  );
  it('rejects deleting the middle of an equal-outer-pitch Porrectus', () => {
    const candidate = neume('porrectus', [4, 0, 4]);
    expect(normalizeNeumeAfterNoteDeletion(candidate, 'second')).toBe(
      candidate,
    );
  });
  it.each(['climacus', 'porrectus'] as const)(
    'looks up and counts every %s note',
    (kind) => {
      const candidate = neume(
        kind,
        kind === 'climacus' ? [4, 2, 0] : [4, 0, 2],
      );
      const document: ChantDocument = {
        title: '',
        clef: { type: 'c', staffLine: 3 },
        syllables: [],
        neumes: [candidate],
      };
      expect(countNotes(document.neumes)).toBe(3);
      candidate.notes.forEach((note, noteIndex) =>
        expect(findNote(document, note.id)).toEqual({
          neume: candidate,
          neumeIndex: 0,
          note,
          noteIndex,
        }),
      );
      expect(normalizeNeumeAfterNoteDeletion(candidate, 'missing')).toBe(
        candidate,
      );
    },
  );
});
