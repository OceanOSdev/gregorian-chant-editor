import type { ChantDocument } from '../domain/chant-document';
import { findNeume, findNote } from '../domain/neume';
import { resolveNeumeRange, type EditorSelection } from '../state/selection';
import type { Performance } from './performance';

/** Audition speeds offered in the UI; 1 is the Proofreading Playback rate. */
export const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5] as const;
export type PlaybackSpeed = (typeof playbackSpeeds)[number];

/**
 * The note playback should start on for an editor selection, or null for the
 * beginning. Only musical selections count: a note starts on itself (even
 * mid-neume), a neume on its first note, a range on the first note of its
 * earliest neume in score order, and a lyric syllable on the first note of the
 * neume it is anchored to. Everything else, and any stale ID, is null.
 */
export function resolvePlaybackStart(
  document: ChantDocument,
  selection: EditorSelection,
): string | null {
  switch (selection.kind) {
    case 'note':
      return findNote(document, selection.noteId)?.note.id ?? null;
    case 'neume':
      return findNeume(document, selection.neumeId)?.neume.notes[0].id ?? null;
    case 'neume-range':
      return (
        resolveNeumeRange(document, selection)?.neumes[0].notes[0].id ?? null
      );
    case 'syllable': {
      const syllable = document.syllables.find(
        (s) => s.id === selection.syllableId,
      );
      return syllable
        ? (findNeume(document, syllable.startsAtNeumeId)?.neume.notes[0].id ??
            null)
        : null;
    }
    default:
      return null;
  }
}

/**
 * The performance from `noteId` onward, rebased so that note starts at 0.
 * Nothing before it is kept, including any pause that preceded it; later
 * notes keep their exact relative timing. An unknown ID (or null) keeps the
 * whole performance.
 */
export function performanceFrom(
  performance: Performance,
  noteId: string | null,
): Performance {
  const index = performance.notes.findIndex((n) => n.noteId === noteId);
  if (index <= 0) return performance;
  const offset = performance.notes[index].startSeconds;
  return {
    notes: performance.notes.slice(index).map((note) => ({
      ...note,
      startSeconds: note.startSeconds - offset,
    })),
    durationSeconds: performance.durationSeconds - offset,
  };
}

/**
 * Plays the same events faster or slower: every start, duration and the
 * total are divided by `speed`, so mora lengths and division silences scale
 * together. Pitches and identities are unchanged.
 */
export function performanceAtSpeed(
  performance: Performance,
  speed: PlaybackSpeed,
): Performance {
  if (speed === 1) return performance;
  return {
    notes: performance.notes.map((note) => ({
      ...note,
      startSeconds: note.startSeconds / speed,
      durationSeconds: note.durationSeconds / speed,
    })),
    durationSeconds: performance.durationSeconds / speed,
  };
}

/**
 * The note sounding `elapsedSeconds` after the performance began, or null
 * before the first note, in a silence between events (such as a division
 * pause) and after the end. Event intervals are half-open, so at a shared
 * boundary the later note is the one sounding.
 */
export function activeNoteAt(
  performance: Performance,
  elapsedSeconds: number,
): string | null {
  const { notes } = performance;
  // Last note starting at or before the time (notes are in start order).
  let low = 0;
  let high = notes.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (notes[middle].startSeconds <= elapsedSeconds) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  if (found < 0) return null;
  const note = notes[found];
  return elapsedSeconds <
    note.startSeconds + note.durationSeconds + timelineToleranceSeconds
    ? note.noteId
    : null;
}

/**
 * Rebasing and scaling can leave floating-point gaps of ~1e-16 s between
 * back-to-back notes; this tolerance keeps the cue from blinking off there.
 */
const timelineToleranceSeconds = 1e-9;
