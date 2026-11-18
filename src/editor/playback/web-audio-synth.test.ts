import { describe, expect, it } from 'vitest';
import { midiToFrequency, schedulePerformance } from './web-audio-synth';
import { FakeAudioContext, testPerformance } from './web-audio.test-doubles';

describe('midiToFrequency', () => {
  it.each([
    [69, 440],
    [60, 261.6256],
    [57, 220],
    [72, 523.2511],
  ])('MIDI %i sounds at %f Hz', (midi, hz) =>
    expect(midiToFrequency(midi)).toBeCloseTo(hz, 3),
  );
});

describe('schedulePerformance', () => {
  function scheduled(midiNotes: number[]) {
    const context = new FakeAudioContext();
    let ended = 0;
    const handle = schedulePerformance(
      context,
      testPerformance(midiNotes),
      () => ended++,
    );
    const [oscillator] = context.oscillators;
    const [envelope, output] = context.gains;
    return {
      context,
      handle,
      oscillator,
      envelope,
      output,
      ended: () => ended,
    };
  }

  it('schedules every note on the audio clock with one oscillator', () => {
    const { context, oscillator, envelope, output } = scheduled([60, 62, 62]);
    expect(context.oscillators).toHaveLength(1);
    expect(oscillator.connections).toEqual([envelope]);
    expect(envelope.connections).toEqual([output]);
    expect(output.connections).toEqual([context.destination]);
    const start = oscillator.startTime ?? NaN;
    expect(start).toBeGreaterThan(context.currentTime);
    expect(oscillator.stopTimes).toEqual([start + 1.2]);
    expect(oscillator.frequency.events).toEqual([
      ['set', midiToFrequency(60), start],
      ['set', midiToFrequency(62), start + 0.4],
      ['set', midiToFrequency(62), start + 0.8],
    ]);
  });

  it('gives each note its own envelope that returns to silence', () => {
    const { oscillator, envelope } = scheduled([62, 62]);
    const start = oscillator.startTime ?? NaN;
    const events = envelope.gain.events.map((event) => {
      if (event[0] === 'cancel') throw Error('Unexpected cancellation');
      const [kind, value, time] = event;
      return { kind, value, time };
    });
    expect(envelope.gain.value).toBe(0);
    expect(events.map((e) => e.kind)).toEqual([
      ...['set', 'ramp', 'set', 'ramp'],
      ...['set', 'ramp', 'set', 'ramp'],
    ]);
    for (const [index, noteStart] of [start, start + 0.4].entries()) {
      const [silence, attack, hold, release] = events.slice(
        index * 4,
        index * 4 + 4,
      );
      expect(silence).toEqual({ kind: 'set', value: 0, time: noteStart });
      expect(attack.value).toBeGreaterThan(0);
      expect(hold.value).toBe(attack.value);
      expect(release.value).toBe(0);
      expect(attack.time).toBeLessThan(hold.time);
      expect(hold.time).toBeLessThan(release.time);
      // Each repeated note falls silent before the next one starts.
      expect(release.time).toBeLessThan(noteStart + 0.4);
    }
  });

  it('reports the natural end once and releases its nodes', () => {
    const { oscillator, envelope, output, ended } = scheduled([60]);
    oscillator.end();
    oscillator.end();
    expect(ended()).toBe(1);
    expect(
      [oscillator, envelope, output].every((node) => node.disconnected),
    ).toBe(true);
  });

  it('stops promptly with a short fade instead of waiting for the score', () => {
    const { context, handle, oscillator, output } = scheduled([60, 62, 64]);
    context.currentTime = 10.5;
    output.gain.value = 1;
    handle.stop();
    expect(output.gain.events).toEqual([
      ['cancel', 10.5],
      ['set', 1, 10.5],
      ['ramp', 0, expect.closeTo(10.53, 5)],
    ]);
    expect(oscillator.stopTimes.at(-1)).toBeCloseTo(10.53, 5);
  });

  it('ignores stop after the performance ended', () => {
    const { handle, oscillator, output } = scheduled([60]);
    oscillator.end();
    handle.stop();
    expect(output.gain.events).toEqual([]);
    expect(oscillator.stopTimes).toHaveLength(1);
  });
});
