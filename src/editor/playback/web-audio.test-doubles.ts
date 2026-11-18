import type { PlaybackAudioContext } from './playback-controller';
import type { Performance } from './performance';
import type {
  ToneGain,
  ToneNode,
  ToneOscillator,
  ToneParam,
} from './web-audio-synth';

/** Test-only Web Audio stand-ins that record what was scheduled. */
export type ParamEvent =
  ['set', number, number] | ['ramp', number, number] | ['cancel', number];

export class FakeParam implements ToneParam {
  value = 0;
  events: ParamEvent[] = [];
  setValueAtTime(value: number, time: number) {
    this.events.push(['set', value, time]);
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push(['ramp', value, time]);
  }
  cancelScheduledValues(time: number) {
    this.events.push(['cancel', time]);
  }
}

class FakeNode implements ToneNode {
  connections: ToneNode[] = [];
  disconnected = false;
  connect(destination: ToneNode) {
    this.connections.push(destination);
  }
  disconnect() {
    this.disconnected = true;
  }
}

export class FakeOscillator extends FakeNode implements ToneOscillator {
  type: OscillatorType = 'sine';
  frequency = new FakeParam();
  onended: ((event: Event) => void) | null = null;
  startTime: number | null = null;
  stopTimes: number[] = [];
  start(time: number) {
    this.startTime = time;
  }
  stop(time: number) {
    this.stopTimes.push(time);
  }
  /** Simulates the browser firing `ended`. */
  end() {
    this.onended?.(new Event('ended'));
  }
}

export class FakeGain extends FakeNode implements ToneGain {
  gain = new FakeParam();
}

export class FakeAudioContext implements PlaybackAudioContext {
  currentTime = 10;
  state = 'suspended';
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  resumeCalls = 0;
  closed = false;
  /** Pending resume promises, settled explicitly by tests. */
  private resumes: { resolve: () => void; reject: (e: Error) => void }[] = [];
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  resume() {
    this.resumeCalls++;
    return new Promise<void>((resolve, reject) =>
      this.resumes.push({ resolve, reject }),
    );
  }
  allowResume(state = 'running') {
    this.state = state;
    for (const r of this.resumes.splice(0)) r.resolve();
  }
  rejectResume() {
    for (const r of this.resumes.splice(0)) r.reject(Error('NotAllowed'));
  }
  close() {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}

export function testPerformance(midiNotes: number[]): Performance {
  return {
    notes: midiNotes.map((midiNote, index) => ({
      noteId: `n${index}`,
      neumeId: `p${index}`,
      degree: 0,
      alteration: 0,
      midiNote,
      startSeconds: index * 0.4,
      durationSeconds: 0.4,
    })),
    durationSeconds: midiNotes.length * 0.4,
  };
}

/** Lets already-settled promise callbacks run. */
export const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));
