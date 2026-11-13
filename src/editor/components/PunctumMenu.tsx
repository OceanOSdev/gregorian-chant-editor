import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from 'react';
import { staffPosition } from '../domain/chant-document';
import { buildNeumeGeometry } from '../layout/neume-geometry';
import { NeumeInk } from '../rendering/NeumeInk';
import './PunctumMenu.css';

export type PunctumFamilyKind = 'punctum' | 'bistropha' | 'tristropha';
const variants = ['punctum', 'bistropha', 'tristropha'] as const;
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

export function PunctumMenu({
  active,
  remembered,
  onChoose,
  buttonProps,
  buttonRef,
  primaryProps,
  primaryRef,
}: {
  active: PunctumFamilyKind | null;
  remembered: PunctumFamilyKind;
  onChoose: (kind: PunctumFamilyKind) => void;
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
  const menuId = useId();
  const label = (kind: PunctumFamilyKind) =>
    kind[0].toUpperCase() + kind.slice(1);
  useEffect(() => {
    if (!open) return;
    items.current.get(variants.indexOf(active ?? remembered))?.focus();
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
        event.preventDefault();
        event.stopPropagation();
      }
      setOpen(false);
    };
    document.addEventListener('pointerdown', preserveFocus, true);
    document.addEventListener('click', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', preserveFocus, true);
      document.removeEventListener('click', dismiss, true);
    };
  }, [open, active, remembered]);
  useEffect(() => {
    if (buttonProps.disabled) setOpen(false);
  }, [buttonProps.disabled]);
  function close() {
    setOpen(false);
    arrow.current?.focus();
  }
  return (
    <span
      ref={root}
      className="punctum-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        {...primaryProps}
        data-tool="punctum"
        ref={primaryRef}
        className="punctum-menu__primary"
      >
        <PunctumIcon kind="punctum" />
        Punctum
      </button>
      <button
        {...buttonProps}
        ref={(button) => {
          arrow.current = button;
          buttonRef(button);
        }}
        aria-label={`Punctum family variants${active ? `, active ${label(active)}` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="punctum-menu__arrow"
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
            if (!event.repeat) setOpen(!open);
          }
        }}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <span
          id={menuId}
          role="menu"
          aria-label="Punctum family"
          className="punctum-menu__items"
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
                  ? 2
                  : event.key === 'ArrowDown'
                    ? (current + 1) % 3
                    : event.key === 'ArrowUp'
                      ? (current + 2) % 3
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
              onClick={() => {
                onChoose(kind);
                close();
              }}
            >
              <PunctumIcon kind={kind} />
              {label(kind)}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
