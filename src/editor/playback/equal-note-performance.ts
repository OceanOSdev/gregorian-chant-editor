import {
  hasValidAccidentals,
  resolveEffectivePitches,
} from '../domain/accidentals';
import type { ChantDocument, DivisionKind } from '../domain/chant-document';
import { deriveScoreOrder } from '../domain/divisions';
import {
  isPlayableMidiNote,
  playbackMidiNote,
  type PerformanceNote,
  type PerformanceResult,
} from './performance';

/** Audio 1 sounds every note for the same length of time. */
export const equalNoteDurationSeconds = 0.4;

/**
 * Silence after a division, in note lengths. A playback-only proofreading
 * aid that grows with the division's weight; not a claim about historical
 * performance practice.
 */
export const divisionPauseNotes = {
  minima: 0.5,
  minor: 1,
  maior: 2,
  finalis: 3,
} as const satisfies Record<DivisionKind, number>;

/**
 * Equal Note Playback (ADR 0006): one event per authored note, in semantic
 * score order, each lasting `equalNoteDurationSeconds`. Divisions between
 * notes add silence (`divisionPauseNotes`); several divisions at one boundary
 * pause for the longest of them, and divisions before the first or after the
 * last note add nothing. Clefs add no time. Rhythmic marks (mora, episemata),
 * liquescence, note forms and lyrics are deliberately ignored.
 *
 * Pitch and accidental meaning come entirely from `resolveEffectivePitches`,
 * and timing walks the same `deriveScoreOrder`, so clef changes, divisions
 * and B flat/natural scopes match the editor.
 */
export function interpretEqualNotes(
  document: ChantDocument,
): PerformanceResult {
  if (!hasValidAccidentals(document))
    return { ok: false, reason: 'invalid-score' };
  const order = deriveScoreOrder(document);
  const pitches = resolveEffectivePitches(document);
  const authoredNoteCount = document.neumes.reduce(
    (count, neume) => count + neume.notes.length,
    0,
  );
  // Every authored note must resolve exactly once; never drop or invent one.
  if (!order || !pitches || pitches.size !== authoredNoteCount)
    return { ok: false, reason: 'invalid-score' };

  const notes: PerformanceNote[] = [];
  // Time in note lengths; a pending pause applies only before a later note.
  let time = 0;
  let pendingPause = 0;
  for (const item of order) {
    if (item.type === 'division') {
      if (notes.length)
        pendingPause = Math.max(
          pendingPause,
          divisionPauseNotes[item.entity.kind],
        );
      continue;
    }
    if (item.type !== 'neume') continue;
    for (const note of item.entity.notes) {
      const pitch = pitches.get(note.id);
      if (!pitch) return { ok: false, reason: 'invalid-score' };
      const midiNote = playbackMidiNote(pitch.degree, pitch.alteration);
      if (!isPlayableMidiNote(midiNote))
        return { ok: false, reason: 'pitch-out-of-range', noteId: note.id };
      time += pendingPause;
      pendingPause = 0;
      notes.push({
        noteId: note.id,
        neumeId: item.entity.id,
        degree: pitch.degree,
        alteration: pitch.alteration,
        midiNote,
        startSeconds: time * equalNoteDurationSeconds,
        durationSeconds: equalNoteDurationSeconds,
      });
      time += 1;
    }
  }
  return {
    ok: true,
    performance: { notes, durationSeconds: time * equalNoteDurationSeconds },
  };
}
