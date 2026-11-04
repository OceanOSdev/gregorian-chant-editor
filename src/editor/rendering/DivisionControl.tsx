import type { DivisionLayout } from '../layout/division-geometry';
import { DivisionInk } from './DivisionInk';
import { focusAndReveal } from './focus-visibility';

interface DivisionControlProps {
  division: DivisionLayout;
  selected: boolean;
  disabled: boolean;
  ordinal: number;
  systemIndex: number;
  registerElement: (element: SVGGElement | null) => void;
  onSelectDivision: (id: string) => void;
  onDeleteDivision: (id: string) => void;
}

export function DivisionControl({
  division,
  selected,
  disabled,
  ordinal,
  systemIndex,
  registerElement,
  onSelectDivision,
  onDeleteDivision,
}: DivisionControlProps) {
  return (
    <g
      ref={registerElement}
      className={`score__division${selected ? ' score__division--selected' : ''}`}
      data-division-id={division.divisionId}
      data-division-kind={division.kind}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-label={`${division.kind} division ${ordinal}, system ${systemIndex + 1}. Enter or Space selects; Delete or Backspace removes. Use division controls to change kind or insert before or after.`}
      pointerEvents={disabled ? 'none' : 'all'}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onSelectDivision(division.divisionId);
          focusAndReveal(event.currentTarget);
        }
      }}
      onKeyDown={(event) => {
        if (
          disabled ||
          event.nativeEvent.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.repeat
        )
          return;
        if (
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.key === 'Delete' ||
          event.key === 'Backspace'
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Delete' || event.key === 'Backspace')
            onDeleteDivision(division.divisionId);
          else onSelectDivision(division.divisionId);
        }
      }}
    >
      <rect
        className="score__division-target"
        {...division.hitBounds}
        fill="transparent"
      />
      <rect
        className="score__division-selection"
        {...division.hitBounds}
        rx={3}
        pointerEvents="none"
        aria-hidden="true"
      />
      <DivisionInk division={division} />
    </g>
  );
}
