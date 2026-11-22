import { useRef } from 'react';
import type { ChantAccidental, ChantDocument } from '../domain/chant-document';
import { findNote } from '../domain/neume';

interface AccidentalPropertiesControlsProps {
  accidental: ChantAccidental;
  /** Read only, to name the earlier-note candidates. */
  document: ChantDocument;
  /** Whether an earlier-note placement is being chosen for `accidental`. */
  choosingPlacement: boolean;
  /** Eligible earlier notes, in score order. */
  anchorNoteIds: readonly string[];
  onChangeKind: (kind: ChantAccidental['kind']) => void;
  onStartPlacement: () => void;
  onRestoreDefaultPlacement: () => void;
  onDelete: () => void;
  onChoosePlacement: (noteId: string) => void;
  onCancelPlacement: () => void;
}

function anchorLabel(document: ChantDocument, noteId: string) {
  const target = findNote(document, noteId);
  return target
    ? `Note ${target.noteIndex + 1} of ${target.neume.kind}, neume ${target.neumeIndex + 1}`
    : 'Unavailable note';
}

/**
 * The selected accidental's properties: kind, placement and deletion, and the
 * earlier-note chooser while a placement is being chosen. Rendered as the
 * content of `AccidentalContextToolbar`, which owns positioning, focus and
 * Escape. The shell decides what each action does.
 *
 * The earlier-note list is uncontrolled: `defaultValue` sets its initial
 * highlight, and rerenders keep the user's highlighted option.
 */
export function AccidentalPropertiesControls({
  accidental,
  document,
  choosingPlacement,
  anchorNoteIds,
  onChangeKind,
  onStartPlacement,
  onRestoreDefaultPlacement,
  onDelete,
  onChoosePlacement,
  onCancelPlacement,
}: AccidentalPropertiesControlsProps) {
  const anchorList = useRef<HTMLSelectElement>(null);
  return (
    <>
      <label>
        Accidental kind
        <select
          disabled={choosingPlacement}
          aria-label="Accidental kind"
          value={accidental.kind}
          onChange={(e) =>
            onChangeKind(e.target.value === 'flat' ? 'flat' : 'natural')
          }
        >
          <option value="flat">Flat</option>
          <option value="natural">Natural</option>
        </select>
      </label>
      <p>
        Placement:{' '}
        {accidental.placement ? 'Above earlier note' : 'Before owning neume'}
      </p>
      <button
        type="button"
        disabled={choosingPlacement}
        onClick={onStartPlacement}
      >
        Place above earlier note
      </button>
      <button
        type="button"
        disabled={choosingPlacement || !accidental.placement}
        onClick={onRestoreDefaultPlacement}
      >
        Restore default placement
      </button>
      <button type="button" disabled={choosingPlacement} onClick={onDelete}>
        Delete accidental
      </button>
      {choosingPlacement ? (
        <div role="group" aria-label="Choose accidental placement">
          <label>
            Earlier note
            <select
              aria-label="Earlier note"
              ref={anchorList}
              defaultValue={accidental.placement?.noteId ?? anchorNoteIds[0]}
              size={Math.min(6, anchorNoteIds.length)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  onChoosePlacement(e.currentTarget.value);
                }
              }}
            >
              {anchorNoteIds.map((id) => (
                <option key={id} value={id}>
                  {anchorLabel(document, id)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!anchorNoteIds.length}
            onClick={() => {
              const id = anchorList.current?.value;
              if (id) onChoosePlacement(id);
            }}
          >
            Use highlighted note
          </button>
          <button type="button" onClick={onCancelPlacement}>
            Cancel placement
          </button>
        </div>
      ) : null}
    </>
  );
}
