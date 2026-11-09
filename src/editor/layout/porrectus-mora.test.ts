import { describe, expect, it } from 'vitest';
import { staffPosition } from '../domain/chant-document';
import { buildNeumeGeometry } from './neume-geometry';

const build = (pitches: number[], pair: boolean) =>
  buildNeumeGeometry('porrectus', pitches.map(staffPosition), 50, 140, [
    {},
    ...(pair ? [{ mora: 1 as const }] : [{}]),
    { mora: 1 },
  ]);
describe('conventional Porrectus mora', () => {
  it.each([
    [4, 2, 4],
    [3, 0, 4],
    [5, 4, 5],
    [4, 3, 4],
    [6, 1, 3],
    [3, 1, 6],
  ])('%j: final single and pair remain compact and distinct', (...pitches) => {
    for (const offset of [-2, 0, 1, 3]) {
      const positions = pitches.map((p) => p + offset);
      const plain = buildNeumeGeometry(
        'porrectus',
        positions.map(staffPosition),
        50,
        140,
      );
      const single = build(positions, false);
      const pair = build(positions, true);
      for (const marked of [single, pair]) {
        expect(marked.bounds.width - plain.bounds.width).toBe(7);
        expect(marked.notes[0].modifierBounds).toBeUndefined();
        expect(marked.lyricAnchorX).toBe(plain.lyricAnchorX);
        expect(marked.ink.slice(0, plain.ink.length)).toEqual(plain.ink);
      }
      expect(pair.notes[1].modifierBounds?.x).toBe(
        pair.notes[2].modifierBounds?.x,
      );
      expect(pair.notes[1].modifierBounds?.y).not.toBe(
        pair.notes[2].modifierBounds?.y,
      );
    }
  });
  it.each([0, 2, 4, 6])(
    'adjacent lower line %s is dotted below in a pair',
    (second) => {
      expect(
        build([second + 3, second, second + 1], true).notes[1].modifierBounds
          ?.y,
      ).toBe(140 - second * 12 + 12 - 2);
    },
  );
  it('uses pitch for a lower space and above for a wider lower line', () => {
    expect(build([4, 3, 4], true).notes[1].modifierBounds?.y).toBe(
      140 - 3 * 12 - 2,
    );
    expect(build([4, 2, 4], true).notes[1].modifierBounds?.y).toBe(
      140 - 2 * 12 - 12 - 2,
    );
  });
});
