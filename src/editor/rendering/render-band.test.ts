import { describe, expect, it } from 'vitest';
import { clampToBand, renderBandFor } from './render-band';

describe('render band', () => {
  const band = renderBandFor({ y: -1200, height: 2620 });

  it('extends the canvas by one ledger space', () => {
    expect(band).toEqual({ top: -1224, bottom: 1444 });
  });

  it('keeps an ordinary rectangle identical', () => {
    const bounds = { x: 1, y: 2, width: 3, height: 4, strokeWidth: 2 };
    expect(clampToBand(bounds, band)).toBe(bounds);
    expect(clampToBand(bounds, undefined)).toBe(bounds);
  });

  it('limits a rectangle reaching a distant pitch, keeping its other fields', () => {
    const max = Number.MAX_SAFE_INTEGER * 12;
    expect(
      clampToBand(
        { x: 1, y: 100, width: 3, height: max, strokeWidth: 2 },
        band,
      ),
    ).toEqual({ x: 1, y: 100, width: 3, height: 1344, strokeWidth: 2 });
    expect(
      clampToBand({ x: 1, y: -5000, width: 3, height: 5050 }, band),
    ).toEqual({ x: 1, y: -1224, width: 3, height: 1274 });
    // Entirely outside: an empty rectangle, never a negative height.
    expect(
      clampToBand({ x: 1, y: max, width: 3, height: 10 }, band).height,
    ).toBe(0);
  });
});
