import type { PunctumNeume } from '../domain/chant-document';
import { describe, expect, it } from 'vitest';
import { buildClefGeometry } from './clef-geometry';
import { layoutChant, staffStep } from './layout-chant';
import { exampleDocument } from '../domain/example-document';
import { getScoreAccessibleDescription } from '../rendering/score-accessible-description';

for (const type of ['c', 'f'] as const)
  for (const staffLine of [1, 2, 3, 4] as const) {
    describe(`${type}${staffLine} engraving`, () => {
      const clef = { type, staffLine };
      it('encloses Bézier controls with extrema reached by the contour', () => {
        const geometry = buildClefGeometry(
          clef,
          100,
          124 - 2 * (staffLine - 1) * staffStep,
        );
        const points =
          geometry.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        const xs = points.filter((_, i) => i % 2 === 0);
        const ys = points.filter((_, i) => i % 2 === 1);
        expect(Math.min(...xs)).toBeCloseTo(geometry.bounds.x);
        expect(Math.max(...xs)).toBeCloseTo(
          geometry.bounds.x + geometry.bounds.width,
        );
        expect(Math.min(...ys)).toBeCloseTo(geometry.bounds.y);
        expect(Math.max(...ys)).toBeCloseTo(
          geometry.bounds.y + geometry.bounds.height,
        );
        expect(geometry.hitBounds.x).toBeLessThan(geometry.bounds.x);
        expect(geometry.hitBounds.y).toBeLessThan(geometry.bounds.y);
        const translated = buildClefGeometry(clef, 200, geometry.y + 244);
        expect(translated.bounds.x - geometry.bounds.x).toBeCloseTo(100);
        expect(translated.bounds.y - geometry.bounds.y).toBeCloseTo(244);
      });
      it('repeats the same derived clef through wrapping and retains empty score ink', () => {
        const document = {
          ...exampleDocument,
          clef,
          syllables: [],
          neumes: Array.from({ length: 30 }, (_, i): PunctumNeume => ({
            ...exampleDocument.neumes[0],
            kind: 'punctum',
            id: `n${i}`,
            notes: [
              {
                id: `note${i}`,
                staffPosition: exampleDocument.neumes[0].notes[0].staffPosition,
              },
            ],
          })),
        };
        const layout = layoutChant(document);
        expect(layout.systems.length).toBeGreaterThan(1);
        for (const system of layout.systems) {
          const line = system.staffLines[staffLine - 1];
          expect(system.clef.y).toBe(line.y);
          expect(system.clef.type).toBe(type);
          const leadingGap =
            system.neumes[0].bounds.x -
            system.clef.bounds.x -
            system.clef.bounds.width;
          expect(leadingGap).toBeGreaterThanOrEqual(33);
          expect(leadingGap).toBeLessThan(4 * staffStep);
          expect(system.neumes[0].bounds.x).toBeGreaterThan(
            system.clef.hitBounds.x + system.clef.hitBounds.width,
          );
        }
        const empty = layoutChant({ ...document, neumes: [] });
        expect(empty.systems).toHaveLength(1);
        expect(empty.systems[0].clef.path).toBeTruthy();
        expect(getScoreAccessibleDescription(empty)).toContain(
          `Initial ${type.toUpperCase()} (${type === 'c' ? 'do' : 'fa'}) clef on staff line ${staffLine}`,
        );
      });
    });
  }

it('keeps outgoing-reservation leftward fitting clear of clef ink', () => {
  const document = {
    ...exampleDocument,
    neumes: exampleDocument.neumes,
    syllables: [
      { ...exampleDocument.syllables[0], text: 'a' + 'b'.repeat(55) },
      {
        id: 'next',
        text: 'men',
        startsAtNeumeId: 'neume-torculus-1',
        boundaryBefore: 'continuation' as const,
      },
    ],
  };
  const layout = layoutChant(document, (text) => ({
    width: text.length * 10,
    boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 10),
  }));
  const system = layout.systems[0];
  expect(system.neumes[0].bounds.x).toBeGreaterThanOrEqual(
    system.clef.bounds.x + system.clef.bounds.width + 33,
  );
  expect(layout.width).toBeGreaterThan(720);
  expect(system.hyphens[0].outgoing).toBe(true);
});

// Frozen from the owner-approved attachment comparison, independently of the builder.
it('retains the approved C contour and adopts the reviewed F attachment exactly', () => {
  const c = buildClefGeometry({ type: 'c', staffLine: 3 }, 2.4, 0);
  const f = buildClefGeometry({ type: 'f', staffLine: 3 }, 0, 0);
  expect(c.path).toBe(
    'M 7.800000000000001 -19.44 C -4.440892098500626e-16 -19.44 -3.36 -15.72 -3.36 -10.2 L -3.36 11.52 C -3.36 17.52 0.23999999999999977 19.44 7.800000000000001 19.44 L 7.800000000000001 4.800000000000001 C 4.4399999999999995 5.76 0.96 5.16 -1.1999999999999997 3 L -1.1999999999999997 -3 C 0.96 -5.28 4.4399999999999995 -5.76 7.800000000000001 -4.800000000000001 Z',
  );
  expect(f.path).toBe(
    'M 7.800000000000001 -19.44 C -4.440892098500626e-16 -19.44 -3.36 -15.72 -3.36 -10.2 L -3.36 11.52 C -3.36 17.52 0.23999999999999977 19.44 7.800000000000001 19.44 L 7.800000000000001 4.800000000000001 C 4.4399999999999995 5.76 0.96 5.16 -1.1999999999999997 3 L -1.1999999999999997 -3 C 0.96 -5.28 4.4399999999999995 -5.76 7.800000000000001 -4.800000000000001 Z M -3.3600000000000003 -5.04 L -7.92 -6 L -12.48 -6.48 Q -15.600000000000001 -6.48 -15.600000000000001 -3.5999999999999996 L -15.600000000000001 4.800000000000001 Q -15.600000000000001 6.12 -13.440000000000001 6.36 L -7.4399999999999995 5.88 C -7.32 10.32 -6.720000000000001 14.64 -6.48 17.88 Q -6.36 19.080000000000002 -5.16 18.48 C -4.5600000000000005 16.56 -3.84 13.68 -3.3600000000000003 11.52 Z',
  );
  expect(f.path.startsWith(`${c.path} `)).toBe(true);
  expect(f.bounds.y).toBe(-19.44);
  expect(f.bounds.width).toBeCloseTo(23.4);
  expect(f.bounds.height).toBe(38.88);
});
