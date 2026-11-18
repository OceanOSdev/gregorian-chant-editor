import { useEffect, useId, useRef, useState } from 'react';
import type { ChantDocument } from '../domain/chant-document';
import type { PerformanceResult } from '../playback/performance';
import {
  playbackSpeeds,
  resolvePlaybackStart,
  type PlaybackSpeed,
} from '../playback/performance-navigation';
import type { PlaybackState } from '../playback/playback-controller';
import type { SoundingNoteStore } from '../playback/sounding-note';
import { usePlayback } from '../playback/use-playback';
import type { EditorSelection } from '../state/selection';
import './PlaybackControls.css';

function unplayableReason(result: PerformanceResult): string | null {
  if (!result.ok)
    return result.reason === 'pitch-out-of-range'
      ? 'A note is outside the playable range.'
      : 'This score cannot be played.';
  return result.performance.notes.length ? null : 'No notes to play.';
}

const speedLabel = (speed: PlaybackSpeed) => `${speed}×`;

/**
 * The live status: playback state only. Selection changes never change it,
 * so editing does not trigger announcements; the start hint is separate.
 */
function statusText(
  state: PlaybackState,
  unplayable: string | null,
  speed: PlaybackSpeed,
) {
  switch (state.status) {
    case 'starting':
      return 'Starting audio…';
    case 'playing':
      return speed === 1 ? 'Playing' : `Playing at ${speedLabel(speed)}`;
    case 'failed':
      return state.message;
    case 'idle':
      return unplayable ?? '';
  }
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
    </svg>
  );
}

function OptionsIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="3.5" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="9" height="9" fill="currentColor" />
    </svg>
  );
}

interface PlaybackControlsProps {
  document: ChantDocument;
  /** Read only when Play is pressed, to choose the starting note. */
  selection: EditorSelection;
  soundingNotes: SoundingNoteStore;
}

/**
 * Playback controls at the end of the sticky toolbar's Quilisma figure row: a
 * Play/Stop toggle and a Playback options disclosure ("Play from beginning"
 * and the audition speed). Playback stays separate from document editing and
 * history; it reads the document and selection and never changes them.
 *
 * Play starts at the current musical selection (`resolvePlaybackStart`), or
 * at the beginning. Changing the selection during playback does not move it.
 * Speed is chosen before Play and is transient UI state.
 *
 * The toggle is one button whose name changes between Play and Stop, so
 * keyboard focus stays put when playback starts or ends. Narrow layouts show
 * icons only; names stay in visually hidden text.
 *
 * The sticky toolbar stops sticking when it is too tall or the viewport is
 * short. If the controls then scroll out of view during playback, the same
 * group pins itself to the bottom corner of the viewport so Stop stays
 * reachable; its slot keeps its size, so nothing shifts.
 */
