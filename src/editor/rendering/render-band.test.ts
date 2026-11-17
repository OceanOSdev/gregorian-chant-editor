import { describe, expect, it } from 'vitest';
import {
  clampToBand,
  moveCaptionBaseline,
  moveCaptionFontSize,
  renderBandFor,
} from './render-band';

describe('render band', () => {
  // A resolved band whose system reaches the canonical -1200..1420 margin.
  const band = renderBandFor({ top: -1200, bottom: 1420 });

  it('extends the musical band by one ledger space', () => {
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

describe('lyric-move caption baseline', () => {
  const band = { top: 100, bottom: 400 };

  it('keeps the ordinary offset above the neume when it fits', () => {
    expect(
      moveCaptionBaseline({ x: 0, y: 200, width: 1, height: 1 }, band),
    ).toBe(186);
  });

  it('lowers the caption so its em box stays inside the band', () => {
    const baseline = moveCaptionBaseline(
      { x: 0, y: 112, width: 1, height: 1 },
      band,
    );
    expect(baseline - moveCaptionFontSize).toBe(band.top);
    expect(
      moveCaptionBaseline({ x: 0, y: -1e17, width: 1, height: 1 }, band) -
        moveCaptionFontSize,
    ).toBe(band.top);
  });
});
