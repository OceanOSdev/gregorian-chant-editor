import './LyricAlignmentControls.css';
import type {
  LyricAlignmentSegment,
  LyricSyllable,
} from '../domain/chant-document';
import { lyricGraphemes } from '../domain/lyric-alignment';

interface Props {
  syllable: LyricSyllable;
  disabled: boolean;
  onChange: (range: LyricAlignmentSegment | undefined) => void;
}

/** Always explicitly targets the selected entity, independently of SVG keyboard focus. */
export function LyricAlignmentControls({
  syllable,
  disabled,
  onChange,
}: Props) {
  const graphemes = lyricGraphemes(syllable.text);
  const range = syllable.alignment;
  return (
    <fieldset className="lyric-alignment-controls" disabled={disabled}>
      <legend>Alignment for selected syllable: {syllable.text}</legend>
      <label>
        Alignment{' '}
        <select
          aria-label="Alignment"
          value={range ? 'manual' : 'automatic'}
          onChange={(event) =>
            onChange(
              event.currentTarget.value === 'manual'
                ? { start: 0, end: graphemes.length }
                : undefined,
            )
          }
        >
          <option value="automatic">Automatic</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      {range ? (
        <>
          <label>
            Segment start{' '}
            <select
              aria-label="Alignment segment start"
              value={range.start}
              onChange={(event) => {
                const start = Number(event.currentTarget.value);
                onChange({ start, end: Math.max(start + 1, range.end) });
              }}
            >
              {graphemes.map((g, i) => (
                <option key={i} value={i}>
                  {i + 1}: {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            Segment end{' '}
            <select
              aria-label="Alignment segment end"
              value={range.end}
              onChange={(event) =>
                onChange({
                  start: range.start,
                  end: Number(event.currentTarget.value),
                })
              }
            >
              {graphemes.map((g, i) =>
                i >= range.start ? (
                  <option key={i} value={i + 1}>
                    {i + 1}: {g}
                  </option>
                ) : null,
              )}
            </select>
          </label>
          <p>
            Aligned segment:{' '}
            <strong>{graphemes.slice(range.start, range.end).join('')}</strong>
          </p>
          <button type="button" onClick={() => onChange(undefined)}>
            Reset to automatic
          </button>
        </>
      ) : null}
      <p>
        Changing syllable text resets manual alignment to automatic. Save or
        cancel a text draft before changing alignment.
      </p>
    </fieldset>
  );
}
