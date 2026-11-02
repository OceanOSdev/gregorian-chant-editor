import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type StaffLine,
} from '../domain/chant-document';
import { demoDocument } from '../../app/demo-document';
import { createPerformance } from './performance';

function score(
  positions: readonly number[],
  staffLine: StaffLine = 3,
): ChantDocument {
  return {
    title: 'Playback test',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine },
    syllables: [],
    neumes: positions.map((position, i) => ({
      id: `neume-${i}`,
      kind: 'punctum',
      notes: [{ id: `note-${i}`, staffPosition: staffPosition(position) }],
    })),
  };
}

describe('equal-note performance', () => {
  it.each([1, 2, 3, 4] as const)(
    'maps the C clef on line %i to middle C',
    (line) => {
      const performance = createPerformance(score([(line - 1) * 2], line));
      expect(performance.notes[0].midi).toBe(60);
      expect(performance.notes[0].frequency).toBeCloseTo(261.625565, 5);
    },
  );

  it('uses natural diatonic pitches above and below the clef across octaves', () => {
    const positions = [
      -11, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18,
    ];
    const performance = createPerformance(score(positions));
    expect(performance.notes.map((note) => note.midi)).toEqual([
      35, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 84,
    ]);
    expect(performance.notes.find((note) => note.midi === 69)?.frequency).toBe(
      440,
    );
  });

  it('flattens all seven neume kinds in semantic order and preserves identities', () => {
    const before = structuredClone(demoDocument);
    const performance = createPerformance(demoDocument, 120);
    const expected = demoDocument.neumes.flatMap((neume) =>
      neume.notes.map((note) => ({ noteId: note.id, neumeId: neume.id })),
    );
    expect(performance.notes).toHaveLength(17);
    expect(
      performance.notes.map(({ noteId, neumeId }) => ({ noteId, neumeId })),
    ).toEqual(expected);
    expect(performance.notes.map((note) => note.start)).toEqual(
      Array.from({ length: 17 }, (_, i) => i * 0.5),
    );
    expect(performance.notes.every((note) => note.duration === 0.5)).toBe(true);
    expect(performance.duration).toBe(8.5);
    expect(demoDocument).toEqual(before);
  });

  it('keeps repeated notes as separate events and scales timing independently of pitch', () => {
    const document = score([4, 4, 4]);
    const slow = createPerformance(document, 60);
    const fast = createPerformance(document, 240);
    expect(slow.notes.map((note) => note.midi)).toEqual([60, 60, 60]);
    expect(slow.notes.map((note) => note.start)).toEqual([0, 1, 2]);
    expect(slow.duration).toBe(3);
    expect(fast.duration).toBe(0.75);
    expect(fast.notes.map((note) => note.frequency)).toEqual(
      slow.notes.map((note) => note.frequency),
    );
  });

  it('transposes semitones without altering written pitches or event timing', () => {
    const document = score([4, 6]);
    const before = structuredClone(document);
    const plain = createPerformance(document);
    const shifted = createPerformance(document, 100, -12);
    expect(shifted.notes.map((note) => note.midi)).toEqual([48, 52]);
    expect(shifted.notes[0].frequency).toBeCloseTo(
      plain.notes[0].frequency / 2,
    );
    expect(shifted.notes.map((note) => note.start)).toEqual(
      plain.notes.map((note) => note.start),
    );
    expect(document).toEqual(before);
  });

  it('returns an empty performance without fabricating sound for an empty score', () => {
    expect(createPerformance(score([]))).toEqual({ notes: [], duration: 0 });
  });

  it('accepts supported tempo, transposition and audible range endpoints', () => {
    expect(createPerformance(score([4]), 30, -24).notes[0].midi).toBe(36);
    expect(createPerformance(score([4]), 240, 24).notes[0].midi).toBe(84);
    expect(
      createPerformance(score([-19, 32])).notes.map((note) => note.midi),
    ).toEqual([21, 108]);
  });

  it.each([NaN, Infinity, -Infinity, 0, 29.99, 240.01])(
    'rejects invalid tempo %s',
    (tempo) => {
      expect(() => createPerformance(score([4]), tempo)).toThrow('tempo');
    },
  );

  it.each([NaN, Infinity, -Infinity, -25, 25, 0.5])(
    'rejects invalid transposition %s',
    (transpose) => {
      expect(() => createPerformance(score([4]), 100, transpose)).toThrow(
        'transposition',
      );
    },
  );

  it.each([-20, 33])(
    'rejects notes beyond the audible range instead of clamping pitch %s',
    (position) => {
      expect(() => createPerformance(score([position]))).toThrow(
        'playback range',
      );
    },
  );

  it('rejects malformed runtime pitches and clefs without changing the input', () => {
    const badPitch = score([4]);
    Reflect.set(badPitch.neumes[0].notes[0], 'staffPosition', NaN);
    expect(() => createPerformance(badPitch)).toThrow(
      'integer staff positions',
    );
    expect(Number.isNaN(badPitch.neumes[0].notes[0].staffPosition)).toBe(true);
    const badClef = score([4]);
    Reflect.set(badClef.clef, 'staffLine', 5);
    expect(() => createPerformance(badClef)).toThrow('C clef');
  });
});
