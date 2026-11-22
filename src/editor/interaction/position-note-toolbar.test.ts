import { describe, expect, it } from 'vitest';
import {
  positionNoteToolbar,
  positionZoomedNoteToolbar,
  type NoteToolbarBounds,
} from './position-note-toolbar';

const viewport = { left: 0, right: 1000, top: 0, bottom: 800 };
const size = { width: 320, height: 190 };
const note = (
  left: number,
  top: number,
  width = 24,
  height = 24,
): NoteToolbarBounds => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe('contextual note toolbar client placement', () => {
  it('prefers above and flips below at the top edge', () => {
    expect(positionNoteToolbar(note(500, 400), viewport, size)).toEqual({
      left: 352,
      top: 202,
      width: 320,
      maxHeight: 190,
    });
    expect(positionNoteToolbar(note(500, 10), viewport, size)).toEqual({
      left: 352,
      top: 42,
      width: 320,
      maxHeight: 190,
    });
  });
  it('uses spare horizontal room before shrinking in a short viewport', () => {
    const short = { ...viewport, bottom: 230 };
    const result = positionNoteToolbar(note(400, 100), short, size);
    expect(result).toEqual({ left: 432, top: 17, width: 320, maxHeight: 190 });
  });
  it('limits height for a scrollable narrow/zoomed presentation without covering the note', () => {
    const result = positionNoteToolbar(
      note(140, 95),
      { left: 0, right: 320, top: 0, bottom: 220 },
      size,
    );
    expect(result).toEqual({ left: 8, top: 127, width: 304, maxHeight: 85 });
  });
  it('uses visual viewport offsets for pinch zoom / a reduced keyboard viewport', () => {
    const result = positionNoteToolbar(
      note(250, 450),
      { left: 120, right: 440, top: 300, bottom: 700 },
      size,
    );
    expect(result).toEqual({ left: 128, top: 482, width: 304, maxHeight: 190 });
  });
  it('declines a panel when no usable surrounding space exists', () => {
    expect(
      positionNoteToolbar(
        note(0, 0, 320, 220),
        { left: 0, right: 320, top: 0, bottom: 220 },
        size,
      ),
    ).toBeNull();
    expect(
      positionNoteToolbar(
        note(0, 0),
        { left: 0, right: 0, top: 0, bottom: 0 },
        size,
      ),
    ).toBeNull();
  });
  it('stays in bounds and outside every ordinary note at edges, resized and zoomed sizes', () => {
    for (const width of [240, 320, 600, 1440])
      for (const height of [220, 480, 900])
        for (const x of [0, width / 2, width - 24])
          for (const y of [0, height / 2, height - 24]) {
            const target = note(x, y);
            const result = positionNoteToolbar(
              target,
              { left: 0, right: width, top: 0, bottom: height },
              size,
            );
            expect(result).not.toBeNull();
            if (!result) continue;
            expect(result.left).toBeGreaterThanOrEqual(8);
            expect(result.top).toBeGreaterThanOrEqual(8);
            expect(result.left + result.width).toBeLessThanOrEqual(width - 8);
            expect(result.top + result.maxHeight).toBeLessThanOrEqual(
              height - 8,
            );
            expect(
              result.left + result.width <= target.left - 8 ||
                result.left >= target.right + 8 ||
                result.top + result.maxHeight <= target.top - 8 ||
                result.top >= target.bottom + 8,
            ).toBe(true);
          }
  });
});

describe('contextual toolbar placement under CSS zoom', () => {
  // Rendered client pixels of the toolbar's inline-style result.
  const rendered = (
    result: ReturnType<typeof positionNoteToolbar>,
    zoom: number,
  ) =>
    result && {
      left: result.left * zoom,
      top: result.top * zoom,
      right: (result.left + result.width) * zoom,
      bottom: (result.top + result.maxHeight) * zoom,
    };

  it('is the unzoomed placement exactly at zoom 1', () => {
    for (const width of [320, 480, 1440])
      for (const y of [20, 400, 760]) {
        const area = { left: 0, right: width, top: 0, bottom: 800 };
        const target = note(width / 2, y);
        expect(positionZoomedNoteToolbar(target, area, 190, 1)).toEqual(
          positionNoteToolbar(target, area, {
            width: Math.min(320, width - 16),
            height: 190,
          }),
        );
      }
  });

  it('treats a missing or invalid zoom as no zoom', () => {
    const area = { left: 0, right: 480, top: 0, bottom: 800 };
    const unzoomed = positionZoomedNoteToolbar(note(200, 400), area, 190, 1);
    for (const zoom of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY])
      expect(
        positionZoomedNoteToolbar(note(200, 400), area, 190, zoom),
      ).toEqual(unzoomed);
  });

  it('returns CSS pixels that render at the client placement, scaled once', () => {
    // Client pixels at zoom 2: the panel's own 320px width renders as 640.
    const result = positionZoomedNoteToolbar(
      note(800, 1000, 48, 48),
      { left: 0, right: 2000, top: 0, bottom: 1600 },
      190,
      2,
    );
    expect(result).toEqual({ left: 252, top: 302, width: 320, maxHeight: 190 });
    expect(rendered(result, 2)).toEqual({
      left: 504,
      top: 604,
      right: 1144,
      bottom: 984,
    });
  });

  it('keeps the issue #112 panel below the sticky toolbar and on screen', () => {
    // 480x1100 viewport at 150% CSS zoom, sticky tools ending at 438.9.
    const target = {
      left: 104.545,
      right: 118.378,
      top: 542.627,
      bottom: 556.46,
    };
    const area = { left: 0, right: 465, top: 438.906, bottom: 1100 };
    const panel = rendered(
      positionZoomedNoteToolbar(target, area, 218, 1.5),
      1.5,
    );
    expect(panel).not.toBeNull();
    if (!panel) return;
    expect(panel.top).toBeGreaterThanOrEqual(area.top);
    expect(panel.top).toBeGreaterThanOrEqual(target.bottom);
    expect(panel.bottom).toBeLessThanOrEqual(area.bottom);
    expect(panel.left).toBeGreaterThanOrEqual(area.left);
    expect(panel.right).toBeLessThanOrEqual(area.right);
  });

  it('stays in the client viewport and outside the note at every zoom', () => {
    for (const zoom of [0.5, 1, 1.25, 1.5, 2, 3])
      for (const width of [320, 480, 1440])
        for (const height of [480, 900])
          for (const x of [0, width / 2, width - 24])
            for (const y of [0, height / 2, height - 24]) {
              const target = note(x, y, 24 * zoom, 24 * zoom);
              const area = { left: 0, right: width, top: 0, bottom: height };
              const result = positionZoomedNoteToolbar(target, area, 190, zoom);
              const panel = rendered(result, zoom);
              if (!panel) continue;
              const margin = 8 * zoom - 1e-9;
              expect(panel.left).toBeGreaterThanOrEqual(margin);
              expect(panel.top).toBeGreaterThanOrEqual(margin);
              expect(panel.right).toBeLessThanOrEqual(width - margin);
              expect(panel.bottom).toBeLessThanOrEqual(height - margin);
              expect(
                panel.right <= target.left - margin ||
                  panel.left >= target.right + margin ||
                  panel.bottom <= target.top - margin ||
                  panel.top >= target.bottom + margin,
              ).toBe(true);
            }
  });
});
