import { useLayoutEffect, useRef, useState } from 'react';
import type { ChantDocument } from '../domain/chant-document';
import { isValidLyricText } from '../domain/lyrics';
import { nextSyllableId } from '../interaction/syllable-navigation';
import type { ChantLayout } from '../layout/layout-chant';
import {
  focusAndReveal,
  getVisibilityAdjustment,
} from '../rendering/focus-visibility';
import type { EditorFocusRequest } from '../state/editor-session';
import {
  isDirtyLyricEntry,
  lyricTargetId,
  type LyricAction,
  type LyricEntry,
} from '../state/lyric-entry';

interface SyllableControlsProps {
  document: ChantDocument;
  layout: ChantLayout;
  entry: LyricEntry | null;
  selectedSyllableId: string | null;
  selectedNeumeId: string | null;
  focusRequest: EditorFocusRequest | null;
  pendingHistory: boolean;
  onAction: (action: LyricAction) => void;
  onHistoryChoice: (choice: 'save' | 'discard' | 'cancel') => void;
  onFocusHandled: (request: EditorFocusRequest) => void;
}

export function SyllableControls({
  document,
  layout,
  entry,
  selectedSyllableId,
  selectedNeumeId,
  focusRequest,
  pendingHistory,
  onAction,
  onHistoryChoice,
  onFocusHandled,
}: SyllableControlsProps) {
  const input = useRef<HTMLInputElement>(null);
  const controls = useRef<HTMLElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const composing = useRef(false);
  const [rovingId, setRovingId] = useState<string | null>(null);
  const tabStop = document.syllables.some((s) => s.id === rovingId)
    ? rovingId
    : (selectedSyllableId ?? document.syllables[0]?.id);
  const draft = entry?.kind === 'draft' ? entry : null;
  const neumeId = lyricTargetId(document, entry);
  const system = layout.systems.find((s) =>
    s.neumes.some((n) => n.neumeId === neumeId),
  );
  const neume = system?.neumes.find((n) => n.neumeId === neumeId);
  const syllable =
    entry?.kind === 'occupied' || entry?.kind === 'selected'
      ? document.syllables.find((s) => s.id === entry.syllableId)
      : draft?.original;
  const first = draft
    ? !document.syllables.some(
        (s) =>
          s.id !== draft.original?.id &&
          document.neumes.findIndex((n) => n.id === s.startsAtNeumeId) <
            document.neumes.findIndex((n) => n.id === draft.neumeId),
      )
    : syllable?.id === document.syllables[0]?.id;
  const boundary =
    draft?.boundaryBefore ??
    (entry?.kind === 'end'
      ? entry.boundaryBefore
      : (syllable?.boundaryBefore ?? 'word'));

  function reveal(id: string) {
    const container = strip.current,
      button = buttons.current.get(id);
    if (!container || !button) return;
    const viewport = container.getBoundingClientRect(),
      bounds = button.getBoundingClientRect();
    const { x } = getVisibilityAdjustment(
      bounds,
      {
        left: viewport.left + 4,
        right: viewport.right - 4,
        top: bounds.top,
        bottom: bounds.bottom,
      },
      {
        left: bounds.left,
        right: bounds.left,
        top: bounds.top,
        bottom: bounds.bottom,
      },
    );
    if (x) container.scrollBy({ left: x, behavior: 'instant' });
  }
  useLayoutEffect(() => {
    if (selectedSyllableId) reveal(selectedSyllableId);
  }, [selectedSyllableId, document.syllables]);
  useLayoutEffect(() => {
    if (focusRequest?.kind !== 'lyrics' || pendingHistory) return;
    if (input.current) {
      const alreadyFocused =
        globalThis.document.activeElement === input.current;
      focusAndReveal(input.current);
      if (!alreadyFocused && focusRequest.selectText) input.current.select();
    } else {
      const control = controls.current?.querySelector<HTMLButtonElement>(
        '[data-lyric-primary]:not(:disabled), button:not(:disabled)',
      );
      if (control) focusAndReveal(control);
    }
    onFocusHandled(focusRequest);
  }, [focusRequest, pendingHistory, draft, onFocusHandled]);
  const historySave = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (pendingHistory) historySave.current?.focus({ preventScroll: true });
  }, [pendingHistory]);

  return (
    <section
      className="syllable-controls"
      aria-label="Lyric syllables"
      ref={controls}
      onKeyDown={(event) => {
        if (pendingHistory && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onHistoryChoice('cancel');
          return;
        }
        if (
          !entry ||
          event.nativeEvent.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLSelectElement
        )
          return;
        if (event.key === '_') {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) onAction({ type: 'advance', key: '_' });
        } else if (
          entry.kind === 'occupied' &&
          event.key.length === 1 &&
          event.key !== ' '
        )
          onAction({
            type: 'error',
            message:
              'Choose Edit syllable or Skip neume. Existing lyrics were preserved.',
          });
      }}
    >
      <p id="lyric-entry-help">
        Lyrics: - continues a word · Space starts a word · _ skips a neume.
        Enter saves; Escape cancels and exits. Tab moves focus.
      </p>
      {pendingHistory ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Resolve lyric draft before history"
          className="lyric-history-choice"
        >
          <p>
            Save or discard the current draft before navigating score history?
          </p>
          <button
            ref={historySave}
            type="button"
            onClick={() => onHistoryChoice('save')}
          >
            Save draft
          </button>
          <button type="button" onClick={() => onHistoryChoice('discard')}>
            Discard draft
          </button>
          <button type="button" onClick={() => onHistoryChoice('cancel')}>
            Cancel history
          </button>
        </div>
      ) : null}
      {draft && neume && system ? (
        <form
          className="syllable-form lyric-floating-entry"
          aria-label={draft.original ? 'Edit syllable' : 'Insert syllable'}
          style={{
            left: `clamp(0.5rem, ${((neume.lyricAnchorX - 80) / layout.width) * 100}%, calc(100% - min(13rem, 65%) - 0.5rem))`,
            top: `${((system.y + 156) / layout.width) * 100}cqw`,
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!composing.current) onAction({ type: 'save' });
          }}
        >
          <label className="editor-sr-only" htmlFor="lyric-input">
            {draft.original ? 'Edit syllable' : 'New syllable'}
          </label>
          <input
            id="lyric-input"
            data-target-neume-id={draft.neumeId}
            data-entry-intent={draft.original ? 'edit' : 'insert'}
            ref={input}
            value={draft.text}
            aria-describedby="lyric-entry-help"
            disabled={pendingHistory}
            onChange={(event) =>
              onAction({ type: 'text', text: event.currentTarget.value })
            }
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text');
              if (text && !isValidLyricText(text)) {
                event.preventDefault();
                onAction({
                  type: 'error',
                  message:
                    'Paste one syllable without whitespace, hyphens, or underscores.',
                });
              }
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || composing.current) {
                if (event.key === 'Enter') event.preventDefault();
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                if (!event.repeat) onAction({ type: 'save' });
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onAction({ type: 'cancel' });
                return;
              }
              if (
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                ['-', ' ', '_'].includes(event.key)
              ) {
                event.preventDefault();
                event.stopPropagation();
                if (!event.repeat)
                  onAction({
                    type: 'advance',
                    key: event.key as '-' | ' ' | '_',
                  });
              }
            }}
          />
        </form>
      ) : null}
      {entry ? (
        <div className="lyric-actions">
          {entry.kind === 'occupied' ? (
            <>
              <p>
                Already anchored: <strong>{syllable?.text}</strong>. Choose Edit
                or Skip; typing will not replace it.
              </p>
              <button
                data-lyric-primary
                type="button"
                onClick={() =>
                  onAction({ type: 'edit', syllableId: entry.syllableId })
                }
              >
                Edit syllable
              </button>
            </>
          ) : null}
          {entry.kind === 'selected' ? (
            <>
              <p>
                Selected syllable: <strong>{syllable?.text}</strong>
              </p>
              <button
                data-lyric-primary
                type="button"
                onClick={() =>
                  onAction({ type: 'edit', syllableId: entry.syllableId })
                }
              >
                Edit syllable
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: 'delete' })}
              >
                Delete syllable
              </button>
            </>
          ) : null}
          {entry.kind === 'end' ? (
            <p>End of music. Add a neume or select music to continue.</p>
          ) : null}
          {entry.kind === 'recovery' ? (
            <>
              <p>
                Draft target changed. Your text is preserved:{' '}
                <strong>{entry.draft.text || '(empty)'}</strong>
              </p>
              <button
                data-lyric-primary
                type="button"
                disabled={!selectedNeumeId}
                onClick={() => {
                  if (selectedNeumeId)
                    onAction({ type: 'retry', neumeId: selectedNeumeId });
                }}
              >
                Retry at selected neume
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: 'discard' })}
              >
                Discard draft
              </button>
            </>
          ) : (
            <>
              <label>
                Word boundary{' '}
                <select
                  aria-label="Word boundary"
                  value={first ? 'word' : boundary}
                  disabled={
                    Boolean(first) ||
                    entry.kind === 'occupied' ||
                    pendingHistory
                  }
                  onChange={(event) =>
                    onAction({
                      type: 'boundary',
                      boundaryBefore:
                        event.currentTarget.value === 'word'
                          ? 'word'
                          : 'continuation',
                    })
                  }
                >
                  <option value="word">Starts word</option>
                  <option value="continuation">Continues word</option>
                </select>
              </label>
              {draft ? (
                <button
                  type="button"
                  onClick={() => onAction({ type: 'save' })}
                >
                  Save syllable
                </button>
              ) : null}
              <button
                data-lyric-primary={entry.kind === 'end' ? true : undefined}
                type="button"
                disabled={pendingHistory}
                onClick={() => onAction({ type: 'advance', key: '_' })}
              >
                Skip neume
              </button>
              <button
                type="button"
                disabled={pendingHistory}
                onClick={() => onAction({ type: 'done' })}
              >
                Done
              </button>
            </>
          )}
          <button type="button" onClick={() => onAction({ type: 'cancel' })}>
            {isDirtyLyricEntry(entry) ? 'Cancel draft and exit' : 'Exit Lyrics'}
          </button>
        </div>
      ) : (
        <p>
          Select music and activate Lyrics, or select an existing syllable to
          edit.
        </p>
      )}
      <div
        className="syllable-strip"
        ref={strip}
        role="group"
        aria-label="Existing syllables"
        onKeyDown={(event) => {
          if (
            event.nativeEvent.isComposing ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
          )
            return;
          const id =
            event.target instanceof HTMLElement
              ? event.target.dataset.syllableId
              : undefined;
          const next =
            id &&
            nextSyllableId(
              document.syllables.map((s) => s.id),
              id,
              event.key,
            );
          if (next) {
            event.preventDefault();
            buttons.current.get(next)?.focus({ preventScroll: true });
          }
        }}
      >
        {document.syllables.length ? (
          document.syllables.map((s, index) => (
            <button
              type="button"
              key={s.id}
              data-syllable-id={s.id}
              ref={(button) => {
                if (button) buttons.current.set(s.id, button);
                else buttons.current.delete(s.id);
              }}
              tabIndex={s.id === tabStop ? 0 : -1}
              aria-pressed={s.id === selectedSyllableId}
              aria-label={`Syllable ${index + 1}: ${s.text}`}
              onFocus={() => {
                setRovingId(s.id);
                reveal(s.id);
              }}
              onClick={() => onAction({ type: 'edit', syllableId: s.id })}
            >
              <span className="syllable-number">{index + 1}.</span> {s.text}
            </button>
          ))
        ) : (
          <span>No syllables yet</span>
        )}
      </div>
    </section>
  );
}
