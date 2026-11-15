import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import { layoutChant, type NeumeLayout } from '../layout/layout-chant';
import type { MeasureLyricText } from '../layout/lyric-text-metrics';
import { resolveNeumeRange } from '../state/selection';
import { rangeSelectionBounds } from './range-selection-bounds';

const measure: MeasureLyricText = (text) => ({
  width: text.length * 10,
  boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 10),
});

/**
 * Twenty melismatic syllables of three neumes each. Within a syllable the
 * neumes are compactly grouped and share midpoint ownership clips; low
 * pitches approach the lyric row.
 */
function denseLyricDocument(): ChantDocument {
  const neumes: Neume[] = Array.from({ length: 60 }, (_, i) =>
    i % 3 === 1
      ? {
          id: `n${i}`,
          kind: 'podatus',
          notes: [
            { id: `n${i}-a`, staffPosition: staffPosition(-4) },
            { id: `n${i}-b`, staffPosition: staffPosition(1) },
          ],
        }
      : {
          id: `n${i}`,
          kind: 'punctum',
          notes: [{ id: `n${i}-a`, staffPosition: staffPosition((i * 3) % 9) }],
        },
  );
  return {
    title: 'Dense overlay',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    divisions: [],
    clefChanges: [],
    accidentals: [],
    neumes,
    syllables: Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`,
      text: i % 2 ? 'ri' : 'Ky',
      startsAtNeumeId: `n${i * 3}`,
      boundaryBefore: i % 2 ? 'continuation' : 'word',
    })),
  };
}

const right = (n: NeumeLayout) => n.bounds.x + n.bounds.width;

describe('connected range overlay bounds', () => {
  it('covers selected lyric-bearing dense neumes per system, excludes neighbours and clears lyrics', () => {
    const document = denseLyricDocument();
    const layout = layoutChant(document, measure);
    // Both endpoints fall mid-melisma so each has a compact same-syllable
    // neighbour outside the range.
    const forward = resolveNeumeRange(document, {
      kind: 'neume-range',
      anchorNeumeId: 'n4',
      endpointNeumeId: 'n52',
    });
    const backward = resolveNeumeRange(document, {
      kind: 'neume-range',
      anchorNeumeId: 'n52',
      endpointNeumeId: 'n4',
    });
    const ids = forward?.ids;
    expect(ids?.size).toBe(49);
    const touched = layout.systems.filter((s) =>
      s.neumes.some((n) => ids?.has(n.neumeId)),
    );
    expect(touched.length).toBeGreaterThan(1);

    for (const system of layout.systems) {
      const bounds = rangeSelectionBounds(system, ids);
      expect(bounds).toEqual(rangeSelectionBounds(system, backward?.ids));
      const members = system.neumes.filter((n) => ids?.has(n.neumeId));
      if (!members.length || !bounds) {
        expect(bounds).toBeNull();
        expect(members).toEqual([]);
        continue;
      }
      expect(system.lyrics.length).toBeGreaterThan(0);
      const lyricTop = Math.min(...system.lyrics.map((l) => l.y - l.fontSize));
      const bottom = bounds.y + bounds.height;

      // Selected-region coverage: every member's ink lies inside the band
      // horizontally, and vertically down to the lyric clearance.
      for (const n of members) {
        expect(bounds.x).toBeLessThanOrEqual(n.bounds.x);
        expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(right(n));
        expect(bounds.y).toBeLessThanOrEqual(n.bounds.y);
        expect(bottom).toBeGreaterThanOrEqual(
          Math.min(n.bounds.y + n.bounds.height, lyricTop - 2),
        );
      }
      // Lyric clearance: the band never reaches the lyric row.
      expect(bottom).toBeLessThanOrEqual(lyricTop - 2);

      // Neighbouring unselected neumes: no ink overlap, and the band stays
      // within the compact ownership boundary shared with a dense neighbour.
      const first = system.neumes.indexOf(members[0]);
      const last = system.neumes.indexOf(members[members.length - 1]);
      for (const n of system.neumes.filter((n) => !ids?.has(n.neumeId)))
        expect(
          right(n) <= bounds.x || n.bounds.x >= bounds.x + bounds.width,
        ).toBe(true);
      const before = system.neumes[first - 1];
      const after = system.neumes[last + 1];
      if (before?.hitClip)
        expect(bounds.x).toBeGreaterThanOrEqual(before.hitClip.right);
      if (after?.hitClip)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(after.hitClip.left);
    }

    // The fixture actually exercises compact boundaries at both ends.
    const startSystem = touched[0];
    const endSystem = touched[touched.length - 1];
    const startIndex = startSystem.neumes.findIndex((n) => n.neumeId === 'n4');
    const endIndex = endSystem.neumes.findIndex((n) => n.neumeId === 'n52');
    expect(startSystem.neumes[startIndex - 1]?.neumeId).toBe('n3');
    expect(startSystem.neumes[startIndex - 1]?.hitClip).toBeDefined();
    expect(endSystem.neumes[endIndex + 1]?.neumeId).toBe('n53');
    expect(endSystem.neumes[endIndex + 1]?.hitClip).toBeDefined();
    // And low podatus ink reaches far enough down that clearance clips it.
    expect(
      touched.some((s) => {
        const band = rangeSelectionBounds(s, ids);
        return (
          band &&
          s.neumes.some(
            (n) =>
              ids?.has(n.neumeId) &&
              n.bounds.y + n.bounds.height + 4 > band.y + band.height,
          )
        );
      }),
    ).toBe(true);
  });
});
