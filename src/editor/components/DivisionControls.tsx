import type { ChantDivision, DivisionKind } from '../domain/chant-document';
import { isDivisionKind } from '../domain/divisions';
import { neumeName } from '../state/editor-session';

const divisionKinds = ['minima', 'minor', 'maior', 'finalis'] as const;

interface DivisionControlsProps {
  /** The division the controls act on. */
  division: ChantDivision;
  /** Whether `division` is the last focused division rather than the selection. */
  lastFocused: boolean;
  disabled: boolean;
  /** A placement tool is armed; the kind select and actions are disabled. */
  placing: boolean;
  /** Name of the remembered neume the insert buttons add. */
  insertName: string;
  onChangeKind: (kind: DivisionKind) => void;
  onInsert: (side: 'before' | 'after') => void;
  onDelete: () => void;
}

/**
 * The Divisions fieldset for the targeted division: its kind, inserting the
 * remembered neume on either side, and deletion. The shell chooses the target
 * and decides what each action does.
 */
export function DivisionControls({
  division,
  lastFocused,
  disabled,
  placing,
  insertName,
  onChangeKind,
  onInsert,
  onDelete,
}: DivisionControlsProps) {
  return (
    <fieldset className="division-controls" disabled={disabled}>
      <legend>Divisions</legend>
      <div data-notation-shortcuts>
        <p>
          Division target: {division.kind}.{' '}
          {lastFocused ? 'Last focused division' : 'Selected'}.
        </p>
        <label>
          Change division kind{' '}
          <select
            aria-label="Change division kind"
            value={division.kind}
            disabled={placing}
            onChange={(event) => {
              const kind = event.currentTarget.value;
              if (isDivisionKind(kind)) onChangeKind(kind);
            }}
          >
            {divisionKinds.map((kind) => (
              <option key={kind} value={kind}>
                {neumeName(kind)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={placing}
          onClick={() => onInsert('before')}
        >
          Insert {insertName} before division
        </button>
        <button
          type="button"
          disabled={placing}
          onClick={() => onInsert('after')}
        >
          Insert {insertName} after division
        </button>
        <button type="button" disabled={placing} onClick={onDelete}>
          Delete division
        </button>
      </div>
    </fieldset>
  );
}
