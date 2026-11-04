import { describe, expect, it } from 'vitest';
import { buildClefGeometry } from './clef-geometry';
import { layoutChant, staffStep } from './layout-chant';
import { exampleDocument } from '../domain/example-document';
import { getScoreAccessibleDescription } from '../rendering/score-accessible-description';

for (const type of ['c', 'f'] as const)
  for (const staffLine of [1, 2, 3, 4] as const) {
    describe(`${type}${staffLine} engraving`, () => {
      const clef = { type, staffLine };
      it('anchors and measures all painted vertices including the fa virga', () => {
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
          neumes: Array.from({ length: 30 }, (_, i) => ({
            ...exampleDocument.neumes[0],
            id: `n${i}`,
          })),
        };
        const layout = layoutChant(document);
        expect(layout.systems.length).toBeGreaterThan(1);
        for (const system of layout.systems) {
          const line = system.staffLines[staffLine - 1];
          expect(system.clef.y).toBe(line.y);
          expect(system.clef.type).toBe(type);
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
