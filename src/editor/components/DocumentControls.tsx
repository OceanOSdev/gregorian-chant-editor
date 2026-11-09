import { useId, useLayoutEffect, useRef, useState } from 'react';
import { updateDocumentTitle } from '../commands/update-document-title';
import type { ChantDocument } from '../domain/chant-document';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
  documentFilename,
  maximumDocumentBytes,
} from '../persistence/native-document';
import { errorMessage } from '../persistence/browser-document';
import './DocumentControls.css';

interface DocumentControlsProps {
  document: ChantDocument;
  blocked: boolean;
  status: string;
  savedLocally: boolean;
  needsRecovery: boolean;
  updateTitle: (title: string) => void;
  replace: (document: ChantDocument) => void;
  reload: () => void;
  replaceCache: () => void;
}
export function DocumentControls({
  document,
  blocked,
  status,
  savedLocally,
  needsRecovery,
  updateTitle,
  replace,
  reload,
  replaceCache,
}: DocumentControlsProps) {
  const picker = useRef<HTMLInputElement>(null);
  const titleButton = useRef<HTMLButtonElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const titleHelpId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  // Close the draft before committing or unmounting its input, so blur cannot
  // commit a second time after Enter, or commit after Escape canceled it.
  const pendingTitle = useRef<string | null>(null);
  const restoreTitleFocus = useRef(false);
  const editing = draft !== null;
  const titleDirty = editing && draft !== document.title;
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const disabled = blocked || reading;
  // Check the current pending workflow after asynchronous file reads.
  const latest = useRef({ blocked });
  latest.current = { blocked };

  useLayoutEffect(() => {
    if (editing) {
      titleInput.current?.focus();
      titleInput.current?.select();
    } else if (restoreTitleFocus.current) {
      restoreTitleFocus.current = false;
      titleButton.current?.focus();
    }
  }, [editing]);

  function finishTitle(commit: boolean, restoreFocus = false) {
    const title = pendingTitle.current;
    if (title === null) return null;
    pendingTitle.current = null;
    restoreTitleFocus.current = restoreFocus;
    setDraft(null);
    if (commit) updateTitle(title);
    return title;
  }

  async function importFile(file: File) {
    setReading(true);
    setError('');
    try {
      if (file.size > maximumDocumentBytes)
        throw new Error('File exceeds the 1 MiB limit.');
      const imported = decodeDocument(await file.text());
      if (latest.current.blocked)
        throw new Error('Finish or cancel pending edits, then import again.');
      if (
        window.confirm(
          'Replace the active score with this file? Current undo history will be cleared.',
        )
      ) {
        replace(imported);
        setAnnouncement('Imported score.');
      }
    } catch (error) {
      setError(`Import failed: ${errorMessage(error)}`);
    } finally {
      setReading(false);
    }
  }
  function exportFile() {
    setError('');
    const title = finishTitle(true);
    // A document action also commits if the browser did not deliver blur. Use
    // the same semantic command for this event's export snapshot before React
    // publishes the committed title prop. There is no second stored score.
    const snapshot =
      title === null ? document : updateDocumentTitle(document, title);
    try {
      const blob = new Blob([encodeDocument(snapshot)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = globalThis.document.createElement('a');
      link.href = url;
      link.download = documentFilename(snapshot.title);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAnnouncement('Exported committed score.');
    } catch (error) {
      setError(`Export failed: ${errorMessage(error)}`);
    }
  }
  return (
    <section className="document-header" aria-label="Document">
      <div className="document-header__main">
        <div className="document-header__identity">
          <h1 className="document-header__title">
            {editing ? (
              <input
                ref={titleInput}
                className="document-header__title-input"
                type="text"
                aria-label="Chant title"
                aria-describedby={titleHelpId}
                value={draft}
                onChange={(event) => {
                  pendingTitle.current = event.target.value;
                  setDraft(event.target.value);
                }}
                onBlur={() => finishTitle(true)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.repeat) return;
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    finishTitle(event.key === 'Enter', true);
                  }
                }}
              />
            ) : (
              <button
                ref={titleButton}
                className="document-header__title-button"
                type="button"
                disabled={disabled}
                aria-label={`Edit chant title: ${document.title || 'Untitled chant'}`}
                onClick={() => {
                  pendingTitle.current = document.title;
                  setDraft(document.title);
                }}
              >
                {document.title || 'Untitled chant'}
                <span className="document-header__edit-icon" aria-hidden="true">
                  ✎
                </span>
              </button>
            )}
          </h1>
          <span id={titleHelpId} className="editor-sr-only">
            Enter or leave the title to save. Escape cancels.
          </span>
        </div>
        <div
          className="document-header__actions"
          role="group"
          aria-label="Document actions"
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              finishTitle(true);
              if (
                window.confirm(
                  'Create a blank chant and replace the active score? Current undo history will be cleared.',
                )
              ) {
                replace(blankDocument());
                setError('');
                setAnnouncement('Created blank chant.');
              }
            }}
          >
            New
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              finishTitle(true);
              picker.current?.click();
            }}
          >
            Import
          </button>
          <button type="button" disabled={disabled} onClick={exportFile}>
            Export
          </button>
          <input
            ref={picker}
            type="file"
            accept=".chant.json,.json,application/json"
            aria-label="Import native chant JSON"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>
      <div className="document-header__meta">
        <p
          className={`document-header__save-status${!savedLocally || titleDirty || blocked ? ' document-header__save-status--unsaved' : ''}`}
          role="status"
        >
          {savedLocally ? (
            titleDirty ? (
              'Title not saved.'
            ) : blocked ? (
              'Committed score saved locally.'
            ) : (
              <>
                <span aria-hidden="true">✓ </span>Saved locally.
              </>
            )
          ) : (
            status
          )}
          {titleDirty
            ? ' Enter or leave the title to save; Escape cancels.'
            : editing
              ? ' Enter to save; Escape cancels.'
              : ''}
          {blocked
            ? ' Pending edits are not saved or exported. Finish or cancel lyric drafts, clef edits, moves and history prompts to use Document controls.'
            : ''}
        </p>
        <details className="document-header__help">
          <summary>About local saving</summary>
          <p>
            Only committed edits are saved. One active score in this browser
            only. Storage can be cleared or unavailable. Export files for
            backups and transfer. Files are separate snapshots, not cloud
            backups or synchronized files.
          </p>
        </details>
      </div>
      {needsRecovery && (
        <div
          className="document-header__recovery"
          role="group"
          aria-label="Document recovery"
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              finishTitle(true);
              if (
                window.confirm(
                  'Load the cached score and replace this tab’s score and history?',
                )
              )
                reload();
            }}
          >
            Load cached score
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              finishTitle(true);
              if (
                window.confirm(
                  'Replace the cached bytes with this tab’s committed score? Export any work you want to keep first.',
                )
              )
                replaceCache();
            }}
          >
            Replace cache with this score / Retry save
          </button>
        </div>
      )}
      <p className="document-header__error" role="alert" hidden={!error}>
        {error}
      </p>
      <p className="editor-sr-only" role="status">
        {announcement}
      </p>
    </section>
  );
}
