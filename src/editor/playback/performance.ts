/**
 * Playback-only interpretation of a chant (ADR 0006): an ordered, timed list
 * of sounding notes. Nothing here is stored in `ChantDocument`, and nothing
 * depends on React, the DOM, layout or the Web Audio API.
 */
export interface PerformanceNote {
  noteId: string;
  neumeId: string;
  /** Relative diatonic degree from `resolveEffectivePitches` (0 = do). */
  degree: number;
  alteration: -1 | 0;
  /** Audition pitch under the playback register convention below. */
  midiNote: number;
  startSeconds: number;
  durationSeconds: number;
}

export interface Performance {
  /** Sounding notes in semantic score order, one per authored note. */
  notes: readonly PerformanceNote[];
  durationSeconds: number;
}

export type PerformanceResult =
  | { ok: true; performance: Performance }
  | { ok: false; reason: 'invalid-score' }
  | { ok: false; reason: 'pitch-out-of-range'; noteId: string };

/**
 * Playback register convention: relative degree 0 (do) sounds as C4, MIDI 60.
 * The notation fixes only relative pitch; this is a stable audition register,
 * not a claim about the chant's absolute pitch.
 */
export const playbackReferenceMidiNote = 60;

/** Semitones above do for each natural degree of the diatonic lattice. */
const naturalSemitones = [0, 2, 4, 5, 7, 9, 11] as const;

/** Lowest and highest MIDI notes; anything outside is not auditioned. */
const playableMidiRange = { lowest: 0, highest: 127 } as const;

export function playbackMidiNote(degree: number, alteration: -1 | 0): number {
  // Floor division keeps negative degrees in the octave below do.
  const octave = Math.floor(degree / 7);
  const step = degree - octave * 7;
  return (
    playbackReferenceMidiNote +
    octave * 12 +
    naturalSemitones[step] +
    alteration
  );
}

export function isPlayableMidiNote(midiNote: number): boolean {
  return (
    Number.isSafeInteger(midiNote) &&
    midiNote >= playableMidiRange.lowest &&
    midiNote <= playableMidiRange.highest
  );
}
