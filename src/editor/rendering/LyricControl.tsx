import { getSyllableKeyAction } from '../interaction/lyric-entry-keyboard';
import type { LyricLayout } from '../layout/layout-chant';
import { lyricFontFamily } from '../layout/lyric-text-metrics';
import { lyricFocusCue } from './lyric-focus-cue';

/** Edit intents of an engraved syllable; `ScoreSvg` binds them to the session. */
export interface LyricActions {
  onSelectSyllable: (id: string) => void;
  onEditSyllable: (id: string, replacement?: string) => void;
  onDeleteSyllable: (syllableId: string) => void;
  onAdvanceLyric: (key: '-' | ' ' | '_') => void;
}

interface LyricControlProps {
  lyric: LyricLayout;
  selected: boolean;
  placementActive: boolean;
  lyricMoveActive: boolean;
  transactionBlocked: boolean;
  actions: LyricActions;
  /** Registers the focusable text with the score's single focus registry. */
  registerElement: (element: SVGTextElement | null) => void;
}

/**
 * One engraved syllable's interactive SVG: selection background, focusable
 * text and the note-independent keyboard-focus cue below it. Keys resolve
 * through the pure lyric keyboard map into the named intents above.
 */
export function LyricControl({
  lyric,
  selected,
  placementActive,
  lyricMoveActive,
  transactionBlocked,
  actions,
  registerElement,
}: LyricControlProps) {
  const disabled = placementActive || lyricMoveActive || transactionBlocked;
  const cue = lyricFocusCue(lyric);
  return (
    <g className="score__lyric-control">
      <g
        className={`score__lyric-group${selected ? ' score__lyric-group--selected' : ''}`}
      >
        {selected && lyric.left !== null && lyric.right !== null ? (
          <rect
            className="score__lyric-selection"
            x={lyric.left + Math.min(2, (lyric.right - lyric.left) / 2)}
            y={lyric.y - lyric.fontSize}
            width={Math.max(0, lyric.right - lyric.left - 4)}
            height={lyric.fontSize * 1.3}
            rx={1.5}
            aria-hidden="true"
            pointerEvents="none"
          />
        ) : null}
        <text
          className="score__lyric"
          ref={registerElement}
          role="button"
          aria-describedby="lyric-focus-help"
          tabIndex={disabled ? -1 : 0}
          aria-label={`Syllable: ${lyric.text}. Click or Space selects; L activates Lyrics here; double-click or Enter edits; Delete or Backspace removes focused lyrics; typing replaces; minus continues a word; Space starts a word; underscore skips.`}
          aria-pressed={selected}
          aria-disabled={disabled}
          pointerEvents={disabled ? 'none' : 'all'}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) actions.onSelectSyllable(lyric.syllableId);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (!disabled) actions.onEditSyllable(lyric.syllableId);
          }}
          onKeyDown={(event) => {
            // The pure resolver owns the placement and modifier exclusions.
            if (lyricMoveActive || transactionBlocked) return;
            const action = getSyllableKeyAction(
              event.nativeEvent,
              selected,
              placementActive,
            );
            if (!action) return;
            event.preventDefault();
            event.stopPropagation();
            switch (action.type) {
              case 'select':
                actions.onSelectSyllable(lyric.syllableId);
                break;
              case 'edit':
                actions.onEditSyllable(lyric.syllableId);
                break;
              case 'replace':
                actions.onEditSyllable(lyric.syllableId, action.text);
                break;
              case 'delete':
                actions.onDeleteSyllable(lyric.syllableId);
                break;
              case 'advance':
                actions.onAdvanceLyric(action.key);
                break;
            }
          }}
          data-syllable-id={lyric.syllableId}
          x={lyric.x}
          y={lyric.y}
          fontSize={lyric.fontSize}
          fontFamily={lyricFontFamily}
          textAnchor="middle"
          textRendering="geometricPrecision"
        >
          {lyric.text}
        </text>
      </g>
      <g
        className="score__lyric-focus-cue"
        aria-hidden="true"
        pointerEvents="none"
      >
        <path d={cue.path} />
        <text x={cue.labelX} y={cue.labelBaselineY} textAnchor="middle">
          Keyboard focus
        </text>
      </g>
    </g>
  );
}
