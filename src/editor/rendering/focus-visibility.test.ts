import { describe, expect, it } from 'vitest';
import { getVisibilityAdjustment } from './focus-visibility';

const viewport = { left: 8, right: 712, top: 148, bottom: 892 };
describe('nearest necessary focus reveal', () => {
  it('preserves the viewport for already visible notation', () => {
    expect(
      getVisibilityAdjustment(
        { left: 100, right: 150, top: 300, bottom: 340 },
        viewport,
      ),
    ).toEqual({ x: 0, y: 0 });
  });
  it('reveals below the sticky strip without centering the root/system', () => {
    expect(
      getVisibilityAdjustment(
        { left: 100, right: 150, top: 120, bottom: 160 },
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
        { left: 100, right: 120, top: 100, bottom: 130 },
      ),
    ).toEqual({ x: 0, y: -48 });
  });
});
