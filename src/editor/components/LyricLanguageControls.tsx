import type { LyricLanguage } from '../domain/chant-document';
import { lyricLanguage } from '../domain/lyric-alignment';

interface LyricLanguageControlsProps {
  language: LyricLanguage;
  disabled: boolean;
  onChangeLanguage: (language: LyricLanguage) => void;
}

/**
 * The lyric-language select and its explanation of alignment and spacing.
 * Renders a fragment: the label and paragraph stay direct children of the
 * editor's main element. The selected value is normalized before it is
 * reported; the shell decides what a change does.
 */
export function LyricLanguageControls({
  language,
  disabled,
  onChangeLanguage,
}: LyricLanguageControlsProps) {
  return (
    <>
      <label>
        Lyric language{' '}
        <select
          aria-label="Lyric language"
          value={language}
          disabled={disabled}
          onChange={(event) =>
            onChangeLanguage(lyricLanguage(event.currentTarget.value))
          }
        >
          <option value="la">Latin</option>
          <option value="en">English</option>
          <option value="el">Greek</option>
          <option value="und">Unspecified</option>
        </select>
      </label>
      <p>
        Alignment follows the lyric language. Manual segments take precedence.
        Lyrics provide minimum spacing between neumes. Oversized syllables can
        be viewed by scrolling the score.
      </p>
    </>
  );
}
