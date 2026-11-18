import type { Performance } from './performance';
import {
  schedulePerformance,
  type ScheduledPerformance,
  type ToneContext,
} from './web-audio-synth';

/** The `AudioContext` lifecycle the controller needs. */
export interface PlaybackAudioContext extends ToneContext {
  readonly state: string;
  resume(): Promise<void>;
  close(): Promise<void>;
}

export type PlaybackState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'playing' }
  | { status: 'failed'; message: string };

export interface PlaybackController {
  /** Stops any current playback, then plays this performance from its 0 s. */
  play(performance: Performance): void;
  stop(): void;
  /**
   * Seconds of the current performance elapsed on the audio clock (negative
   * during the scheduling headroom), or null when nothing is scheduled.
   */
  elapsedSeconds(): number | null;
  /** Stops and closes the audio context; later calls do nothing. */
  dispose(): void;
}

export const playbackMessages = {
  unavailable: 'Audio playback is not available in this browser.',
  blocked:
    'The browser did not allow audio to start. Check that this site may play sound, then press Play again.',
  failed: 'Audio playback failed. Press Play to try again.',
} as const;

/**
 * Owns one lazily created audio context and at most one playing session.
 *
 * `play` must be called from a user gesture: it creates or resumes the
 * context synchronously in that gesture. Every play or stop invalidates the
 * previous session, so a late `resume()` or `ended` callback from an old
 * session can never start sound or change the reported state.
 */
export function createPlaybackController(
  createContext: () => PlaybackAudioContext,
  onStateChange: (state: PlaybackState) => void,
): PlaybackController {
  let context: PlaybackAudioContext | null = null;
  let scheduled: ScheduledPerformance | null = null;
  let session = 0;
  let disposed = false;
  let state: PlaybackState = { status: 'idle' };

  function report(next: PlaybackState) {
    if (disposed || (next.status === 'idle' && state.status === 'idle')) return;
    state = next;
    onStateChange(next);
  }

  function silence() {
    session++;
    const current = scheduled;
    scheduled = null;
    try {
      current?.stop();
    } catch {
      // The context may already be closed; there is nothing left to silence.
    }
  }

  function begin(
    audio: PlaybackAudioContext,
    performance: Performance,
    token: number,
  ) {
    if (token !== session) return;
    if (audio.state !== 'running') {
      report({ status: 'failed', message: playbackMessages.blocked });
      return;
    }
    try {
      scheduled = schedulePerformance(audio, performance, () => {
        if (token !== session) return;
        scheduled = null;
        report({ status: 'idle' });
      });
      report({ status: 'playing' });
    } catch {
      scheduled = null;
      report({ status: 'failed', message: playbackMessages.failed });
    }
  }

  return {
    play(performance) {
      if (disposed) return;
      silence();
      if (!performance.notes.length) {
        report({ status: 'idle' });
        return;
      }
      const token = session;
      let audio: PlaybackAudioContext;
      let resumed: Promise<void>;
      try {
        if (!context || context.state === 'closed') context = createContext();
        audio = context;
      } catch {
        report({ status: 'failed', message: playbackMessages.unavailable });
        return;
      }
      try {
        resumed =
          audio.state === 'running' ? Promise.resolve() : audio.resume();
      } catch {
        report({ status: 'failed', message: playbackMessages.blocked });
        return;
      }
      report({ status: 'starting' });
      resumed.then(
        () => begin(audio, performance, token),
        () => {
          if (token === session)
            report({ status: 'failed', message: playbackMessages.blocked });
        },
      );
    },
    stop() {
      silence();
      report({ status: 'idle' });
    },
    elapsedSeconds() {
      return scheduled && context
        ? context.currentTime - scheduled.startTime
        : null;
    },
    dispose() {
      if (disposed) return;
      silence();
      disposed = true;
      const closing = context;
      context = null;
      closing?.close().catch(() => {});
    },
  };
}
