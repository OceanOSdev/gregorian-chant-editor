import {
  hasValidAccidentals,
  resolveEffectivePitches,
} from '../domain/accidentals';
import type { ChantDocument, DivisionKind } from '../domain/chant-document';
import { deriveScoreOrder } from '../domain/divisions';
import { getMoraScope } from '../domain/mora';
import {
  isPlayableMidiNote,
  playbackMidiNote,
  type PerformanceNote,
  type PerformanceResult,
} from './performance';

/** Length of one unmarked note; every other duration is a multiple of it. */
export const baseNoteSeconds = 0.4;

/** A note marked with a mora (`mora: 1`) lasts this many base notes. */
export const moraNoteLengths = 2;

/**
 * Silence after a division, in base note lengths. A playback-only
 * proofreading aid that grows with the division's weight; not a claim about
 * historical performance practice.
 */
export const divisionPauseNoteLengths = {
  minima: 0.5,
  minor: 1,
  maior: 2,
  finalis: 3,
} as const satisfies Record<DivisionKind, number>;

/**
 * Proofreading Playback (ADR 0006): one event per authored note, in semantic
 * score order. Each note lasts one base note, or `moraNoteLengths` when the
 * note itself carries a mora. Marks belong to individual notes (ADR 0018), so
 * an auctum duplex lengthens each of its two marked notes and nothing else.
 *
 * Divisions between notes add silence (`divisionPauseNoteLengths`); several
 * divisions at one boundary pause for the longest, and divisions before the
 * first or after the last note add nothing. Clefs add no time. Episemata,
 * liquescence, note forms and lyrics are deliberately ignored.
 *
 * Pitch and accidental meaning come entirely from `resolveEffectivePitches`,
 * and timing walks the same `deriveScoreOrder`, so clef changes, divisions
 * and B flat/natural scopes match the editor.
 */
export function interpretProofreadingPlayback(
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
  // Time in base note lengths; a pending pause applies only before a later note.
  let time = 0;
  let pendingPause = 0;
  for (const item of order) {
    if (item.type === 'division') {
      if (notes.length)
        pendingPause = Math.max(
          pendingPause,
          divisionPauseNoteLengths[item.entity.kind],
        );
      continue;
    }
    if (item.type !== 'neume') continue;
    // Unsupported mora data (for example `mora: 2`) is rejected, never coerced.
    if (getMoraScope(item.entity) === null)
      return { ok: false, reason: 'invalid-score' };
    for (const note of item.entity.notes) {
      const pitch = pitches.get(note.id);
      if (!pitch) return { ok: false, reason: 'invalid-score' };
      const midiNote = playbackMidiNote(pitch.degree, pitch.alteration);
      if (!isPlayableMidiNote(midiNote))
        return { ok: false, reason: 'pitch-out-of-range', noteId: note.id };
      const length = note.mora === 1 ? moraNoteLengths : 1;
      time += pendingPause;
      pendingPause = 0;
      notes.push({
        noteId: note.id,
        neumeId: item.entity.id,
        degree: pitch.degree,
        alteration: pitch.alteration,
        midiNote,
        startSeconds: time * baseNoteSeconds,
        durationSeconds: length * baseNoteSeconds,
      });
      time += length;
    }
  }
  return {
    ok: true,
    performance: { notes, durationSeconds: time * baseNoteSeconds },
  };
}
