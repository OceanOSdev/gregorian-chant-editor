import type { EditorSession } from '../state/editor-session';

type ClefInsertionPolicy = EditorSession['clefInsertionPolicy'];

interface ClefPitchHandlingControlsProps {
  policy: ClefInsertionPolicy;
  /** The last clef insertion's failure, if any. */
  error: string | null;
  disabled: boolean;
  onChangePolicy: (policy: ClefInsertionPolicy) => void;
}

/**
 * The shared Pitch handling fieldset used for clef insertion and for Apply
 * when editing a clef. The shell decides when it is shown and disabled, and
 * what a policy change does.
 */
export function ClefPitchHandlingControls({
  policy,
  error,
  disabled,
  onChangePolicy,
}: ClefPitchHandlingControlsProps) {
  return (
    <fieldset
      className="clef-insertion-behavior"
      disabled={disabled}
      aria-describedby="clef-insertion-description"
    >
      <legend>Pitch handling</legend>
      <label>
        <input
          type="radio"
          name="clef-insertion-policy"
          value="melody"
          checked={policy === 'melody'}
          onChange={() => onChangePolicy('melody')}
        />
        Keep pitches (move existing notes)
      </label>
      <label>
        <input
          type="radio"
          name="clef-insertion-policy"
          value="noteheads"
          checked={policy === 'noteheads'}
          onChange={() => onChangePolicy('noteheads')}
        />
        Keep note positions (change pitches)
      </label>
      <p id="clef-insertion-description">
        Keep pitches shifts existing noteheads to preserve their pitches. Keep
        note positions leaves noteheads in place and changes their interpreted
        pitches. Used for insertion and Apply when editing a clef.
      </p>
      {error ? <p role="status">{error}</p> : null}
    </fieldset>
  );
}
