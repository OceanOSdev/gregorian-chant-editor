interface EditorActionBarProps {
  /** Visible copy of the last clipboard announcement, if any. */
  clipboardFeedback: string | null;
  /** Neume count of an active passage (range) selection, else null. */
  passageNeumeCount: number | null;
  /** Lyric entry is active; shown as the Lyrics button's pressed state. */
  lyricsActive: boolean;
  /** Lyrics and Insert need a single target and an idle session. */
  canStartLyrics: boolean;
  canInsert: boolean;
  /** Display name of the remembered entry that Insert (I) places. */
  insertName: string;
  canCopy: boolean;
  canPaste: boolean;
  /** Neumes on the in-app clipboard, or null when it is empty. */
  copiedNeumeCount: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onStartLyrics: () => void;
  onInsert: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * The editor action buttons beside the notation palette.
 *
 * A view only: the editor shell derives every permission and label from the
 * session and binds each callback to an existing session action, so keyboard
 * shortcuts and these buttons share one implementation.
 */
export function EditorActionBar({
  clipboardFeedback,
  passageNeumeCount,
  lyricsActive,
  canStartLyrics,
  canInsert,
  insertName,
  canCopy,
  canPaste,
  copiedNeumeCount,
  canUndo,
  canRedo,
  onStartLyrics,
  onInsert,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
}: EditorActionBarProps) {
  const passageStatusId =
    passageNeumeCount === null ? undefined : 'range-selection-status';
  return (
    <div className="editor-actions">
      {clipboardFeedback ? (
        // Visible copy of the live announcement; not itself live, so the
        // explanation is spoken once.
        <p id="clipboard-feedback" className="editor-clipboard-feedback">
          {clipboardFeedback}
        </p>
      ) : null}
      {passageNeumeCount === null ? null : (
        <span id="range-selection-status">
          {passageNeumeCount} neumes selected · Escape clears. Select one target
          for insertion or lyrics.
        </span>
      )}
      <button
        type="button"
        aria-pressed={lyricsActive}
        aria-describedby={passageStatusId}
        disabled={!canStartLyrics}
        aria-keyshortcuts="L"
        onClick={onStartLyrics}
      >
        Lyrics <kbd aria-hidden="true">L</kbd>
      </button>
      <button
        aria-describedby={passageStatusId}
        disabled={!canInsert}
        className="editor-insert"
        type="button"
        data-notation-shortcuts
        aria-keyshortcuts="I"
        onClick={onInsert}
      >
        Insert {insertName} <kbd aria-hidden="true">I</kbd>
      </button>
      <button
        type="button"
        className="editor-clipboard"
        data-notation-shortcuts
        aria-label="Copy selected music"
        aria-keyshortcuts="Control+C Meta+C"
        title="Copy the selected whole neume or passage (Ctrl/⌘+C)"
        disabled={!canCopy}
        onClick={onCopy}
      >
        Copy
      </button>
      <button
        type="button"
        className="editor-clipboard"
        data-notation-shortcuts
        aria-label={
          copiedNeumeCount === null
            ? 'Paste (clipboard empty)'
            : `Paste ${copiedNeumeCount} copied neume${copiedNeumeCount === 1 ? '' : 's'}`
        }
        aria-keyshortcuts="Control+V Meta+V"
        title="Paste copied music after the selection, or at the end (Ctrl/⌘+V)"
        aria-describedby={clipboardFeedback ? 'clipboard-feedback' : undefined}
        disabled={!canPaste}
        onClick={onPaste}
      >
        Paste
        {copiedNeumeCount === null ? null : (
          <span className="editor-clipboard__count" aria-hidden="true">
            {copiedNeumeCount}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label="Undo last edit"
        aria-keyshortcuts="Control+Z Meta+Z"
        disabled={!canUndo}
        onClick={onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        aria-label="Redo last undone edit"
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        disabled={!canRedo}
        onClick={onRedo}
      >
        Redo
      </button>
    </div>
  );
}
