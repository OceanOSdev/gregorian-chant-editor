import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { layoutChant, type NeumeLayout } from '../layout/layout-chant';
import type { MeasureLyricText } from '../layout/lyric-text-metrics';
import {
  neumeSelectionBounds,
  neumeSelectionGap,
  neumeSelectionStrokeInset,
} from './neume-selection-bounds';

const measure: MeasureLyricText = (text) => ({
  width: text.length * 10,
  boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 10),
});

/** Three-neume melismas: compact same-syllable neighbours on one or both sides. */
function melismas(): ChantDocument {
  return {
    title: 'Compact selection',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    divisions: [],
    clefChanges: [],
    accidentals: [],
    neumes: Array.from({ length: 12 }, (_, i) =>
      i % 3 === 1
        ? {
            id: `n${i}`,
            kind: 'podatus',
            notes: [
              { id: `n${i}-a`, staffPosition: staffPosition(1) },
              { id: `n${i}-b`, staffPosition: staffPosition(4) },
            ],
          }
        : {
            id: `n${i}`,
            kind: 'punctum',
            notes: [{ id: `n${i}-a`, staffPosition: staffPosition(i % 7) }],
          },
    ),
    syllables: Array.from({ length: 4 }, (_, i) => ({
      id: `s${i}`,
      text: 'e',
      startsAtNeumeId: `n${i * 3}`,
      boundaryBefore: 'word',
    })),
  };
}

const inkRight = (n: NeumeLayout) => n.bounds.x + n.bounds.width;

describe('whole-neume selection outline', () => {
  it('fits a complete outline inside compact ownership without reaching neighbouring ink', () => {
    const restricted = { left: 0, right: 0, both: 0, none: 0 };
    const visit = (
      neume: NeumeLayout,
      i: number,
      neumes: readonly NeumeLayout[],
    ) => {
      const r = neumeSelectionBounds(neume);
      const strokeLeft = r.x - neumeSelectionStrokeInset;
      const strokeRight = r.x + r.width + neumeSelectionStrokeInset;
      // The outline encloses all ink, with unchanged vertical padding.
      expect(r.x).toBeLessThanOrEqual(neume.bounds.x);
      expect(r.x + r.width).toBeGreaterThanOrEqual(inkRight(neume));
      expect(r.y).toBe(neume.bounds.y - neumeSelectionGap);
      expect(r.height).toBe(neume.bounds.height + neumeSelectionGap * 2);
      // Its whole stroke stays within ownership, so no clip is needed and
      // neighbouring ink is never overlapped.
      const clip = neume.hitClip;
      if (clip) {
        expect(strokeLeft).toBeGreaterThanOrEqual(clip.left - 1e-9);
        expect(strokeRight).toBeLessThanOrEqual(clip.right + 1e-9);
      }
      const before = neumes[i - 1];
      const after = neumes[i + 1];
      if (before) expect(strokeLeft).toBeGreaterThan(inkRight(before));
      if (after) expect(strokeRight).toBeLessThan(after.bounds.x);

      const leftPad = neume.bounds.x - r.x;
      const rightPad = r.x + r.width - inkRight(neume);
      const leftTight = leftPad < neumeSelectionGap;
      const rightTight = rightPad < neumeSelectionGap;
      // Ordinary padding is preserved wherever ownership allows it.
      if (!leftTight) expect(leftPad).toBe(neumeSelectionGap);
      if (!rightTight) expect(rightPad).toBe(neumeSelectionGap);
      if (leftTight && clip) expect(strokeLeft).toBeCloseTo(clip.left);
      if (rightTight && clip) expect(strokeRight).toBeCloseTo(clip.right);
      restricted[
        leftTight && rightTight
          ? 'both'
          : leftTight
            ? 'left'
            : rightTight
              ? 'right'
              : 'none'
      ]++;
    };
    for (const system of layoutChant(melismas(), measure).systems)
      system.neumes.forEach(visit);
    // The fixture exercises restriction on either side and on both sides.
    expect(restricted.both).toBeGreaterThan(0);
    expect(restricted.left).toBeGreaterThan(0);
    expect(restricted.right).toBeGreaterThan(0);
  });

  it('keeps ordinary padding for an isolated neume', () => {
    const document = melismas();
    const [neume] = layoutChant(
      { ...document, neumes: document.neumes.slice(0, 1), syllables: [] },
      measure,
    ).systems[0].neumes;
    expect(neume.hitClip).toBeUndefined();
    expect(neumeSelectionBounds(neume)).toEqual({
      x: neume.bounds.x - 5,
      y: neume.bounds.y - 5,
      width: neume.bounds.width + 10,
      height: neume.bounds.height + 10,
    });
  });
});
