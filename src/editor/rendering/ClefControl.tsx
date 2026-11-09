import { clefName } from '../domain/clef';
import type { Clef } from '../domain/chant-document';
import type { ClefGeometry } from '../layout/clef-geometry';
import { focusAndReveal } from './focus-visibility';

export function ClefControl({
  draft = false,
  editingClef,
  onStep,
  changeId,
  onDelete,
  clef,
  selected,
  disabled,
  onSelect,
  onChange,
  registerElement,
}: {
  draft?: boolean;
  editingClef?: Clef;
  onStep?: (direction: 1 | -1) => void;
  changeId?: string;
  onDelete?: () => void;
  clef: ClefGeometry;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onChange?: (clef: Clef) => void;
  registerElement: (element: SVGGElement | null) => void;
}) {
  const current = editingClef ?? clef;
  return (
    <g
      ref={registerElement}
      data-initial-clef={changeId ? undefined : 'true'}
      data-clef-change-id={changeId}
      className={`score__clef-control${selected ? ' score__clef-control--selected' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-label={`${changeId ? 'Authored' : 'Initial'} ${clefName(current)} clef, ${editingClef ? 'draft ' : ''}staff line ${current.staffLine} from bottom. ${editingClef ? 'Staged edit; Tab or Shift+Tab reaches Apply/Cancel' : 'Enter or Space selects'}; Arrow Up or Down ${changeId ? 'moves the draft one staff line and keeps score focus. Apply commits with the shared pitch mode; Escape cancels. Left and Right do not move this clef; outside a draft, Delete or Backspace removes it with a pitch choice when needed' : 'changes line and preserves melody in its initial passage'}. Use clef controls to change type.`}
      pointerEvents={disabled ? 'none' : 'all'}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          if (!editingClef) onSelect();
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
        if (changeId && ['Delete', 'Backspace'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (!editingClef) onDelete?.();
          return;
        }
        if (['Enter', ' ', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Enter' || event.key === ' ') {
            if (!editingClef) onSelect();
          } else if (changeId) onStep?.(event.key === 'ArrowUp' ? 1 : -1);
          else {
            const line = clef.staffLine + (event.key === 'ArrowUp' ? 1 : -1);
            if (line === 1 || line === 2 || line === 3 || line === 4)
              onChange?.({ type: clef.type, staffLine: line });
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
        opacity={draft ? 0.2 : undefined}
        className="score__clef-ink"
        d={clef.path}
        aria-hidden="true"
        pointerEvents="none"
      />
    </g>
  );
}
