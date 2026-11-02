import type { ChantDocument } from '../domain/chant-document';

/** Derived performance data, never part of a saved chant document. */
export interface PerformanceNote {
  noteId: string;
  neumeId: string;
  midi: number;
  frequency: number;
  start: number;
  duration: number;
}

export interface Performance {
  notes: readonly PerformanceNote[];
  duration: number;
}

const naturalSemitones = [0, 2, 4, 5, 7, 9, 11] as const;

/**
 * A deterministic listening aid: one equal-duration event per written note.
 * The C-clef line identifies middle C (MIDI 60); staff positions are diatonic.
 * Tuning is A4 = 440 Hz in equal temperament, without chant-rhythm inference.
 */
export function createPerformance(
  document: ChantDocument,
  tempo = 100,
  transpose = 0,
): Performance {
  if (!Number.isFinite(tempo) || tempo < 30 || tempo > 240) {
    throw new Error(
      'Playback tempo must be between 30 and 240 notes per minute.',
    );
  }
  if (!Number.isInteger(transpose) || transpose < -24 || transpose > 24) {
    throw new Error(
      'Playback transposition must be an integer from −24 to 24 semitones.',
    );
  }
  if (
    document.clef.type !== 'c' ||
    ![1, 2, 3, 4].includes(document.clef.staffLine)
  ) {
    throw new Error('Playback requires a C clef on staff line 1–4.');
  }

  const clefPosition = (document.clef.staffLine - 1) * 2;
  const duration = 60 / tempo;
  const notes: PerformanceNote[] = [];

  for (const neume of document.neumes) {
    for (const note of neume.notes) {
      if (!Number.isSafeInteger(note.staffPosition)) {
        throw new Error('Playback requires integer staff positions.');
      }
      const stepsFromC = note.staffPosition - clefPosition;
      const octave = Math.floor(stepsFromC / 7);
      const scaleStep = stepsFromC - octave * 7;
      const midi = 60 + octave * 12 + naturalSemitones[scaleStep] + transpose;
      if (midi < 21 || midi > 108) {
        throw new Error(
          'A note is outside the playback range A0–C8. Change its pitch or playback transposition.',
        );
      }
      notes.push({
        noteId: note.id,
        neumeId: neume.id,
        midi,
        frequency: 440 * 2 ** ((midi - 69) / 12),
        start: notes.length * duration,
        duration,
      });
    }
  }

  return { notes, duration: notes.length * duration };
}
