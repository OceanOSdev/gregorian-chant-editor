import { createPortal } from 'react-dom';
import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from 'react';
import type { ChantNote, Neume } from '../domain/chant-document';
import { getMoraScope, moraChoices, type MoraScope } from '../domain/mora';
import {
  positionNoteToolbar,
  type NoteToolbarPosition,
} from '../interaction/position-note-toolbar';
import type { ChantLayout } from '../layout/layout-chant';
import { focusAndReveal } from '../rendering/focus-visibility';
import './NoteContextToolbar.css';

export interface NoteContextToolbarHandle {
  show: () => void;
  focus: () => boolean;
}

interface NoteContextToolbarProps {
  ref: Ref<NoteContextToolbarHandle>;
  note: ChantNote;
  neume: Neume;
  /** Refresh browser geometry after semantic/font-driven reflow. */
  layout: ChantLayout;
  getNoteElement: () => SVGGElement | null;
  onMoraChange: (scope: MoraScope) => void;
  onEpisemaChange: (
    kind: 'episema' | 'verticalEpisema',
    value: boolean,
  ) => void;
  onHistory: (direction: 'undo' | 'redo') => void;
}

export function NoteContextToolbar({
  ref,
  note,
  neume,
  layout,
  getNoteElement,
  onMoraChange,
  onEpisemaChange,
  onHistory,
}: NoteContextToolbarProps) {
  const [open, setOpen] = useState(true);
  const [position, setPosition] = useState<NoteToolbarPosition | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstControl = useRef<HTMLSelectElement>(null);
  const focusRequested = useRef(false);
  const targetId = useId();

  useImperativeHandle(ref, () => ({
    show() {
      setOpen(true);
    },
    focus() {
      if (!getNoteElement()) return false;
      if (open) {
        if (!position || !firstControl.current) return false;
        if (panel.current) panel.current.scrollTop = 0;
        firstControl.current.focus({ preventScroll: true });
      } else {
        focusRequested.current = true;
        setOpen(true);
      }
      return true;
    },
  }));

  function close() {
    setOpen(false);
    focusRequested.current = false;
    getNoteElement()?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const update = () => {
      const element = getNoteElement();
      const surface = panel.current;
      if (!element || !surface) return;
      const noteBounds = element.getBoundingClientRect();
      const visual = window.visualViewport;
      const viewport = {
        left: visual?.offsetLeft ?? 0,
        top: visual?.offsetTop ?? 0,
        right:
          (visual?.offsetLeft ?? 0) +
          (visual?.width ?? document.documentElement.clientWidth),
        bottom:
          (visual?.offsetTop ?? 0) + (visual?.height ?? window.innerHeight),
      };
      const clip = element.closest('.score-viewport')?.getBoundingClientRect();
      const visible =
        noteBounds.right > Math.max(viewport.left, clip?.left ?? -Infinity) &&
        noteBounds.left < Math.min(viewport.right, clip?.right ?? Infinity) &&
        noteBounds.bottom > Math.max(viewport.top, clip?.top ?? -Infinity) &&
        noteBounds.top < Math.min(viewport.bottom, clip?.bottom ?? Infinity);
      const ownsFocus = surface.contains(document.activeElement);
      const next =
        visible || ownsFocus
          ? positionNoteToolbar(noteBounds, viewport, {
              width: Math.min(320, viewport.right - viewport.left - 16),
              height:
                surface.scrollHeight +
                surface.offsetHeight -
                surface.clientHeight,
            })
          : null;
      setPosition((previous) =>
        previous?.left === next?.left &&
        previous?.top === next?.top &&
        previous?.width === next?.width &&
        previous?.maxHeight === next?.maxHeight
          ? previous
          : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(schedule);
    if (panel.current) observer.observe(panel.current);
    const element = getNoteElement();
    if (element) {
      observer.observe(element);
      if (element.ownerSVGElement) observer.observe(element.ownerSVGElement);
    }
    document.addEventListener('focusin', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('focusin', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [getNoteElement, layout, open]);

  useLayoutEffect(() => {
    if (open && position && focusRequested.current) {
      focusRequested.current = false;
      firstControl.current?.focus({ preventScroll: true });
    }
  }, [open, position]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panel}
      className="note-context-toolbar"
      role="group"
      aria-label="Selected note markings"
      aria-describedby={targetId}
      data-note-context-for={note.id}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        width: position?.width,
        maxHeight: position?.maxHeight,
        visibility: position ? 'visible' : 'hidden',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // Native select arrows/search remain native; notation shortcuts cannot
        // escape this surface and move/delete/insert music behind it.
        event.stopPropagation();
        if (event.nativeEvent.isComposing) return;
        if (
          event.key === 'Escape' &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          close();
        } else if (
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          ['z', 'y'].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          onHistory(
            event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo',
          );
        } else if (
          event.key === 'Tab' &&
          event.shiftKey &&
          event.target === firstControl.current
        ) {
          event.preventDefault();
          getNoteElement()?.focus({ preventScroll: true });
        }
      }}
    >
      <p id={targetId} className="note-context-toolbar__target">
        Note {neume.notes.findIndex((n) => n.id === note.id) + 1} of{' '}
        {neume.kind}
      </p>
      <label>
        Mora scope
        <select
          ref={firstControl}
          aria-label="Mora scope"
          value={getMoraScope(neume) ?? 'none'}
          onChange={(event) => {
            const choice = moraChoices(neume.kind).find(
              (c) => c.value === event.target.value,
            );
            if (choice) onMoraChange(choice.value);
          }}
        >
          {moraChoices(neume.kind).map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Horizontal episema
        <select
          aria-label="Horizontal episema"
          value={note.episema ? 'on' : 'off'}
          onChange={(event) =>
            onEpisemaChange('episema', event.target.value === 'on')
          }
        >
          <option value="off">Off</option>
          <option value="on">On</option>
        </select>
      </label>
      <label>
        Vertical episema
        <select
          aria-label="Vertical episema"
          value={note.verticalEpisema ? 'on' : 'off'}
          onChange={(event) =>
            onEpisemaChange('verticalEpisema', event.target.value === 'on')
          }
        >
          <option value="off">Off</option>
          <option value="on">On</option>
        </select>
      </label>
      <button
        type="button"
        aria-label="Close note markings"
        onClick={close}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || event.shiftKey) return;
          const element = getNoteElement();
          const controls = [
            ...(element?.ownerSVGElement?.querySelectorAll<SVGElement>(
              '[tabindex="0"]',
            ) ?? []),
          ];
          const next = element ? controls[controls.indexOf(element) + 1] : null;
          if (next) {
            event.preventDefault();
            focusAndReveal(next);
          }
        }}
      >
        Close <span aria-hidden="true">×</span>
      </button>
    </div>,
    document.body,
  );
}
