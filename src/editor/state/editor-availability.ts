import type { EditorSession } from './editor-session';
import { isDirtyLyricEntry } from './lyric-entry';

/**
 * Presentation availability: whether the editor shell offers or enables a
 * control in the current session mode.
 *
 * These rules are presentation only. They never authorize a transition:
 * `reduceEditorSession` keeps its own guards and stays the only transition
 * authority. A control that is enabled here may still be refused or ignored by
 * the reducer.
 *
 * Several rules look alike but differ on purpose. Each comment says how a rule
 * differs from its neighbours. Keep each condition exact; do not merge rules
 * into one universal "blocked" check.
 *
 * Single-field checks (for example `Boolean(session.clefTransaction)` for the
 * keyboard clef-placement button) stay inline at their controls, because a
 * name would add nothing to the field. Clipboard availability is
 * `clipboardBlocked` in `editor-session.ts`, because the reducer shares it.
 */

/**
 * A lyric move, a history prompt or a clef transaction is in progress.
 *
 * Used directly by the notation palette (tool changes), the initial-clef
 * fieldset and the division controls. Each of these waits for the mode to end.
 * Lyric entry and accidental placement do not block them.
 */
export function exclusiveModeActive(session: EditorSession): boolean {
  return Boolean(
    session.lyricMove || session.pendingHistory || session.clefTransaction,
  );
}

/**
 * The Lyrics and Insert buttons. Same as `exclusiveModeActive`, but they also
 * need a single target, so a passage (neume-range) selection disables them.
 */
export function entryTargetingAvailable(session: EditorSession): boolean {
  return (
    session.selection.kind !== 'neume-range' && !exclusiveModeActive(session)
  );
}

/**
 * The lyric-language select. Only a lyric move or a history prompt disables
 * it. Changing the language preserves a dirty lyric draft, so lyric entry
 * stays allowed. Unlike `exclusiveModeActive`, an open clef transaction does
 * not disable it; the reducer's clef phase ignores the edit instead.
 */
export function lyricLanguageBlocked(session: EditorSession): boolean {
  return Boolean(session.lyricMove || session.pendingHistory);
}

/**
 * Title, New, Open, Reload and the other document controls. These are the
 * broadest rule. Beyond `exclusiveModeActive`, a dirty lyric draft (including
 * lyric recovery) or an accidental placement also disables them. Replacing or
 * retitling the document would otherwise discard or interrupt that unfinished
 * work. Clean lyric entry does not disable them.
 */
export function documentControlsBlocked(session: EditorSession): boolean {
  return Boolean(
    isDirtyLyricEntry(session.lyrics) ||
    session.clefTransaction ||
    session.lyricMove ||
    session.pendingHistory ||
    session.accidentalTargetId,
  );
}

/**
 * Whether the Pitch handling fieldset is shown: while placing a clef,
 * selecting an authored clef, or editing a clef draft.
 */
export function pitchHandlingShown(session: EditorSession): boolean {
  return Boolean(
    session.activeTool.kind === 'place-clef' ||
    session.selection.kind === 'clef-change' ||
    session.clefTransaction,
  );
}

/**
 * Whether the shown Pitch handling fieldset is disabled. Unlike
 * `exclusiveModeActive`, an open clef draft keeps it enabled, because the
 * policy applies to that draft. Only a transaction with a candidate (deletion
 * confirmation) disables it.
 */
export function pitchHandlingBlocked(session: EditorSession): boolean {
  return Boolean(
    session.clefTransaction?.candidate ||
    session.pendingHistory ||
    session.lyricMove,
  );
}

/**
 * The action bar's Undo or Redo button. It needs history in that direction,
 * and only a lyric move disables it, because the move owns its own commit and
 * cancel. In every other mode the reducer decides how a history request is
 * answered (for example by opening the history prompt for a dirty draft). The
 * keyboard shortcuts check only the history itself.
 */
export function historyButtonAvailable(
  session: EditorSession,
  direction: 'undo' | 'redo',
): boolean {
  const steps =
    direction === 'undo' ? session.history.past : session.history.future;
  return steps.length > 0 && !session.lyricMove;
}

/**
 * The note properties toolbar, given a selected note. It requires the Select
 * tool and is hidden by a history prompt, a lyric move or a clef transaction.
 * Unlike the whole-neume and accidental toolbars, lyric entry does not hide it.
 */
export function noteToolbarAllowed(session: EditorSession): boolean {
  return Boolean(
    session.activeTool.kind === 'select' &&
    !session.pendingHistory &&
    !session.lyricMove &&
    !session.clefTransaction,
  );
}

/** `noteToolbarAllowed`, also hidden during lyric entry. */
function selectToolOutsideLyricEntry(session: EditorSession): boolean {
  return noteToolbarAllowed(session) && !session.lyrics;
}

/**
 * The whole-neume appearance toolbar, given a selected Podatus or Clivis. Like
 * `noteToolbarAllowed`, but lyric entry also hides it.
 */
export function wholeNeumeToolbarAllowed(session: EditorSession): boolean {
  return selectToolOutsideLyricEntry(session);
}

/**
 * The accidental properties toolbar, given a selected accidental. The same
 * condition as `wholeNeumeToolbarAllowed`: lyric entry also hides it, so Tab
 * from a selected glyph keeps native focus navigation.
 */
export function accidentalToolbarAllowed(session: EditorSession): boolean {
  return selectToolOutsideLyricEntry(session);
}
