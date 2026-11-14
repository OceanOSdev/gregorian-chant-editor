import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { staffPosition } from '../domain/chant-document';
import { buildNeumeGeometry } from '../layout/neume-geometry';
import {
  createNeumeEntryPitches,
  semanticNeumeKind,
  type GraphicalNeumeKind,
} from '../neume-entry-pitches';
import { NeumeInk } from '../rendering/NeumeInk';
import type { PunctumFamilyKind } from '../state/editor-tool';
import './NeumeFamilyMenu.css';

export function PunctumIcon({ kind }: { kind: PunctumFamilyKind }) {
  const count = kind === 'punctum' ? 1 : kind === 'bistropha' ? 2 : 3;
  const geometry = buildNeumeGeometry(
    kind,
    Array.from({ length: count }, () => staffPosition(0)),
    0,
    10,
  );
  return (
    <svg aria-hidden="true" width="42" height="20" viewBox="-2 0 52 20">
      <NeumeInk ink={geometry.ink} />
    </svg>
  );
}

/** The exact default entry contour, drawn from the shared measured geometry. */
export function EntryIcon({ kind }: { kind: GraphicalNeumeKind }) {
  const geometry = buildNeumeGeometry(
    semanticNeumeKind(kind),
    createNeumeEntryPitches(kind, staffPosition(0)).staffPositions,
    0,
    0,
  );
  const { x, y, width, height } = geometry.bounds;
  const pad = 2;
  const box = Math.max(width, height) + pad * 2;
  // A square box keeps every family member at one scale and 22px icon size.
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox={`${x + width / 2 - box / 2} ${y + height / 2 - box / 2} ${box} ${box}`}
    >
      <NeumeInk ink={geometry.ink} />
    </svg>
  );
}

/**
 * Split control for one neume family: the primary button always arms the
 * ordinary family member; the chevron menu arms an exact variant without
 * inserting music. Shared by the Punctum and Podatus families.
 */
export function NeumeFamilyMenu<K extends GraphicalNeumeKind>({
  family,
  familyClassName,
  variants,
  label,
  icon,
  active,
  remembered,
  onChoose,
  buttonProps,
  buttonRef,
  primaryProps,
  primaryRef,
}: {
  /** Visible family name, also the ordinary member's label. */
  family: string;
  familyClassName: string;
  /** The ordinary member first, then the extended variants. */
  variants: readonly [K, ...K[]];
  label: (kind: K) => string;
  icon: (kind: K) => ReactNode;
  active: K | null;
  remembered: K;
  onChoose: (kind: K) => void;
  buttonProps: ButtonHTMLAttributes<HTMLButtonElement> & {
    'data-tool': string;
  };
  buttonRef: (button: HTMLButtonElement | null) => void;
  primaryProps: ButtonHTMLAttributes<HTMLButtonElement>;
  primaryRef: (button: HTMLButtonElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLButtonElement | null>(null);
  const items = useRef(new Map<number, HTMLButtonElement>());
  const menu = useRef<HTMLSpanElement>(null);
  const [alignEnd, setAlignEnd] = useState(false);
  const menuId = useId();
  // Chosen when the menu opens; later tool changes must not move focus.
  const openingItem = useRef(0);
  const primary = variants[0];
  useEffect(() => {
    if (!open) return;
    items.current.get(openingItem.current)?.focus();
    const preserveFocus = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.score'))
        event.preventDefault();
    };
    const dismiss = (event: MouseEvent) => {
      if (
        !(event.target instanceof Node) ||
        root.current?.contains(event.target)
      )
        return;
      if (event.target instanceof Element && event.target.closest('.score')) {
        // A dismissal-only score click edits nothing; keep keyboard context.
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      setOpen(false);
    };
    document.addEventListener('pointerdown', preserveFocus, true);
    document.addEventListener('click', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', preserveFocus, true);
      document.removeEventListener('click', dismiss, true);
    };
  }, [open]);
  // Keep the open menu within the viewport when its control sits at the
  // right of a wrapped narrow toolbar.
  useLayoutEffect(() => {
    if (!open) {
      setAlignEnd(false);
      return;
    }
    const bounds = menu.current?.getBoundingClientRect();
    if (bounds && bounds.right > document.documentElement.clientWidth - 4)
      setAlignEnd(true);
  }, [open]);
  useEffect(() => {
    if (buttonProps.disabled) setOpen(false);
  }, [buttonProps.disabled]);
  function close() {
    setOpen(false);
    arrow.current?.focus();
  }
  function toggle() {
    if (!open)
      openingItem.current = Math.max(0, variants.indexOf(active ?? remembered));
    setOpen(!open);
  }
  const last = variants.length - 1;
  return (
    <span
      ref={root}
      className={`neume-family-menu ${familyClassName}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        {...primaryProps}
        data-tool={primary}
        ref={primaryRef}
        className="neume-family-menu__primary"
        onClick={(event) => {
          setOpen(false);
          primaryProps.onClick?.(event);
        }}
      >
        {icon(primary)}
        {family}
      </button>
      <button
        {...buttonProps}
        ref={(button) => {
          arrow.current = button;
          buttonRef(button);
        }}
        aria-label={`${family} family variants${active ? `, active ${label(active)}` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="neume-family-menu__arrow"
        data-active-variant={active ?? undefined}
        onKeyDown={(event) => {
          if (
            event.nativeEvent.isComposing ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) toggle();
          }
        }}
        onClick={toggle}
      >
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <span
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={`${family} family`}
          className="neume-family-menu__items"
          data-align={alignEnd ? 'end' : undefined}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (
              event.nativeEvent.isComposing ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey
            )
              return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!event.repeat && event.target instanceof HTMLButtonElement)
                event.target.click();
              return;
            }
            if (event.key === 'Tab') {
              // Let native Tab leave before removing the focused item. Firefox
              // automation can move focus without emitting React blur.
              requestAnimationFrame(() => setOpen(false));
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
              return;
            }
            const current = variants.findIndex(
              (_, i) => items.current.get(i) === document.activeElement,
            );
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? last
                  : event.key === 'ArrowDown'
                    ? (current + 1) % variants.length
                    : event.key === 'ArrowUp'
                      ? (current + last) % variants.length
                      : null;
            if (next !== null) {
              event.preventDefault();
              items.current.get(next)?.focus();
            }
          }}
        >
          {variants.map((kind, index) => (
            <button
              key={kind}
              ref={(button) => {
                if (button) items.current.set(index, button);
                else items.current.delete(index);
              }}
              type="button"
              role="menuitemradio"
              aria-checked={active === kind}
              tabIndex={-1}
              data-variant={kind}
              onClick={() => {
                onChoose(kind);
                close();
              }}
            >
              {icon(kind)}
              {label(kind)}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
