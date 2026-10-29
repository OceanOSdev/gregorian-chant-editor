import { isValidLyricText } from '../domain/lyrics';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { LyricSyllable } from '../domain/chant-document';
import { nextSyllableId } from '../interaction/syllable-navigation';
import { getVisibilityAdjustment } from '../rendering/focus-visibility';

interface SyllableControlsProps {
  syllables: LyricSyllable[];
  activeId: string | null;
  canAdd: boolean;
  onSelect: (id: string) => void;
  onAdd: (text: string) => void;
  onSave: (id: string, text: string) => void;
}

export function SyllableControls({
  syllables,
  activeId,
  canAdd,
  onSelect,
  onAdd,
  onSave,
}: SyllableControlsProps) {
  const [newText, setNewText] = useState('');
  const [edit, setEdit] = useState<{
    id: string;
    original: string;
    text: string;
  } | null>(null);
  const newInput = useRef<HTMLInputElement>(null);
  const editInput = useRef<HTMLInputElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const strip = useRef<HTMLDivElement>(null);
  const [rovingId, setRovingId] = useState(activeId);
  const tabStopId = syllables.some((s) => s.id === rovingId)
    ? rovingId
    : (activeId ?? syllables[0]?.id);
  const composing = useRef(false);

  function revealSyllable(id: string) {
    const container = strip.current;
    const button = buttons.current.get(id);
    if (!container || !button) return;
    const viewport = container.getBoundingClientRect();
    const left = viewport.left + container.clientLeft + 4;
    const right =
      viewport.left + container.clientLeft + container.clientWidth - 4;
    const bounds = button.getBoundingClientRect();
    const { x } = getVisibilityAdjustment(
      bounds,
      { left, right, top: bounds.top, bottom: bounds.bottom },
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
    if (activeId) revealSyllable(activeId);
  }, [activeId, syllables]);
  const active = syllables.find((syllable) => syllable.id === activeId);
  // A changed target or historical text invalidates a draft, never commits it.
  const editing =
    edit && active?.id === edit.id && active.text === edit.original
      ? edit
      : null;

  if (edit && !editing) setEdit(null);
  const focusEditInput = useCallback((input: HTMLInputElement | null) => {
    if (input) input.focus({ preventScroll: true });
    editInput.current = input;
  }, []);

  function finishEdit(save: boolean) {
    if (!editing) return;
    if (save && !isValidLyricText(editing.text)) return;
    if (save) onSave(editing.id, editing.text);
    setEdit(null);
    buttons.current.get(editing.id)?.focus({ preventScroll: true });
  }

  return (
    <section className="syllable-controls" aria-label="Lyric syllables">
      <p>
        Select an unoccupied neume to add a syllable. Each entry is one
        syllable.
      </p>
      <form
        className="syllable-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (composing.current || !canAdd || !isValidLyricText(newText.trim()))
            return;
          onAdd(newText.trim());
          setNewText('');
          setEdit(null);
          newInput.current?.focus({ preventScroll: true });
        }}
      >
        <label htmlFor="new-syllable">New syllable</label>
        <input
          id="new-syllable"
          ref={newInput}
          value={newText}
          onChange={(event) => setNewText(event.currentTarget.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing && event.key === 'Enter')
              event.preventDefault();
          }}
        />
        <button
          type="submit"
          disabled={!canAdd || !isValidLyricText(newText.trim())}
        >
          Add
        </button>
      </form>
      {newText.trim() && !isValidLyricText(newText.trim()) ? (
        <p role="status">
          Enter one nonblank syllable without spaces, hyphens, or underscores.
        </p>
      ) : null}
      <p id="existing-syllables-label">Existing syllables · select to edit</p>
      <div
        className="syllable-strip"
        ref={strip}
        role="group"
        aria-describedby="syllable-navigation-help"
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
              syllables.map((s) => s.id),
              id,
              event.key,
            );
          if (!next) return;
          event.preventDefault();
          buttons.current.get(next)?.focus({ preventScroll: true });
        }}
        aria-labelledby="existing-syllables-label"
      >
        {syllables.length === 0 ? (
          <span>No syllables yet</span>
        ) : (
          syllables.map((syllable, index) => (
            <button
              type="button"
              key={syllable.id}
              data-syllable-id={syllable.id}
              ref={(button) => {
                if (button) buttons.current.set(syllable.id, button);
                else buttons.current.delete(syllable.id);
              }}
              tabIndex={syllable.id === tabStopId ? 0 : -1}
              onFocus={() => {
                setRovingId(syllable.id);
                revealSyllable(syllable.id);
              }}
              aria-pressed={syllable.id === activeId}
              aria-label={`Syllable ${index + 1}: ${syllable.text || '(empty)'}`}
              onClick={() => {
                revealSyllable(syllable.id);
                if (editing?.id === syllable.id) {
                  editInput.current?.focus({ preventScroll: true });
                  return;
                }
                onSelect(syllable.id);
                setEdit({
                  id: syllable.id,
                  original: syllable.text,
                  text: syllable.text,
                });
                // Newly mounted edit inputs receive focus through their ref.
              }}
            >
              <span className="syllable-number">{index + 1}.</span>{' '}
              {syllable.text || '(empty)'}
            </button>
          ))
        )}
      </div>
      <p id="syllable-navigation-help" className="editor-sr-only">
        Left and Right browse syllables; Home and End jump to the first and
        last. Enter or Space selects and edits. Tab leaves the strip.
      </p>
      {editing ? (
        <form
          className="syllable-form syllable-edit"
          aria-label="Edit existing syllable"
          onSubmit={(event) => {
            event.preventDefault();
            if (!composing.current) finishEdit(true);
          }}
        >
          <label htmlFor="edit-syllable">
            Editing syllable{' '}
            {syllables.findIndex((s) => s.id === editing.id) + 1}:{' '}
            {editing.original || '(empty)'}
          </label>
          <input
            id="edit-syllable"
            key={editing.id}
            ref={focusEditInput}
            value={editing.text}
            onChange={(event) =>
              setEdit({ ...editing, text: event.currentTarget.value })
            }
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                if (event.key === 'Enter') event.preventDefault();
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                finishEdit(false);
              }
            }}
          />
          <button type="submit" disabled={!isValidLyricText(editing.text)}>
            Save
          </button>
          {!isValidLyricText(editing.text) ? (
            <p role="status">
              Enter one nonblank syllable without spaces, hyphens, or
              underscores.
            </p>
          ) : null}
          <button type="button" onClick={() => finishEdit(false)}>
            Cancel
          </button>
        </form>
      ) : null}
    </section>
  );
}
