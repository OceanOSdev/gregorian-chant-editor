import { useCallback, useRef, useState } from 'react';
import type { LyricSyllable } from '../domain/chant-document';

interface SyllableControlsProps {
  syllables: LyricSyllable[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (text: string) => void;
  onSave: (id: string, text: string) => void;
}

export function SyllableControls({
  syllables,
  activeId,
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
  const composing = useRef(false);
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
    if (save) onSave(editing.id, editing.text);
    setEdit(null);
    buttons.current.get(editing.id)?.focus({ preventScroll: true });
  }

  return (
    <section className="syllable-controls" aria-label="Lyric syllables">
      <form
        className="syllable-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (composing.current || !newText.trim()) return;
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
        <button type="submit" disabled={!newText.trim()}>
          Add
        </button>
      </form>
      <p id="existing-syllables-label">
        Existing syllables · select to target and edit
      </p>
      <div
        className="syllable-strip"
        role="group"
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
              aria-pressed={syllable.id === activeId}
              aria-label={`Syllable ${index + 1}: ${syllable.text || '(empty)'}`}
              onClick={() => {
                if (editing?.id === syllable.id)
                  editInput.current?.focus({ preventScroll: true });
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
          <button type="submit">Save</button>
          <button type="button" onClick={() => finishEdit(false)}>
            Cancel
          </button>
        </form>
      ) : null}
    </section>
  );
}
