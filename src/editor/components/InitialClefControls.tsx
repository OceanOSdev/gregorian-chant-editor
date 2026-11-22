import type { Clef } from '../domain/chant-document';
import { isValidClef } from '../domain/clef';

interface InitialClefControlsProps {
  clef: Clef;
  disabled: boolean;
  onChangeClef: (clef: Clef) => void;
}

/**
 * The document's initial clef: type and staff line. Each select builds the
 * candidate clef from the current one and reports it only when it is valid.
 * The shell decides what a change does.
 */
export function InitialClefControls({
  clef,
  disabled,
  onChangeClef,
}: InitialClefControlsProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Initial clef</legend>
      <label>
        Clef type{' '}
        <select
          aria-label="Initial clef type"
          value={clef.type}
          onChange={(event) => {
            const next = { ...clef, type: event.target.value };
            if (isValidClef(next)) onChangeClef(next);
          }}
        >
          <option value="c">C (do)</option>
          <option value="f">F (fa)</option>
        </select>
      </label>{' '}
      <label>
        Staff line (bottom to top){' '}
        <select
          aria-label="Initial clef staff line"
          value={clef.staffLine}
          onChange={(event) => {
            const next = { ...clef, staffLine: Number(event.target.value) };
            if (isValidClef(next)) onChangeClef(next);
          }}
        >
          {[1, 2, 3, 4].map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </select>
      </label>
      <p>
        Initial clef changes preserve the melody in the initial passage. In
        Select mode, focus the first clef and use ↑/↓ to change its line. Later
        systems repeat the effective clef at their semantic start.
      </p>
    </fieldset>
  );
}
