import type { ChantDocument } from '../domain/chant-document';
import { findNote } from '../domain/neume';
import type { LyricEntry } from '../state/lyric-entry';

/**
 * Pure decisions for what activating a score note means: lyric navigation or a
 * musical selection. `ChantEditor` maps each intent to its session action; the
 * reducer still validates the transition.
 *
 * A recovery entry keeps a dirty draft for the user to resolve, so note
 * activation never navigates it.
 */

/** Activation navigates lyrics only in an ordinary (non-recovery) entry. */
function navigatesLyrics(lyrics: LyricEntry | null) {
  return Boolean(lyrics) && lyrics?.kind !== 'recovery';
}

/** Activating a note (click, Enter or Space). */
export type NoteActivationIntent =
  { type: 'navigate-lyrics'; neumeId: string } | { type: 'select-note' };

/**
 * Lyric entry moves to the note's neume. Otherwise the note is selected, even
 * if it is not in the document (the reducer handles a stale ID).
 */
export function resolveNoteActivation(
  document: ChantDocument,
  lyrics: LyricEntry | null,
  noteId: string,
): NoteActivationIntent {
  const note = findNote(document, noteId);
  return navigatesLyrics(lyrics) && note
    ? { type: 'navigate-lyrics', neumeId: note.neume.id }
    : { type: 'select-note' };
}

/** Shift-activating a note (Shift+click, Shift+Enter or Shift+Space). */
export type NeumeForNoteActivationIntent =
  { type: 'navigate-lyrics'; neumeId: string } | { type: 'extend-selection' };

/**
 * Lyric entry moves to the note's neume instead of extending the musical
 * selection. A note missing from the document does nothing.
 */
export function resolveNeumeForNoteActivation(
  document: ChantDocument,
  lyrics: LyricEntry | null,
  noteId: string,
): NeumeForNoteActivationIntent | null {
  const note = findNote(document, noteId);
  if (!note) return null;
  return navigatesLyrics(lyrics)
    ? { type: 'navigate-lyrics', neumeId: note.neume.id }
    : { type: 'extend-selection' };
}
