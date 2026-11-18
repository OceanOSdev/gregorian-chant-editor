import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChantDocument } from '../domain/chant-document';
import { interpretEqualNotes } from './equal-note-performance';
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

/**
 * React glue for playback. Interpretation is derived from the current
 * document; any document change (an edit, undo, load or new score) stops
 * playback, so what is heard is never older than the score on screen.
 */
export function usePlayback(document: ChantDocument) {
  const [state, setState] = useState<PlaybackState>({ status: 'idle' });
  const controller = useRef<PlaybackController | null>(null);
  const interpretation = useMemo(
    () => interpretEqualNotes(document),
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

  return {
    state,
    interpretation,
    play() {
      if (interpretation.ok)
        controller.current?.play(interpretation.performance);
    },
    stop() {
      controller.current?.stop();
    },
  };
}
