import type { Clef } from '../domain/chant-document';
import type { ClefGeometry } from '../layout/clef-geometry';
import { focusAndReveal } from './focus-visibility';

export function ClefControl({
  clef,
  selected,
  disabled,
  onSelect,
  onChange,
  registerElement,
}: {
  clef: ClefGeometry;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onChange: (clef: Clef) => void;
  registerElement: (element: SVGGElement | null) => void;
}) {
  return (
    <g
      ref={registerElement}
      data-initial-clef="true"
      className={`score__clef-control${selected ? ' score__clef-control--selected' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-label={`Initial ${clef.type.toUpperCase()} (${clef.type === 'c' ? 'do' : 'fa'}) clef, staff line ${clef.staffLine} from bottom. Enter or Space selects; Arrow Up or Down changes line and preserves melody. Use Initial clef controls to change type.`}
      pointerEvents={disabled ? 'none' : 'all'}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onSelect();
          focusAndReveal(event.currentTarget);
        }
      }}
      onKeyDown={(event) => {
        if (
          disabled ||
          event.nativeEvent.isComposing ||
          event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.shiftKey
        )
          return;
        if (['Enter', ' ', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Enter' || event.key === ' ') onSelect();
          else {
            const line = clef.staffLine + (event.key === 'ArrowUp' ? 1 : -1);
            if (line === 1 || line === 2 || line === 3 || line === 4)
              onChange({ type: clef.type, staffLine: line });
          }
        }
      }}
    >
      <rect
        className="score__clef-target"
        {...clef.hitBounds}
        fill="transparent"
      />
      <path
        className="score__clef-ink"
        d={clef.path}
        aria-hidden="true"
        pointerEvents="none"
      />
    </g>
  );
}
