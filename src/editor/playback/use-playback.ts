import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChantDocument } from '../domain/chant-document';
import type { Performance } from './performance';
import {
  activeNoteAt,
  performanceAtSpeed,
  performanceFrom,
  type PlaybackSpeed,
} from './performance-navigation';
import { interpretProofreadingPlayback } from './proofreading-performance';
import type { SoundingNoteStore } from './sounding-note';
import {
  createPlaybackController,
  type PlaybackAudioContext,
  type PlaybackController,
  type PlaybackState,
} from './playback-controller';

function createBrowserAudioContext(): PlaybackAudioContext {
  if (typeof AudioContext === 'undefined')
    throw Error('Web Audio is unavailable');
  return new AudioContext();
}

export interface PlayOptions {
  /** Note to start on (from `resolvePlaybackStart`), or null for the start. */
  from: string | null;
  speed: PlaybackSpeed;
}

/**
 * React glue for playback. Interpretation is derived from the current
 * document; any document change (an edit, undo, load or new score) stops
 * playback, so what is heard is never older than the score on screen.
 *
 * While playing, one animation-frame loop samples the controller's audio
 * clock and publishes the sounding note of the performance actually played
 * to `soundingNotes`. Any end of playback cancels the loop and clears it.
 */
export function usePlayback(
  document: ChantDocument,
  soundingNotes: SoundingNoteStore,
) {
  const [state, setState] = useState<PlaybackState>({ status: 'idle' });
  const controller = useRef<PlaybackController | null>(null);
  const played = useRef<Performance | null>(null);
  const interpretation = useMemo(
    () => interpretProofreadingPlayback(document),
    [document],
  );

  useEffect(() => {
    const created = createPlaybackController(
      createBrowserAudioContext,
      setState,
    );
    controller.current = created;
    return () => {
      created.dispose();
      controller.current = null;
      setState({ status: 'idle' });
    };
  }, []);

  useEffect(() => {
    controller.current?.stop();
  }, [document]);

  const playing = state.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    soundingNotes.beginPlayback();
    let frame = 0;
    const follow = () => {
      const elapsed = controller.current?.elapsedSeconds() ?? null;
      const performance = played.current;
      soundingNotes.set(
        elapsed === null || !performance
          ? null
          : activeNoteAt(performance, elapsed),
      );
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => {
      cancelAnimationFrame(frame);
      soundingNotes.set(null);
    };
  }, [playing, soundingNotes]);

  return {
    state,
    interpretation,
    play({ from, speed }: PlayOptions) {
      if (!interpretation.ok) return;
      const performance = performanceAtSpeed(
        performanceFrom(interpretation.performance, from),
        speed,
      );
      played.current = performance;
      controller.current?.play(performance);
    },
    stop() {
      controller.current?.stop();
    },
  };
}
