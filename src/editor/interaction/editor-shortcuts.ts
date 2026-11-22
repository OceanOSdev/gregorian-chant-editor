import { getClipboardShortcut } from './clipboard-shortcuts';
import { isLyricEntryShortcut } from './lyric-entry-keyboard';
import { getNotationShortcut } from './palette-navigation';

/**
 * Pure key-to-intent decisions for `ChantEditor`'s own keyboard listeners.
 *
 * Each classifier serves exactly one listener and reproduces its existing
 * conditions. The listeners keep their attachment points, call
 * `preventDefault`/`stopPropagation`, read the DOM and dispatch; these
 * functions only decide. A non-null result always means "this listener owns
 * the key". See the keyboard precedence table in
 * `docs/editor-interactions.md` for how the listeners relate.
 */

/** The facts these classifiers read, as found on a native `KeyboardEvent`. */
export interface EditorKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
}

/** An owned key held down: claimed so it cannot reach the browser, not dispatched again. */
export interface HeldRepeat {
  type: 'held-repeat';
}

const heldRepeat: HeldRepeat = { type: 'held-repeat' };

/** Escape without Ctrl, Cmd or Alt. Shift and key repeat are both accepted. */
function isUnmodifiedEscape(event: EditorKeyEvent) {
  return (
    event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

// Document capture listener -------------------------------------------------

export interface PendingTransactionMode {
  accidentalPlacement: boolean;
  clefTransaction: boolean;
}

export type PendingTransactionCancel =
  'cancel-accidental-placement' | 'cancel-clef-change';

/**
 * Escape cancels a pending accidental placement, else a clef transaction,
 * before any element, lyric input or later editor listener sees the key. Only
 * the playback options' window-capture dismissal runs earlier. It deliberately
 * ignores `defaultPrevented` and editable targets, and accepts held repeats, so
 * a pending transaction can be abandoned from any focus.
 */
export function getPendingTransactionCancel(
  event: EditorKeyEvent,
  mode: PendingTransactionMode,
): PendingTransactionCancel | null {
  if (event.isComposing || !isUnmodifiedEscape(event)) return null;
  if (mode.accidentalPlacement) return 'cancel-accidental-placement';
  return mode.clefTransaction ? 'cancel-clef-change' : null;
}

// `<main>` capture handler -----------------------------------------------

/** Structurally the lyric-move session actions this handler can dispatch. */
export type LyricMoveKeyAction =
  | { type: 'cancel' }
  | { type: 'commit' }
  | { type: 'browse'; direction: -1 | 1 };

/**
 * While a lyric move is active, Escape cancels, Left/Right browse targets and
 * Enter on the score commits, ahead of every score control and the document
 * bubble listener. Shift is accepted; `defaultPrevented` and editable targets
 * are not consulted, so the move also owns these keys inside its own controls. Enter elsewhere (for example on Move syllable's own
 * buttons) keeps its native activation.
 */
export function getLyricMoveKeyIntent(
  event: Omit<EditorKeyEvent, 'defaultPrevented'>,
  lyricMoveActive: boolean,
  scoreFocused: boolean,
): LyricMoveKeyAction | HeldRepeat | null {
  if (
    !lyricMoveActive ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return null;
  const action: LyricMoveKeyAction | null =
    event.key === 'Escape'
      ? { type: 'cancel' }
      : event.key === 'ArrowLeft'
        ? { type: 'browse', direction: -1 }
        : event.key === 'ArrowRight'
          ? { type: 'browse', direction: 1 }
          : event.key === 'Enter' && scoreFocused
            ? { type: 'commit' }
            : null;
  if (!action) return null;
  return event.repeat ? heldRepeat : action;
}

// Document bubble listener -------------------------------------------------

/** Where the key landed, read from the DOM by the listener. */
export interface DocumentKeyScope {
  /** An input, textarea, select or contenteditable element. */
  editableTarget: boolean;
  /** Inside `.chant-editor`, or nothing focused. */
  clipboardScope: boolean;
  /** A non-empty native text selection exists. */
  nativeTextSelection: boolean;
  /** Inside the score SVG. */
  scoreFocused: boolean;
  /** Inside the score or a `[data-notation-shortcuts]` region. */
  notationFocused: boolean;
}

/** Session facts the document bubble listener reads. */
export interface DocumentKeyMode {
  placing: boolean;
  placingClef: boolean;
  lyricEntryOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

/** What Escape does when nothing earlier claimed it. */
export type DocumentEscapeEffect =
  'select-tool' | 'cancel-lyrics' | 'clear-selection';

export type DocumentShortcut =
  | HeldRepeat
  | { type: 'copy' }
  | { type: 'paste' }
  | { type: 'start-lyrics' }
  | { type: 'insert' }
  | { type: 'focus-palette' }
  | { type: 'escape'; effect: DocumentEscapeEffect }
  | { type: 'undo' }
  | { type: 'redo' };

/**
 * Escape reaches this listener only when no transaction, lyric move or focused
 * control claimed it. Clef placement returns to Select even with lyrics open;
 * otherwise an open lyric draft is cancelled before any tool or selection
 * change.
 */
function getDocumentEscapeEffect(mode: DocumentKeyMode): DocumentEscapeEffect {
  if (mode.placingClef) return 'select-tool';
  if (mode.lyricEntryOpen) return 'cancel-lyrics';
  return mode.placing ? 'select-tool' : 'clear-selection';
}

/**
 * The editor-wide shortcuts, in priority order: clipboard, L (Lyrics), I/T
 * (notation), Escape, then Undo/Redo. Keys already handled
 * (`defaultPrevented`), composition and editable targets keep their native
 * behaviour. A held clipboard key is claimed without repeating the command;
 * Undo/Redo repeat while held.
 */
export function getDocumentShortcut(
  event: EditorKeyEvent,
  scope: DocumentKeyScope,
  mode: DocumentKeyMode,
): DocumentShortcut | null {
  if (event.defaultPrevented || event.isComposing || scope.editableTarget)
    return null;
  const clipboard = getClipboardShortcut(
    event,
    scope.clipboardScope,
    scope.nativeTextSelection,
  );
  if (clipboard) return event.repeat ? heldRepeat : { type: clipboard };
  if (isLyricEntryShortcut(event, scope.scoreFocused, mode.placing))
    return { type: 'start-lyrics' };
  const notation = getNotationShortcut(event, scope.notationFocused);
  if (notation) return { type: notation };
  if (isUnmodifiedEscape(event))
    return { type: 'escape', effect: getDocumentEscapeEffect(mode) };
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;
  if (command && key === 'z' && !event.shiftKey && mode.canUndo)
    return { type: 'undo' };
  if (
    ((command && key === 'z' && event.shiftKey) ||
      (event.ctrlKey && key === 'y')) &&
    mode.canRedo
  )
    return { type: 'redo' };
  return null;
}
