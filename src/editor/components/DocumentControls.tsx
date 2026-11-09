import { useRef, useState } from 'react';
import type { ChantDocument } from '../domain/chant-document';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
  documentFilename,
  maximumDocumentBytes,
} from '../persistence/native-document';
import { errorMessage } from '../persistence/browser-document';

interface DocumentControlsProps {
  document: ChantDocument;
  blocked: boolean;
  status: string;
  needsRecovery: boolean;
  replace: (document: ChantDocument) => void;
  reload: () => void;
  replaceCache: () => void;
}
export function DocumentControls({
  document,
  blocked,
  status,
  needsRecovery,
  replace,
  reload,
  replaceCache,
}: DocumentControlsProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  // Validate asynchronous reads against the latest active score and workflow.
  const latest = useRef({ blocked });
  latest.current = { blocked };
  async function importFile(file: File) {
    setReading(true);
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
        setMessage('Imported score.');
      }
    } catch (error) {
      setMessage(`Import failed: ${errorMessage(error)}`);
    } finally {
      setReading(false);
    }
  }
  function exportFile() {
    try {
      const blob = new Blob([encodeDocument(document)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = globalThis.document.createElement('a');
      link.href = url;
      link.download = documentFilename(document.title);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        'Exported committed score. Keep the downloaded file as a separate backup.',
      );
    } catch (error) {
      setMessage(`Export failed: ${errorMessage(error)}`);
    }
  }
  return (
    <section aria-label="Document">
      <fieldset disabled={blocked || reading}>
        <legend>Document</legend>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                'Create a blank chant and replace the active score? Current undo history will be cleared.',
              )
            ) {
              replace(blankDocument());
              setMessage('Created blank chant.');
            }
          }}
        >
          New
        </button>{' '}
        <button type="button" onClick={() => picker.current?.click()}>
          Import
        </button>{' '}
        <button type="button" onClick={exportFile}>
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
        {needsRecovery && (
          <>
            {' '}
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Load the cached score and replace this tab’s score and history?',
                  )
                )
                  reload();
              }}
            >
              Load cached score
            </button>{' '}
            <button
              type="button"
              onClick={() => {
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
          </>
        )}
      </fieldset>
      <p role="status">
        {status}
        {blocked
          ? ' Pending edits are not saved or exported. Finish or cancel lyric drafts, clef edits, moves and history prompts to use Document controls.'
          : ''}
      </p>
      <p role="alert">{message}</p>
      <small>
        One active score in this browser only. Storage can be cleared or
        unavailable. Export files for backups and transfer.
      </small>
    </section>
  );
}
