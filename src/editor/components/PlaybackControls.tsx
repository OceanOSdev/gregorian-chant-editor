import { useEffect, useId, useRef, useState } from 'react';
import type { ChantDocument } from '../domain/chant-document';
import type { PerformanceResult } from '../playback/performance';
import type { PlaybackState } from '../playback/playback-controller';
import { usePlayback } from '../playback/use-playback';
import './PlaybackControls.css';

function unplayableReason(result: PerformanceResult): string | null {
  if (!result.ok)
    return result.reason === 'pitch-out-of-range'
      ? 'A note is outside the playable range.'
      : 'This score cannot be played.';
  return result.performance.notes.length ? null : 'No notes to play.';
}

function statusText(state: PlaybackState, unplayable: string | null) {
  switch (state.status) {
    case 'starting':
      return 'Starting audio…';
    case 'playing':
      return 'Playing';
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

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="9" height="9" fill="currentColor" />
    </svg>
  );
}

/**
 * Play and Stop for the whole score, at the end of the sticky toolbar's
 * Quilisma figure row. Playback stays separate from document editing and
 * history; it reads the current document and never changes it.
 *
 * Narrow layouts show only the icons; the button text stays in the
 * accessible name. The polite status is always announced, and is shown where
 * there is room and whenever playback failed.
 *
 * The buttons use `aria-disabled` rather than `disabled` so keyboard focus is
 * not lost when playback starts or ends.
 *
 * The sticky toolbar stops sticking when it is too tall or the viewport is
 * short. If the controls then scroll out of view during playback, the same
 * group pins itself to the bottom corner of the viewport so Stop stays
 * reachable; its slot keeps its size, so nothing shifts.
 */
export function PlaybackControls({ document }: { document: ChantDocument }) {
  const statusId = useId();
  const { state, interpretation, play, stop } = usePlayback(document);
  const active = state.status === 'starting' || state.status === 'playing';
  const unplayable = unplayableReason(interpretation);
  const canPlay = !active && !unplayable;
  const slot = useRef<HTMLDivElement>(null);
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
          className="editor-playback__play"
          aria-disabled={!canPlay}
          aria-describedby={statusId}
          title={unplayable ?? 'Play the whole score from the beginning'}
          onClick={() => {
            if (canPlay) play();
          }}
        >
          <PlayIcon />
          <span className="editor-playback__label">Play</span>
        </button>
        <button
          type="button"
          className="editor-playback__stop"
          aria-disabled={!active}
          title="Stop playback"
          onClick={() => {
            if (active) stop();
          }}
        >
          <StopIcon />
          <span className="editor-playback__label">Stop</span>
        </button>
        <span
          id={statusId}
          className="editor-playback__status"
          role="status"
          data-playback-status={state.status}
        >
          {statusText(state, unplayable)}
        </span>
      </div>
    </div>
  );
}
