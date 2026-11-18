import { describe, expect, it } from 'vitest';
import { shouldRevealSoundingNote } from './follow-sounding-note';

describe('follow policy', () => {
  it('reveals the first sounding note of a playback', () => {
    expect(shouldRevealSoundingNote({ exists: false, onScreen: false })).toBe(
      true,
    );
  });

  it('keeps following while the previous note is on screen', () => {
    expect(shouldRevealSoundingNote({ exists: true, onScreen: true })).toBe(
      true,
    );
  });

  it('pauses when the reader scrolled the sounding note away', () => {
    expect(shouldRevealSoundingNote({ exists: true, onScreen: false })).toBe(
      false,
    );
  });
});
