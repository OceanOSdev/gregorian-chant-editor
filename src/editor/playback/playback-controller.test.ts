import { describe, expect, it } from 'vitest';
import {
  createPlaybackController,
  playbackMessages,
  type PlaybackState,
} from './playback-controller';
import {
  FakeAudioContext,
  flushPromises,
  testPerformance,
} from './web-audio.test-doubles';

function setup(createContext?: () => FakeAudioContext) {
  const contexts: FakeAudioContext[] = [];
  const states: PlaybackState[] = [];
  const controller = createPlaybackController(
    createContext ??
      (() => {
        const context = new FakeAudioContext();
        contexts.push(context);
        return context;
      }),
    (state) => states.push(state),
  );
  return { controller, contexts, states };
}
const statuses = (states: PlaybackState[]) => states.map((s) => s.status);

describe('playback controller', () => {
  it('creates and resumes the context in the gesture, then plays', async () => {
    const { controller, contexts, states } = setup();
    controller.play(testPerformance([60]));
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resumeCalls).toBe(1);
    expect(contexts[0].oscillators).toHaveLength(0);
    expect(statuses(states)).toEqual(['starting']);
    contexts[0].allowResume();
    await flushPromises();
    expect(contexts[0].oscillators).toHaveLength(1);
    expect(statuses(states)).toEqual(['starting', 'playing']);
    contexts[0].oscillators[0].end();
    expect(statuses(states)).toEqual(['starting', 'playing', 'idle']);
  });

  it('stops an active performance promptly and reports idle', async () => {
    const { controller, contexts, states } = setup();
    controller.play(testPerformance([60, 62, 64]));
    contexts[0].allowResume();
    await flushPromises();
    const [oscillator] = contexts[0].oscillators;
    controller.stop();
    expect(oscillator.stopTimes.at(-1)).toBeLessThan(
      oscillator.stopTimes[0] ?? 0,
    );
    expect(statuses(states)).toEqual(['starting', 'playing', 'idle']);
    // The stopped session's late `ended` event changes nothing.
    controller.play(testPerformance([60]));
    oscillator.end();
    await flushPromises();
    expect(statuses(states)).toEqual([
      'starting',
      'playing',
      'idle',
      'starting',
      'playing',
    ]);
  });

  it('restarting replaces the session and reuses one context without overlap', async () => {
    const { controller, contexts } = setup();
    controller.play(testPerformance([60, 62]));
    contexts[0].allowResume();
    await flushPromises();
    controller.play(testPerformance([64]));
    await flushPromises();
    expect(contexts).toHaveLength(1);
    const [first, second] = contexts[0].oscillators;
    // The first session was stopped before the second was scheduled.
    expect(first.stopTimes).toHaveLength(2);
    expect(second.stopTimes).toHaveLength(1);
  });

  it('a stop before the context resumes prevents any sound', async () => {
    const { controller, contexts, states } = setup();
    controller.play(testPerformance([60]));
    controller.stop();
    contexts[0].allowResume();
    await flushPromises();
    expect(contexts[0].oscillators).toHaveLength(0);
    expect(statuses(states)).toEqual(['starting', 'idle']);
  });

  it('only the latest of several pending plays can sound', async () => {
    const { controller, contexts } = setup();
    controller.play(testPerformance([60]));
    controller.play(testPerformance([62, 64]));
    contexts[0].allowResume();
    await flushPromises();
    expect(contexts[0].oscillators).toHaveLength(1);
    expect(contexts[0].oscillators[0].frequency.events).toHaveLength(2);
  });

  it('does nothing audible for an empty performance', () => {
    const { controller, contexts, states } = setup();
    controller.play(testPerformance([]));
    expect(contexts).toHaveLength(0);
    expect(states).toEqual([]);
  });

  it('reports an unavailable audio context without throwing', () => {
    const { controller, states } = setup(() => {
      throw Error('No Web Audio');
    });
    expect(() => controller.play(testPerformance([60]))).not.toThrow();
    expect(states).toEqual([
      { status: 'failed', message: playbackMessages.unavailable },
    ]);
  });

  it('reports a refused resume and can try again', async () => {
    const { controller, contexts, states } = setup();
    controller.play(testPerformance([60]));
    contexts[0].rejectResume();
    await flushPromises();
    expect(states.at(-1)).toEqual({
      status: 'failed',
      message: playbackMessages.blocked,
    });
    controller.play(testPerformance([60]));
    contexts[0].allowResume();
    await flushPromises();
    expect(contexts).toHaveLength(1);
    expect(states.at(-1)).toEqual({ status: 'playing' });
  });

  it('reports a context that resumes but stays suspended', async () => {
    const { controller, contexts, states } = setup();
    controller.play(testPerformance([60]));
    contexts[0].allowResume('suspended');
    await flushPromises();
    expect(contexts[0].oscillators).toHaveLength(0);
    expect(states.at(-1)).toEqual({
      status: 'failed',
      message: playbackMessages.blocked,
    });
  });

  it('dispose silences, closes the context and ignores later callbacks', async () => {
    const { controller, contexts, states } = setup();
    controller.play(testPerformance([60, 62]));
    contexts[0].allowResume();
    await flushPromises();
    const [oscillator] = contexts[0].oscillators;
    controller.dispose();
    expect(contexts[0].closed).toBe(true);
    expect(oscillator.stopTimes).toHaveLength(2);
    oscillator.end();
    controller.play(testPerformance([60]));
    expect(contexts).toHaveLength(1);
    expect(statuses(states)).toEqual(['starting', 'playing']);
  });

  it('replaces a closed context on the next play', async () => {
    const { controller, contexts } = setup();
    controller.play(testPerformance([60]));
    contexts[0].allowResume();
    await flushPromises();
    void contexts[0].close();
    controller.play(testPerformance([60]));
    expect(contexts).toHaveLength(2);
  });
});
