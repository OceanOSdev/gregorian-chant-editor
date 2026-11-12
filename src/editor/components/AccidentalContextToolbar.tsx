import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  positionNoteToolbar,
  type NoteToolbarPosition,
} from '../interaction/position-note-toolbar';
import type { ChantLayout } from '../layout/layout-chant';
import './NoteContextToolbar.css';

export function AccidentalContextToolbar({
  id,
  layout,
  children,
  onEscape,
  onHistory,
}: {
  id: string;
  layout: ChantLayout;
  children: ReactNode;
  onEscape: () => void;
  onHistory: (direction: 'undo' | 'redo') => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<NoteToolbarPosition | null>(null);
  useLayoutEffect(() => {
    const update = () => {
      const glyph = document.querySelector<SVGGElement>(
        `[data-accidental-id="${CSS.escape(id)}"]`,
      );
      const surface = panel.current;
      if (!glyph || !surface) {
        setPosition(null);
        return;
      }
      const b = glyph.getBoundingClientRect(),
        v = window.visualViewport;
      const clip = glyph.closest('.score-viewport')?.getBoundingClientRect();
      const viewport = {
        left: v?.offsetLeft ?? 0,
        top: v?.offsetTop ?? 0,
        right: (v?.offsetLeft ?? 0) + (v?.width ?? innerWidth),
        bottom: (v?.offsetTop ?? 0) + (v?.height ?? innerHeight),
      };
      if (
        (b.bottom < Math.max(viewport.top, clip?.top ?? -Infinity) ||
          b.top > Math.min(viewport.bottom, clip?.bottom ?? Infinity) ||
          b.right < Math.max(viewport.left, clip?.left ?? -Infinity) ||
          b.left > Math.min(viewport.right, clip?.right ?? Infinity)) &&
        !surface.contains(document.activeElement)
      ) {
        setPosition(null);
        return;
      }
      setPosition(
        positionNoteToolbar(b, viewport, {
          width: Math.min(320, viewport.right - viewport.left - 16),
          height:
            surface.scrollHeight + surface.offsetHeight - surface.clientHeight,
        }),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [id, layout]);
  return createPortal(
    <div
      ref={panel}
      className="note-context-toolbar accidental-context-toolbar"
      role="group"
      aria-label="Selected accidental properties"
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        width: position?.width,
        maxHeight: position?.maxHeight,
        visibility: position ? 'visible' : 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (
          (e.ctrlKey || e.metaKey) &&
          !e.altKey &&
          ['z', 'y'].includes(e.key.toLowerCase())
        ) {
          e.preventDefault();
          onHistory(
            e.key.toLowerCase() === 'y' || e.shiftKey ? 'redo' : 'undo',
          );
          return;
        }
        if (
          e.key === 'Tab' &&
          e.shiftKey &&
          e.target === panel.current?.querySelector('select,button')
        ) {
          e.preventDefault();
          document
            .querySelector<SVGGElement>(
              `[data-accidental-id="${CSS.escape(id)}"]`,
            )
            ?.focus();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onEscape();
          document
            .querySelector<SVGGElement>(
              `[data-accidental-id="${CSS.escape(id)}"]`,
            )
            ?.focus();
        }
      }}
    >
      {children}
      <button
        type="button"
        onClick={() => {
          onEscape();
          document
            .querySelector<SVGGElement>(
              `[data-accidental-id="${CSS.escape(id)}"]`,
            )
            ?.focus();
        }}
      >
        Close accidental properties
      </button>
    </div>,
    document.body,
  );
}
