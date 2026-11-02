import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChantDocument, StaffLine } from '../domain/chant-document';
import { demoDocument as exampleDocument } from '../../app/demo-document';
import {
  createChant,
  maxFileBytes,
  parseChant,
  serializeChant,
} from '../persistence/chant-file';
import { exportGabc, importGabc } from '../interchange/gabc';
import {
  downloadText,
  fileStem,
  scoreSvgSource,
} from '../../app/browser-files';
import { updateClef, updateDocumentTitle } from '../commands/update-document';
import type { DocumentEdit } from '../state/document-history';

import { recoveryKey } from '../../app/recovery';

interface Props {
  document: ChantDocument;
  hasDraft: boolean;
  onEdit: (edit: DocumentEdit) => void;
  onReplace: (document: ChantDocument) => void;
  initialWarning: string;
  editingBlocked: boolean;
}

export function DocumentControls({
  document: chant,
  hasDraft,
  onEdit,
  onReplace,
  initialWarning,
  editingBlocked,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(chant.title);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paused, setPaused] = useState(Boolean(initialWarning));
  const [warning, setWarning] = useState(initialWarning);
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState<ChantDocument | null>(null);
  const file = useMemo(() => {
    try {
      return { text: serializeChant(chant), error: '' };
    } catch (error) {
      return {
        text: '',
        error:
          error instanceof Error ? error.message : 'Cannot save this document.',
      };
    }
  }, [chant]);
  const serialized = file.text;
  const [exported, setExported] = useState('');
  const titleDirty = title !== chant.title;
  const changed = Boolean(file.error) || serialized !== exported;
  const replacementGuard = useRef({ changed: changed || titleDirty, hasDraft });
  replacementGuard.current = { changed: changed || titleDirty, hasDraft };

  useEffect(() => setTitle(chant.title), [chant.title]);
  useEffect(() => {
    if (paused || !serialized) return;
    setSaved('Saving…');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(recoveryKey, serialized);
        setSaved('Saved in this browser');
      } catch {
        setSaved('Browser save unavailable');
        setError(
          'Browser storage is unavailable or full. Download a chant file to keep your work.',
        );
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [serialized, paused]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === recoveryKey || event.key === null) {
        setPaused(true);
        setWarning(
          'Another tab changed the browser copy. Saving here is paused. Download this tab’s work, or resume to replace the other copy.',
        );
      }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (
        hasDraft ||
        titleDirty ||
        Boolean(file.error) ||
        ((paused || saved !== 'Saved in this browser') && changed)
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [hasDraft, titleDirty, file.error, paused, saved, changed]);

  function replace(next: ChantDocument) {
    // Validate the complete saved representation before any replacement or prompt.
    const json = serializeChant(next);
    setError('');
    setNotice('');
    if (replacementGuard.current.changed || replacementGuard.current.hasDraft)
      setReplacement(next);
    else {
      onReplace(next);
      setExported(json);
    }
  }
  function attempt(action: () => void) {
    try {
      setError('');
      setNotice('');
      action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Operation failed. Your score is unchanged.',
      );
    }
  }
  function saveChant() {
    if (hasDraft) {
      setError('Finish or cancel your lyric draft before saving.');
      return;
    }
    attempt(() => {
      const snapshot = updateDocumentTitle(chant, title);
      const json = serializeChant(snapshot);
      if (snapshot !== chant) onEdit((doc) => updateDocumentTitle(doc, title));
      downloadText(
        fileStem(snapshot.title) + '.chant.json',
        json,
        'application/json',
      );
      setExported(json);
      setTitle(snapshot.title);
      setNotice('Chant file downloaded.');
    });
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.isComposing
      )
        return;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveChant();
      }
      if (event.key.toLowerCase() === 'o' && !busy) {
        event.preventDefault();
        input.current?.click();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
  return (
    <section className="document-controls" aria-label="Document">
      <div className="app-masthead">
        <div>
          <span className="app-eyebrow">S C R I P T O R I U M</span>
          <p>A workspace for Gregorian chant</p>
        </div>
        <span className="probe-badge">Experimental editor</span>
      </div>
      <div className="file-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => replace(createChant())}
        >
          New chant
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Open file
        </button>
        <button
          type="button"
          disabled={hasDraft || !serialized}
          aria-keyshortcuts="Control+S Meta+S"
          onClick={saveChant}
        >
          Save chant
        </button>
        <details className="export-menu">
          <summary>Export & print</summary>
          <div className="export-options">
            <button
              type="button"
              disabled={hasDraft}
              onClick={() =>
                attempt(() => {
                  downloadText(
                    fileStem(chant.title) + '.gabc',
                    exportGabc(chant),
                    'text/plain',
                  );
                  setNotice(
                    'GABC downloaded. Manual lyric alignment is retained only in chant JSON files.',
                  );
                })
              }
            >
              GABC
            </button>
            <button
              type="button"
              disabled={hasDraft}
              onClick={() =>
                attempt(() => {
                  const svg =
                    window.document.querySelector<SVGSVGElement>('.score');
                  if (!svg) throw new Error('Score is not ready.');
                  downloadText(
                    fileStem(chant.title) + '.svg',
                    scoreSvgSource(svg, chant.title),
                    'image/svg+xml',
                  );
                  setNotice('Clean SVG score downloaded.');
                })
              }
            >
              SVG score
            </button>
            <button
              type="button"
              disabled={hasDraft}
              onClick={() => window.print()}
            >
              Print score
            </button>
            <p>
              GABC supports the seven neume types, C clefs and plain lyrics. Use
              chant JSON for a lossless copy.
            </p>
          </div>
        </details>
        <button
          className="example-action"
          type="button"
          disabled={busy}
          onClick={() => replace(exampleDocument)}
        >
          Load example
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,.gabc,application/json,text/plain"
        className="editor-sr-only"
        tabIndex={-1}
        aria-label="Open chant JSON or GABC"
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!file) return;
          setBusy(true);
          setError('');
          try {
            if (file.size > maxFileBytes)
              throw new Error('Files must be smaller than 2 MB.');
            const text = await file.text();
            const next = file.name.toLowerCase().endsWith('.gabc')
              ? importGabc(text)
              : parseChant(text);
            replace(next);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : 'Could not open this file.',
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      <div className="document-meta">
        <label className="title-field">
          Chant title
          <input
            aria-label="Chant title"
            disabled={editingBlocked}
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.currentTarget.value)}
            onBlur={() => {
              onEdit((doc) => updateDocumentTitle(doc, title));
              setTitle(title.trim() || chant.title);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setTitle(chant.title);
            }}
          />
        </label>
        <label>
          C clef
          <select
            aria-label="C clef line"
            disabled={editingBlocked}
            value={chant.clef.staffLine}
            onChange={(event) => {
              const line = Number(event.currentTarget.value);
              if (line === 1 || line === 2 || line === 3 || line === 4)
                onEdit((doc) => updateClef(doc, line as StaffLine));
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                Line {n}
              </option>
            ))}
          </select>
        </label>
        <span className="save-status" role="status">
          {file.error
            ? 'Browser save unavailable'
            : paused
              ? 'Browser save paused'
              : saved}
          {hasDraft ? ' · Unsaved lyric draft' : ''}
        </span>
      </div>
      {hasDraft && (
        <p className="document-hint">
          Finish or cancel your lyric draft before saving or exporting.
        </p>
      )}
      {file.error && (
        <p className="document-error" role="alert">
          {file.error} The browser copy has not been updated.
        </p>
      )}
      {error && (
        <p className="document-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="document-hint" role="status">
          {notice}
        </p>
      )}
      {warning && (
        <div className="document-warning" role="status">
          <p>{warning}</p>
          <button
            type="button"
            onClick={() =>
              attempt(() => {
                const raw = localStorage.getItem(recoveryKey);
                if (!raw) throw new Error('No browser copy is available.');
                downloadText(
                  'browser-recovery.chant.json',
                  raw,
                  'application/json',
                );
              })
            }
          >
            Download browser copy
          </button>
          <button
            type="button"
            onClick={() => {
              setWarning('');
              setPaused(false);
            }}
          >
            Resume saving this tab
          </button>
        </div>
      )}
      {replacement && (
        <div
          className="replacement-dialog"
          role="alertdialog"
          aria-modal="false"
          aria-label="Replace current chant"
        >
          <p>
            Replace this chant? Download your current score first if you want to
            keep it. History and uncommitted lyric drafts will be cleared.
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              const json = serializeChant(replacement);
              onReplace(replacement);
              setExported(json);
              setReplacement(null);
            }}
          >
            Replace chant
          </button>
          <button type="button" onClick={() => setReplacement(null)}>
            Keep editing
          </button>
        </div>
      )}
    </section>
  );
}