export function PlaybackControls({
  document,
  selection,
  soundingNotes,
}: PlaybackControlsProps) {
  const statusId = useId();
  const startHintId = useId();
  const panelId = useId();
  const { state, interpretation, play, stop } = usePlayback(
    document,
    soundingNotes,
  );
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const active = state.status === 'starting' || state.status === 'playing';
  const unplayable = unplayableReason(interpretation);
  const canPlay = !active && !unplayable;
  const startNoteId = unplayable
    ? null
    : resolvePlaybackStart(document, selection);

  const slot = useRef<HTMLDivElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const optionsButton = useRef<HTMLButtonElement>(null);
  const [slotVisible, setSlotVisible] = useState(true);
  useEffect(() => {
    const element = slot.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setSlotVisible(entry.intersectionRatio >= 0.99),
      { threshold: [0, 0.99, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const pinned = active && !slotVisible;

  function closeOptions() {
    setOptionsOpen(false);
    optionsButton.current?.focus();
  }

  // Dismissal follows the NeumeFamilyMenu contract: a press on the score only
  // closes the options (it selects, places or edits nothing and keeps focus);
  // a press on another control closes them and acts as usual. Escape is taken
  // in the window capture phase, ahead of the editor's own Escape handling
  // (pending clef or accidental placement, lyric move, clearing the
  // selection), so it closes the options and nothing else.
  useEffect(() => {
    if (!optionsOpen) return;
    const keepScoreFocus = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.score'))
        event.preventDefault();
    };
    const dismiss = (event: MouseEvent) => {
      if (
        !(event.target instanceof Node) ||
        options.current?.contains(event.target)
      )
        return;
      if (event.target instanceof Element && event.target.closest('.score')) {
        event.preventDefault();
        event.stopPropagation();
        closeOptions();
        return;
      }
      setOptionsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeOptions();
    };
    // `document` is this component's score prop; the DOM is window.document.
    window.document.addEventListener('pointerdown', keepScoreFocus, true);
    window.document.addEventListener('click', dismiss, true);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.document.removeEventListener('pointerdown', keepScoreFocus, true);
      window.document.removeEventListener('click', dismiss, true);
      window.removeEventListener('keydown', escape, true);
    };
  }, [optionsOpen]);

  return (
    <div className="editor-playback-slot" ref={slot}>
      <div
        className={`editor-playback${pinned ? ' editor-playback--pinned' : ''}`}
        role="group"
        aria-label="Playback"
        data-playback-status={state.status}
      >
        <button
          type="button"
          className="editor-playback__toggle"
          data-playback-action={active ? 'stop' : 'play'}
          aria-disabled={!active && !canPlay}
          aria-describedby={`${startHintId} ${statusId}`}
          title={
            active
              ? 'Stop playback'
              : (unplayable ??
                (startNoteId
                  ? 'Play from the selection'
                  : 'Play the whole score from the beginning'))
          }
          onClick={() => {
            if (active) stop();
            else if (canPlay) play({ from: startNoteId, speed });
          }}
        >
          {active ? <StopIcon /> : <PlayIcon />}
          <span className="editor-playback__label">
            {active ? 'Stop' : 'Play'}
          </span>
        </button>
        <div
          className="editor-playback__options"
          ref={options}
          // Focus leaving the options (Tab, Shift+Tab, a click elsewhere)
          // closes them, as for NeumeFamilyMenu.
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setOptionsOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Tab' || !optionsOpen) return;
            // Firefox automation can move focus without a React blur.
            requestAnimationFrame(() => {
              if (!options.current?.contains(window.document.activeElement))
                setOptionsOpen(false);
            });
          }}
        >
          <button
            type="button"
            ref={optionsButton}
            className="editor-playback__options-button"
            aria-expanded={optionsOpen}
            aria-controls={optionsOpen ? panelId : undefined}
            title="Playback options"
            onClick={() => setOptionsOpen((open) => !open)}
          >
            <OptionsIcon />
            <span className="editor-sr-only">Playback options, speed </span>
            <span className="editor-playback__speed">{speedLabel(speed)}</span>
          </button>
          {optionsOpen ? (
            <div
              id={panelId}
              className="editor-playback__panel"
              role="group"
              aria-label="Playback options"
            >
              <button
                type="button"
                aria-disabled={!canPlay}
                onClick={() => {
                  if (!canPlay) return;
                  closeOptions();
                  play({ from: null, speed });
                }}
              >
                Play from beginning
              </button>
              <fieldset disabled={active}>
                <legend>Speed</legend>
                {playbackSpeeds.map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name={`${panelId}-speed`}
                      checked={speed === value}
                      onChange={() => setSpeed(value)}
                    />
                    {speedLabel(value)}
                  </label>
                ))}
              </fieldset>
              {active ? (
                <p className="editor-playback__note">
                  Change the speed after Stop.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {/* Not live: read with the toggle's description, never announced
            when the selection changes. */}
        <span id={startHintId} className="editor-playback__hint">
          {!active && startNoteId ? 'Plays from the selection' : ''}
        </span>
        <span
          id={statusId}
          className="editor-playback__status"
          role="status"
          data-playback-status={state.status}
        >
          {statusText(state, unplayable, speed)}
        </span>
      </div>
    </div>
  );
}
