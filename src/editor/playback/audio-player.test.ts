import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPlayer } from './audio-player';
import type { Performance } from './performance';

class FakeParam {
  setValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class FakeGain {
  gain = new FakeParam();
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeOscillator {
  frequency = new FakeParam();
  connect = vi.fn();
  disconnect = vi.fn();
  setPeriodicWave = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}
class FakeContext {
  static instances: FakeContext[] = [];
  static pendingResume: Promise<void> | null = null;
  static failWaveform = false;
  currentTime = 0;
  state = 'suspended';
  destination = {};
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  constructor() {
    FakeContext.instances.push(this);
  }
  resume = vi.fn(async () => {
    if (FakeContext.pendingResume) await FakeContext.pendingResume;
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createPeriodicWave = vi.fn(() => {
    if (FakeContext.failWaveform) throw new Error('Waveform unavailable');
    return {};
  });
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}
function performance(count = 3): Performance {
  return {
    duration: count * 0.5,
    notes: Array.from({ length: count }, (_, i) => ({
      noteId: `note-${i}`,
      neumeId: `neume-${i}`,
      midi: 60,
      frequency: 261.6256,
      start: i * 0.5,
      duration: 0.5,
    })),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeContext.instances = [];
  FakeContext.pendingResume = null;
  FakeContext.failWaveform = false;
  vi.stubGlobal('AudioContext', FakeContext);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bounded browser audio transport', () => {
  it('creates no audio before Play and schedules only the short lookahead', async () => {
    const progress = vi.fn();
    const player = new AudioPlayer(progress, vi.fn());
    expect(FakeContext.instances).toHaveLength(0);
    player.setVolume(0.3);
    expect(FakeContext.instances).toHaveLength(0);
    await player.play(performance(10000));
    const context = FakeContext.instances[0];
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.oscillators).toHaveLength(1);
    expect(
      context.oscillators[0].frequency.setValueAtTime,
    ).toHaveBeenCalledWith(261.6256, 0.03);
    expect(context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(
      0.3 * 0.18,
      0,
    );
    expect(progress).toHaveBeenLastCalledWith(0, 'note-0', false);
    player.destroy();
  });

  it('pauses on the audio clock, cancels voices and resumes within the current note', async () => {
    const player = new AudioPlayer(vi.fn(), vi.fn());
    await player.play(performance());
    const context = FakeContext.instances[0];
    context.currentTime = 0.28;
    expect(player.pause()).toBeCloseTo(0.25);
    expect(context.oscillators[0].stop.mock.lastCall?.[0]).toBeCloseTo(0.31);
    expect(vi.getTimerCount()).toBe(0);
    await player.play(performance(), 0.25);
    expect(FakeContext.instances).toHaveLength(1);
    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators[1].start).toHaveBeenCalledWith(0.28);
    expect(context.oscillators[1].stop.mock.calls[0][0]).toBeCloseTo(0.54);
    player.destroy();
  });

  it.each(['pause', 'stop', 'destroy'] as const)(
    'cancels an asynchronous resume when %s is called',
    async (action) => {
      let resume = () => {};
      FakeContext.pendingResume = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const progress = vi.fn();
      const error = vi.fn();
      const player = new AudioPlayer(progress, error);
      const pending = player.play(performance());
      player[action]();
      const calls = progress.mock.calls.length;
      resume();
      await pending;
      expect(FakeContext.instances[0].oscillators).toHaveLength(0);
      expect(progress.mock.calls).toHaveLength(calls);
      expect(error).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      player.destroy();
    },
  );

  it('advances the highlight, skips elapsed events, and completes exactly once', async () => {
    const progress = vi.fn();
    const player = new AudioPlayer(progress, vi.fn());
    await player.play(performance(100));
    const context = FakeContext.instances[0];
    context.currentTime = 20.28;
    vi.advanceTimersByTime(25);
    expect(progress).toHaveBeenLastCalledWith(20.25, 'note-40', false);
    expect(context.oscillators).toHaveLength(2);
    context.currentTime = 50.1;
    vi.advanceTimersByTime(25);
    expect(progress).toHaveBeenLastCalledWith(50, null, true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(progress.mock.calls.filter((call) => call[2] === true)).toHaveLength(
      1,
    );
    player.destroy();
  });

  it('reports suspended audio rather than silently claiming to play', async () => {
    const errors = vi.fn();
    const player = new AudioPlayer(vi.fn(), errors);
    await player.play(performance());
    const context = FakeContext.instances[0];
    context.currentTime = 0.3;
    context.state = 'suspended';
    vi.advanceTimersByTime(25);
    expect(errors).toHaveBeenCalledWith(
      'Playback was interrupted. Press Play to resume browser audio.',
    );
    expect(vi.getTimerCount()).toBe(0);
    player.destroy();
  });

  it('closes partially initialized audio contexts and can retry cleanly', async () => {
    FakeContext.failWaveform = true;
    const player = new AudioPlayer(vi.fn(), vi.fn());
    await expect(player.play(performance())).rejects.toThrow(
      'Waveform unavailable',
    );
    const failed = FakeContext.instances[0];
    expect(failed.close).toHaveBeenCalledOnce();
    expect(failed.gains[0].disconnect).toHaveBeenCalledOnce();
    expect(failed.oscillators).toHaveLength(0);
    FakeContext.failWaveform = false;
    await player.play(performance());
    expect(FakeContext.instances).toHaveLength(2);
    expect(FakeContext.instances[1].oscillators).toHaveLength(1);
    player.destroy();
  });

  it('handles unsupported audio and empty performances without resources', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const progress = vi.fn();
    const errors = vi.fn();
    const player = new AudioPlayer(progress, errors);
    await player.play(performance(0));
    expect(progress).toHaveBeenCalledWith(0, null, true);
    expect(errors).not.toHaveBeenCalled();
    await expect(player.play(performance())).rejects.toThrow(
      'This browser does not support Web Audio playback.',
    );
    expect(errors).toHaveBeenCalledWith(
      'This browser does not support Web Audio playback.',
    );
    expect(vi.getTimerCount()).toBe(0);
    player.destroy();
  });
});
