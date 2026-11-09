import { describe, expect, it } from 'vitest';
import {
  positionNoteToolbar,
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
