import type { Performance } from './performance';

/*
 * The small part of the Web Audio API the synthesizer uses. A real
 * `AudioContext` satisfies these shapes; tests substitute recording fakes.
 */
export interface ToneParam {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}

export interface ToneNode {
  connect(destination: ToneNode): unknown;
  disconnect(): void;
}

export interface ToneOscillator extends ToneNode {
  type: OscillatorType;
  frequency: ToneParam;
  onended: ((event: Event) => void) | null;
  start(time: number): void;
  stop(time: number): void;
}

export interface ToneGain extends ToneNode {
  gain: ToneParam;
}

export interface ToneContext {
  readonly currentTime: number;
  readonly destination: ToneNode;
  createOscillator(): ToneOscillator;
  createGain(): ToneGain;
}

export interface ScheduledPerformance {
  /** Silences promptly; `onEnded` is not guaranteed after a stop. */
  stop(): void;
}

/** Scheduling headroom so the first note is not clipped. */
const startDelaySeconds = 0.05;
const attackSeconds = 0.015;
const releaseSeconds = 0.05;
/** Silence before the next note so repeated pitches are heard separately. */
const articulationGapSeconds = 0.04;
const stopFadeSeconds = 0.03;
const peakLevel = 0.2;

export function midiToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

/**
 * Schedules a whole performance on the context clock with one monophonic
 * triangle oscillator: each note sets the frequency at its start and gets its
 * own attack/release envelope. Note durations must exceed the envelope
 * (about 0.1 s); Equal Note Playback uses 0.4 s.
 */
export function schedulePerformance(
  context: ToneContext,
  performance: Performance,
  onEnded: () => void,
): ScheduledPerformance {
  const start = context.currentTime + startDelaySeconds;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const output = context.createGain();
  oscillator.type = 'triangle';
  envelope.gain.value = 0;
  output.gain.value = 1;
  oscillator.connect(envelope);
  envelope.connect(output);
  output.connect(context.destination);

  for (const note of performance.notes) {
    const noteStart = start + note.startSeconds;
    const noteEnd = noteStart + note.durationSeconds - articulationGapSeconds;
    oscillator.frequency.setValueAtTime(
      midiToFrequency(note.midiNote),
      noteStart,
    );
    envelope.gain.setValueAtTime(0, noteStart);
    envelope.gain.linearRampToValueAtTime(peakLevel, noteStart + attackSeconds);
    envelope.gain.setValueAtTime(peakLevel, noteEnd - releaseSeconds);
    envelope.gain.linearRampToValueAtTime(0, noteEnd);
  }

  let finished = false;
  oscillator.onended = () => {
    if (finished) return;
    finished = true;
    oscillator.onended = null;
    oscillator.disconnect();
    envelope.disconnect();
    output.disconnect();
    onEnded();
  };
  oscillator.start(start);
  oscillator.stop(start + performance.durationSeconds);

  return {
    stop() {
      if (finished) return;
      // A short fade on the constant output gain avoids a click; the
      // per-note envelope keeps its schedule but is no longer heard.
      const now = context.currentTime;
      output.gain.cancelScheduledValues(now);
      output.gain.setValueAtTime(output.gain.value, now);
      output.gain.linearRampToValueAtTime(0, now + stopFadeSeconds);
      oscillator.stop(now + stopFadeSeconds);
    },
  };
}
