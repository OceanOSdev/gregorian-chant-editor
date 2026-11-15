import { expect, it } from 'vitest';
import { occupiedViewportTop } from './sticky-visibility';
import { getVisibilityAdjustment } from './focus-visibility';

it('reserves measured occupied space and reveals a covered note minimally', () => {
  const viewport = { left: 8, right: 992, top: 8, bottom: 792 };
  const toolbar = { left: 0, right: 1000, top: 0, bottom: 180 };
  viewport.top = occupiedViewportTop(toolbar, 0, 800) + 8;
  expect(
    getVisibilityAdjustment(
      { left: 50, right: 70, top: 100, bottom: 120 },
      viewport,
    ).y,
  ).toBe(-88);
  expect(
    getVisibilityAdjustment(
      { left: 50, right: 70, top: 200, bottom: 220 },
      viewport,
    ).y,
  ).toBe(0);
  expect(
    occupiedViewportTop({ ...toolbar, top: 100, bottom: 280 }, 0, 800),
  ).toBe(280);
});

it('ignores absent, scrolled-away and below-viewport toolbars', () => {
  expect(occupiedViewportTop(null, 10, 800)).toBe(10);
  expect(
    occupiedViewportTop(
      { left: 0, right: 1000, top: -200, bottom: 0 },
      10,
      800,
    ),
  ).toBe(10);
  expect(
    occupiedViewportTop(
      { left: 0, right: 1000, top: 810, bottom: 900 },
      10,
      800,
    ),
  ).toBe(10);
});
