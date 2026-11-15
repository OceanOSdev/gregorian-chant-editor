import { scoreViewportTop } from '../rendering/sticky-visibility';
import { createPortal } from 'react-dom';
import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from 'react';
import type { ChantNote, Neume, NoteForm } from '../domain/chant-document';
import {
  allowedNoteForms,
  isNoteForm,
  noteFormLabels,
} from '../domain/note-forms';
import { getMoraScope, moraChoices, type MoraScope } from '../domain/mora';
import { allowsNotePatch, neumeAppearanceName } from '../domain/neume';
import {
  isLiquescenceFor,
  liquescenceChoices,
  liquescenceRejection,
  liquescentFigure,
  liquescentFigureFor,
  liquescentFigureLabels,
  liquescentNoteRestriction,
  neumeLiquescence,
  type NeumeLiquescence,
} from '../domain/liquescence';
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
  accidental?: {
    kind: 'flat' | 'natural' | undefined;
    pitch: string;
    onChange: (kind: 'flat' | 'natural' | undefined) => void;
  };
  ref: Ref<NoteContextToolbarHandle>;
  /** A constituent, or null for whole-neume appearance editing (ADR 0027). */
  note: ChantNote | null;
  neume: Neume;
  /** Refresh browser geometry after semantic/font-driven reflow. */
  layout: ChantLayout;
  getNoteElement: () => SVGGElement | null;
  onFormChange: (form: NoteForm | undefined) => void;
  formError: string | null;
  /** Remounts the alert so a repeated identical reason is announced again. */
  formErrorKey?: number;
  onMoraChange: (scope: MoraScope) => void;
  onEpisemaChange: (
    kind: 'episema' | 'verticalEpisema',
    value: boolean,
  ) => void;
  onHistory: (direction: 'undo' | 'redo') => void;
  onLiquescenceChange: (liquescence: NeumeLiquescence | undefined) => void;
}

