import type { Performance, PerformanceNote } from './performance';

type ProgressHandler = (
  positionSeconds: number,
  noteId: string | null,
  ended: boolean,
) => void;

interface Voice {
  oscillator: OscillatorNode;
  envelope: GainNode;
}

const lookaheadSeconds = 0.15;
const schedulerIntervalMs = 25;
const startLeadSeconds = 0.03;

/** First note whose end is after this position; a boundary belongs to its successor. */
function noteIndexAt(
  notes: readonly PerformanceNote[],
  position: number,
): number {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const note = notes[middle];
    if (note.start + note.duration <= position) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Browser adapter for a derived performance. AudioContext is created/resumed only
 * from play(), which the UI calls in a user gesture. Its clock owns transport;
 * the interval only fills a short scheduling window and reports visual progress.
 */
export class AudioPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private waveform: PeriodicWave | null = null;
  private performance: Performance | null = null;
  private timer: ReturnType<typeof globalThis.setInterval> | null = null;
  private readonly voices = new Set<Voice>();
  private volume = 0.6;
  private positionSeconds = 0;
  private anchorTime = 0;
  private anchorPosition = 0;
  private nextIndex = 0;
  private playing = false;
  private generation = 0;
  private destroyed = false;

  private readonly onProgress: ProgressHandler;
  private readonly onError: (message: string) => void;

  constructor(onProgress: ProgressHandler, onError: (message: string) => void) {
    this.onProgress = onProgress;
    this.onError = onError;
  }

  async play(performance: Performance, fromSeconds = 0): Promise<void> {
    if (this.destroyed) return;
    this.cancelTransport();
    const generation = this.generation;
    this.performance = performance;
    this.positionSeconds = Number.isFinite(fromSeconds)
      ? Math.max(0, Math.min(performance.duration, fromSeconds))
      : 0;
    if (
      !performance.notes.length ||
      this.positionSeconds >= performance.duration
    ) {
      this.positionSeconds = performance.duration;
      this.onProgress(this.positionSeconds, null, true);
      return;
    }

    try {
      const context = this.getContext();
      // Calling resume here, before awaiting anything else, retains the browser
      // activation of the Play button even when resumption is asynchronous.
      if (context.state !== 'running') await context.resume();
      if (this.destroyed || generation !== this.generation) return;
      if (context.state !== 'running') {
        throw new Error(
          'Audio could not start. Press Play to allow browser audio.',
        );
      }
      this.anchorPosition = this.positionSeconds;
      this.anchorTime = context.currentTime + startLeadSeconds;
      this.nextIndex = noteIndexAt(performance.notes, this.positionSeconds);
      this.playing = true;
      this.tick();
      if (this.playing) {
        this.timer = globalThis.setInterval(
          () => this.tick(),
          schedulerIntervalMs,
        );
      }
    } catch (error) {
      if (this.destroyed || generation !== this.generation) return;
      this.cancelTransport();
      const failure =
        error instanceof Error
          ? error
          : new Error(
              'Browser audio could not start. Press Play to try again.',
            );
      this.onError(failure.message);
      throw failure;
    }
  }

  pause(): number {
    this.positionSeconds = this.currentPosition();
    this.cancelTransport();
    this.onProgress(
      this.positionSeconds,
      this.noteAt(this.positionSeconds)?.noteId ?? null,
      false,
    );
    return this.positionSeconds;
  }

  stop(): void {
    this.cancelTransport();
    this.positionSeconds = 0;
    this.onProgress(0, null, false);
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(
        this.volume * 0.18,
        this.context.currentTime,
        0.015,
      );
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelTransport();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.waveform = null;
    this.performance = null;
    if (context && context.state !== 'closed')
      void context.close().catch(() => {});
  }

  private getContext(): AudioContext {
    if (this.context?.state === 'closed') {
      this.context = null;
      this.master = null;
      this.waveform = null;
    }
    if (!this.context) {
      if (typeof globalThis.AudioContext !== 'function') {
        throw new Error('This browser does not support Web Audio playback.');
      }
      const context = new AudioContext();
      let master: GainNode | null = null;
      try {
        master = context.createGain();
        master.gain.setValueAtTime(this.volume * 0.18, context.currentTime);
        master.connect(context.destination);
        // A fundamental with two quiet harmonics gives a soft organ-like tone.
        const waveform = context.createPeriodicWave(
          new Float32Array([0, 0, 0, 0]),
          new Float32Array([0, 1, 0.18, 0.06]),
        );
        this.context = context;
        this.master = master;
        this.waveform = waveform;
      } catch (error) {
        master?.disconnect();
        void context.close().catch(() => {});
        throw error;
      }
    }
    return this.context;
  }

  private currentPosition(): number {
    if (!this.playing || !this.context || !this.performance) {
      return this.positionSeconds;
    }
    return Math.min(
      this.performance.duration,
      Math.max(
        this.anchorPosition,
        this.anchorPosition + this.context.currentTime - this.anchorTime,
      ),
    );
  }

  private noteAt(position: number): PerformanceNote | undefined {
    const notes = this.performance?.notes;
    if (!notes) return undefined;
    const note = notes[noteIndexAt(notes, position)];
    return note && note.start <= position ? note : undefined;
  }

  private tick(): void {
    const context = this.context;
    const performance = this.performance;
    if (!this.playing || !context || !performance) return;
    if (context.state !== 'running') {
      this.pause();
      this.onError(
        'Playback was interrupted. Press Play to resume browser audio.',
      );
      return;
    }
    try {
      this.positionSeconds = this.currentPosition();
      if (this.positionSeconds >= performance.duration) {
        this.cancelTransport();
        this.onProgress(performance.duration, null, true);
        return;
      }
      // Skip past events after a background-tab delay without scheduling them.
      this.nextIndex = Math.max(
        this.nextIndex,
        noteIndexAt(performance.notes, this.positionSeconds),
      );
      while (this.nextIndex < performance.notes.length) {
        const note = performance.notes[this.nextIndex];
        const when = this.anchorTime + note.start - this.anchorPosition;
        if (when > context.currentTime + lookaheadSeconds) break;
        this.scheduleNote(note, when);
        this.nextIndex += 1;
      }
      this.onProgress(
        this.positionSeconds,
        this.noteAt(this.positionSeconds)?.noteId ?? null,
        false,
      );
    } catch (error) {
      this.pause();
      this.onError(
        error instanceof Error
          ? error.message
          : 'Browser audio was interrupted.',
      );
    }
  }

  private scheduleNote(note: PerformanceNote, when: number): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || !this.waveform) return;
    const start = Math.max(context.currentTime, when);
    const end = when + note.duration * 0.94;
    if (end <= start) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const voice = { oscillator, envelope };
    oscillator.setPeriodicWave(this.waveform);
    oscillator.frequency.setValueAtTime(note.frequency, start);
    oscillator.connect(envelope);
    envelope.connect(master);
    const attack = Math.min(0.015, (end - start) / 4);
    const release = Math.min(0.04, (end - start) / 3);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.8, start + attack);
    envelope.gain.setValueAtTime(0.8, end - release);
    envelope.gain.linearRampToValueAtTime(0, end);
    this.voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      this.voices.delete(voice);
    };
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }

  private cancelTransport(): void {
    this.generation += 1;
    this.playing = false;
    if (this.timer !== null) {
      globalThis.clearInterval(this.timer);
      this.timer = null;
    }
    const now = this.context?.currentTime ?? 0;
    for (const voice of this.voices) {
      // Ramp even on Pause/Stop to avoid an abrupt waveform discontinuity.
      voice.envelope.gain.cancelScheduledValues(now);
      voice.envelope.gain.setTargetAtTime(0, now, 0.005);
      voice.oscillator.stop(now + 0.03);
    }
    this.voices.clear();
  }
}
