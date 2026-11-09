import { describe, expect, it } from 'vitest';
import {
  verticalEpisemaScreenShift,
  type TickRasterInputs,
} from './vertical-episema-rasterization';

const input: TickRasterInputs = {
  left: 100.3,
  width: 1.5,
  unitsToCss: 1,
  devicePixelRatio: 1,
  visualScale: 1,
  visualOffsetX: 0,
  clipLeft: 0,
  clipRight: 1000,
};

describe('vertical-episema-only screen phase alignment', () => {
  it('normalizes phase without changing dimensions, within both safety limits', () => {
    for (const scale of [0.1, 0.2, 0.38, 0.5, 1, 1.25, 2, 4])
      for (const density of [1, 1.25, 1.5, 2, 3])
        for (const zoom of [1, 1.5, 2])
          for (let phase = 0; phase < 1; phase += 0.013) {
            const sample = {
              ...input,
              left: 100 + phase,
              width: 1.5 * scale,
              unitsToCss: scale,
              devicePixelRatio: density,
              visualScale: zoom,
              visualOffsetX: 0.17,
            };
            const shift = verticalEpisemaScreenShift(sample);
            expect(Math.abs(shift)).toBeLessThanOrEqual(1.5);
            expect(
              Math.abs(shift * scale * density * zoom),
            ).toBeLessThanOrEqual(0.500000001);
            if (shift !== 0) {
              const edge =
                (sample.left + shift * scale - sample.visualOffsetX) *
                density *
                zoom;
              expect(edge).toBeCloseTo(Math.round(edge), 8);
            }
            // Two-unit obstacle clearances survive even when both equal-width
            // ticks align; the shared monotonic grid prevents crossing.
            const second = {
              ...sample,
              left: sample.left + (1.5 + 2) * scale,
            };
            const otherShift = verticalEpisemaScreenShift(second);
            expect(second.left + otherShift * scale).toBeGreaterThan(
              sample.left + (1.5 + shift) * scale,
            );
          }
  });

  it('retains canonical ink instead of crossing the canvas or viewport clip', () => {
    expect(
      verticalEpisemaScreenShift({ ...input, left: 0.2, clipLeft: 0.1 }),
    ).toBe(0);
    expect(
      verticalEpisemaScreenShift({ ...input, left: 998.7, clipRight: 1000.3 }),
    ).toBe(0);
    expect(
      verticalEpisemaScreenShift({
        ...input,
        left: 100.49,
        unitsToCss: 0.1,
      }),
    ).toBe(0);
  });

  it('rejects unavailable or invalid display measurements', () => {
    for (const key of Object.keys(input) as (keyof TickRasterInputs)[])
      expect(verticalEpisemaScreenShift({ ...input, [key]: NaN })).toBe(0);
    for (const key of [
      'unitsToCss',
      'devicePixelRatio',
      'visualScale',
      'width',
    ] as const)
      expect(verticalEpisemaScreenShift({ ...input, [key]: 0 })).toBe(0);
  });
});