export function NoteContextToolbar({
  accidental,
  ref,
  note,
  neume,
  layout,
  getNoteElement,
  onFormChange,
  formError,
  formErrorKey,
  onMoraChange,
  onEpisemaChange,
  onHistory,
  onLiquescenceChange,
}: NoteContextToolbarProps) {
  const [open, setOpen] = useState(true);
  const [position, setPosition] = useState<NoteToolbarPosition | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstControl = useRef<HTMLElement | null>(null);
  const setFirstControl = (element: HTMLElement | null) => {
    firstControl.current = element;
  };
  const focusRequested = useRef(false);
  const refreshPosition = useRef<(() => NoteToolbarPosition | null) | null>(
    null,
  );
  const liquescence = neumeLiquescence(neume);
  const moraOptions = moraChoices(neume.kind, neume.notes.length, liquescence);
  const moraUnavailable = moraOptions.length === 1;
  const neumeName = neumeAppearanceName(neume);
  const moraHelpId = useId();
  const targetId = useId();
  const formHelpId = useId();
  const appearanceHelpId = useId();
  const noteIndex = note ? neume.notes.findIndex((n) => n.id === note.id) : -1;
  // Liquescent figures derive availability from the shared validity rules.
  const figure = liquescentFigure(neume);
  const forms = note
    ? allowedNoteForms(neume.kind, noteIndex, neume.notes.length).filter(
        (form) => !figure || allowsNotePatch(neume, noteIndex, { form }),
      )
    : [];
  const markRestriction = note
    ? liquescentNoteRestriction(neume, noteIndex)
    : null;
  const episemaBlocked =
    !!note &&
    !note.episema &&
    !allowsNotePatch(neume, noteIndex, { episema: true });
  const verticalBlocked =
    !!note &&
    !note.verticalEpisema &&
    !allowsNotePatch(neume, noteIndex, { verticalEpisema: true });

  useImperativeHandle(ref, () => ({
    show() {
      setOpen(true);
    },
    focus() {
      const element = getNoteElement();
      if (!element) return false;
      if (open) {
        if (!position || !firstControl.current) {
          focusAndReveal(element);
          if (!refreshPosition.current?.()) return false;
          focusRequested.current = true;
          return true;
        }
        if (panel.current) panel.current.scrollTop = 0;
        firstControl.current.focus({ preventScroll: true });
      } else {
        focusAndReveal(element);
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
      if (!element || !surface) return null;
      const noteBounds = element.getBoundingClientRect();
      const visual = window.visualViewport;
      const viewport = {
        left: visual?.offsetLeft ?? 0,
        top: scoreViewportTop(element, visual?.offsetTop ?? 0),
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
      return next;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    refreshPosition.current = update;
    update();
    const observer = new ResizeObserver(schedule);
    const stickyToolbar = getNoteElement()
      ?.closest('.chant-editor')
      ?.querySelector('.editor-sticky-toolbar');
    if (stickyToolbar) observer.observe(stickyToolbar);
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
      refreshPosition.current = null;
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
      aria-label={
        note ? 'Selected note properties' : 'Selected neume properties'
      }
      aria-describedby={targetId}
      data-note-context-for={note?.id}
      data-neume-context-for={neume.id}
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
        {note ? `Note ${noteIndex + 1} of ${neumeName}` : `Whole ${neumeName}`}
      </p>
      {formError ? (
        <p
          key={formErrorKey}
          role="alert"
          className="note-form-error note-context-toolbar__error"
        >
          {formError}
        </p>
      ) : null}
      {note ? (
        <>
          <label>
            Form
            <select
              ref={forms.length ? setFirstControl : undefined}
              aria-label="Form"
              aria-describedby={!forms.length ? formHelpId : undefined}
              disabled={!forms.length}
              value={note.form ?? 'default'}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'default' || isNoteForm(value))
                  onFormChange(value === 'default' ? undefined : value);
              }}
            >
              <option value="default">Default form</option>
              {forms.map((form) => (
                <option key={form} value={form}>
                  {noteFormLabels[form]}
                </option>
              ))}
            </select>
          </label>
          {accidental ? (
            <>
              <label>
                Written accidental
                <select
                  ref={!forms.length ? setFirstControl : undefined}
                  aria-label="Written accidental"
                  value={accidental.kind ?? 'none'}
                  onChange={(e) =>
                    accidental.onChange(
                      e.target.value === 'flat'
                        ? 'flat'
                        : e.target.value === 'natural'
                          ? 'natural'
                          : undefined,
                    )
                  }
                >
                  <option value="none">None</option>
                  <option value="flat">Flat</option>
                  <option value="natural">Natural</option>
                </select>
              </label>
              <p>{accidental.pitch}</p>
            </>
          ) : null}
          {!forms.length || markRestriction ? (
            <p id={formHelpId} className="note-context-toolbar__help">
              {markRestriction ?? 'No alternate form for this note.'}
            </p>
          ) : null}
          <label>
            Mora scope
            <select
              ref={
                !forms.length && !accidental && !moraUnavailable
                  ? setFirstControl
                  : undefined
              }
              aria-label="Mora scope"
              aria-disabled={moraUnavailable || undefined}
              disabled={moraUnavailable}
              aria-describedby={moraUnavailable ? moraHelpId : undefined}
              value={getMoraScope(neume) ?? 'none'}
              onChange={(event) => {
                const choice = moraOptions.find(
                  (c) => c.value === event.target.value,
                );
                if (choice) onMoraChange(choice.value);
              }}
            >
              {moraOptions.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
          {moraUnavailable ? (
            <p id={moraHelpId} className="note-context-toolbar__help">
              Mora authoring is unavailable for {neumeName}. This initial scope
              supports no mora marks.
            </p>
          ) : null}
          <label>
            Horizontal episema
            <select
              aria-label="Horizontal episema"
              ref={
                !forms.length && !accidental && moraUnavailable
                  ? setFirstControl
                  : undefined
              }
              disabled={episemaBlocked}
              aria-describedby={episemaBlocked ? formHelpId : undefined}
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
              disabled={verticalBlocked}
              aria-describedby={verticalBlocked ? formHelpId : undefined}
              value={note.verticalEpisema ? 'on' : 'off'}
              onChange={(event) =>
                onEpisemaChange('verticalEpisema', event.target.value === 'on')
              }
            >
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
          </label>
        </>
      ) : null}
      {isLiquescenceFor(neume.kind, 'diminutive') ? (
        <NeumeAppearanceControl
          neume={neume}
          liquescence={liquescence}
          helpId={appearanceHelpId}
          controlRef={note ? undefined : setFirstControl}
          onChange={onLiquescenceChange}
        />
      ) : null}
      <button
        type="button"
        aria-label="Close note properties"
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

/**
 * Whole-neume liquescent appearance (ADR 0027 D10): an explicit Podatus
 * selector and a binary Clivis toggle. Every choice stays offered; a choice the
 * shared rules reject is explained here and, if chosen, by the rejection alert.
 */
function NeumeAppearanceControl({
  neume,
  liquescence,
  helpId,
  controlRef,
  onChange,
}: {
  neume: Neume;
  liquescence: NeumeLiquescence | undefined;
  helpId: string;
  controlRef?: (element: HTMLElement | null) => void;
  onChange: (liquescence: NeumeLiquescence | undefined) => void;
}) {
  const blocked = liquescence
    ? null
    : liquescenceRejection(neume, 'diminutive')?.replace(
        /^Edit rejected: /,
        '',
      );
  const help = (
    <p id={helpId} className="note-context-toolbar__help">
      {blocked ?? 'Appearance applies to the whole neume.'}
    </p>
  );
  if (neume.kind === 'clivis') {
    const pressed = liquescence === 'diminutive';
    return (
      <>
        <button
          type="button"
          ref={controlRef}
          className="note-context-toolbar__toggle"
          aria-pressed={pressed}
          aria-describedby={helpId}
          onClick={() => onChange(pressed ? undefined : 'diminutive')}
        >
          Liquescent ({liquescentFigureLabels.cephalicus})
        </button>
        {help}
      </>
    );
  }
  return (
    <>
      <label>
        Appearance
        <select
          ref={controlRef}
          aria-label="Appearance"
          aria-describedby={helpId}
          value={liquescence ?? 'ordinary'}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'ordinary') onChange(undefined);
            else if (
              (value === 'diminutive' || value === 'augmentative-descending') &&
              isLiquescenceFor(neume.kind, value)
            )
              onChange(value);
          }}
        >
          <option value="ordinary">Ordinary</option>
          {liquescenceChoices.podatus.map((choice) => {
            const figure = liquescentFigureFor('podatus', choice);
            return figure ? (
              <option key={choice} value={choice}>
                {liquescentFigureLabels[figure]}
              </option>
            ) : null;
          })}
        </select>
      </label>
      {help}
    </>
  );
}
