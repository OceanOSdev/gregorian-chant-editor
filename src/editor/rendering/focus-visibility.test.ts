import { describe, expect, it } from 'vitest';
import { getVisibilityAdjustment, zoomFactor } from './focus-visibility';

const viewport = { left: 8, right: 712, top: 8, bottom: 892 };
describe('nearest necessary focus reveal', () => {
  it('preserves the viewport for already visible notation', () => {
    expect(
      getVisibilityAdjustment(
        { left: 100, right: 150, top: 300, bottom: 340 },
        viewport,
      ),
    ).toEqual({ x: 0, y: 0 });
  });
  it('reveals clipped notation without centering the root/system', () => {
    expect(
      getVisibilityAdjustment(
        { left: 100, right: 150, top: -20, bottom: 20 },
        viewport,
      ),
    ).toEqual({ x: 0, y: -28 });
    expect(
      getVisibilityAdjustment(
        { left: 100, right: 150, top: 880, bottom: 920 },
        viewport,
      ),
    ).toEqual({ x: 0, y: 28 });
  });
  it('handles horizontal clipping too', () => {
    expect(
      getVisibilityAdjustment(
        { left: 0, right: 20, top: 300, bottom: 340 },
        viewport,
      ),
    ).toEqual({ x: -8, y: 0 });
    expect(
      getVisibilityAdjustment(
        { left: 700, right: 730, top: 300, bottom: 340 },
        viewport,
      ),
    ).toEqual({ x: 18, y: 0 });
  });
  it('uses the first-note anchor for oversized bounds without alternating edges', () => {
    expect(
      getVisibilityAdjustment(
        { left: -100, right: 900, top: -200, bottom: 1200 },
        viewport,
        { left: 100, right: 120, top: 300, bottom: 330 },
      ),
    ).toEqual({ x: 0, y: 0 });
    expect(
      getVisibilityAdjustment(
        { left: -100, right: 900, top: -200, bottom: 1200 },
        viewport,
        { left: 100, right: 120, top: -40, bottom: -10 },
      ),
    ).toEqual({ x: 0, y: -48 });
  });
});

describe('zoomFactor', () => {
  it('is exactly 1 without zoom, including sub-pixel rounding', () => {
    expect(zoomFactor(273, 273)).toBe(1);
    expect(zoomFactor(300.4, 300)).toBe(1);
    expect(zoomFactor(299.6, 300)).toBe(1);
  });
  it('measures CSS zoom from rendered over layout size', () => {
    expect(zoomFactor(256.5, 171)).toBeCloseTo(1.5, 9);
    expect(zoomFactor(100, 200)).toBe(0.5);
  });
  it('treats an unlaid-out container as unzoomed', () => {
    expect(zoomFactor(0, 0)).toBe(1);
  });
});
