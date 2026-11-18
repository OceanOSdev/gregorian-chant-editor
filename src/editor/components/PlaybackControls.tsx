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

/**
 * Play and Stop for the whole score. Playback stays separate from document
 * editing and history; it reads the current document and never changes it.
 *
 * The buttons use `aria-disabled` rather than `disabled` so keyboard focus is
 * not lost when playback starts or ends.
 *
 * While playback is active and the controls' place in the page is scrolled
 * out of view, the same group pins itself to the bottom corner of the
 * viewport, so Stop stays reachable without enlarging the sticky toolbar. Its
 * slot keeps its height, so nothing shifts.
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
      >
        <button
          type="button"
          aria-disabled={!canPlay}
          aria-describedby={statusId}
          title="Play the whole score from the beginning"
          onClick={() => {
            if (canPlay) play();
          }}
        >
          Play
        </button>
        <button
          type="button"
          aria-disabled={!active}
          onClick={() => {
            if (active) stop();
          }}
        >
          Stop
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
