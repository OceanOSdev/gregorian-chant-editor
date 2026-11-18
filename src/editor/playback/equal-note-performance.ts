import {
  hasValidAccidentals,
  resolveEffectivePitches,
} from '../domain/accidentals';
import type { ChantDocument } from '../domain/chant-document';
import {
  isPlayableMidiNote,
  playbackMidiNote,
  type PerformanceNote,
  type PerformanceResult,
} from './performance';

/** Audio 1 sounds every note for the same length of time. */
export const equalNoteDurationSeconds = 0.4;

/**
 * Equal Note Playback (ADR 0006): one event per authored note, in semantic
 * score order, each lasting `equalNoteDurationSeconds`. Clefs and divisions
 * are not sounded and add no time; rhythmic marks, liquescence, note forms
 * and lyrics are deliberately ignored.
 *
 * Pitch and accidental meaning come entirely from `resolveEffectivePitches`,
 * so clef changes and B flat/natural scopes match the editor.
 */
export function interpretEqualNotes(
  document: ChantDocument,
): PerformanceResult {
  if (!hasValidAccidentals(document))
    return { ok: false, reason: 'invalid-score' };
  const pitches = resolveEffectivePitches(document);
  const authoredNoteCount = document.neumes.reduce(
    (count, neume) => count + neume.notes.length,
    0,
  );
  // Every authored note must resolve exactly once; never drop or invent one.
  if (!pitches || pitches.size !== authoredNoteCount)
    return { ok: false, reason: 'invalid-score' };

  const notes: PerformanceNote[] = [];
  // Resolved pitches iterate in semantic score order.
  for (const pitch of pitches.values()) {
    const midiNote = playbackMidiNote(pitch.degree, pitch.alteration);
    if (!isPlayableMidiNote(midiNote))
      return { ok: false, reason: 'pitch-out-of-range', noteId: pitch.note.id };
    notes.push({
      noteId: pitch.note.id,
      neumeId: pitch.neume.id,
      degree: pitch.degree,
      alteration: pitch.alteration,
      midiNote,
      startSeconds: notes.length * equalNoteDurationSeconds,
      durationSeconds: equalNoteDurationSeconds,
    });
  }
  return {
    ok: true,
    performance: {
      notes,
      durationSeconds: notes.length * equalNoteDurationSeconds,
    },
  };
}
