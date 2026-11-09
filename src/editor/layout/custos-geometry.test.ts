import { describe, expect, it } from 'vitest';
import {
  buildCustosGeometry,
  custosLedgerThickness,
  measureCustosWidth,
} from './custos-geometry';
import { layoutChant } from './layout-chant';
import { fixture, change, punctum } from '../clef-change.test-cases';
import { resolveScoreSlot } from '../interaction/resolve-score-slot';
import { clefOffset } from '../domain/clef';

describe('custos ledger engraving', () => {
  it.each([-1, 0, 1, 2, 3, 4, 5, 6, 7])(
    'omits ledgers at position %s, including the adjacent outside spaces',
    (position) => {
      const guide = buildCustosGeometry(position, 200, 124, 1, false);
      expect(guide.ledgerLines).toBeNull();
      expect(guide.bounds.width).toBe(10);
      expect(guide.staffPosition).toBe(position);
    },
  );
  it.each([
    { position: 8, positions: [8] },
    { position: 9, positions: [8] },
    { position: 10, positions: [10, 8] },
    { position: 11, positions: [10, 8] },
    { position: 14, positions: [14, 12, 10, 8] },
    { position: -2, positions: [-2] },
    { position: -3, positions: [-2] },
    { position: -4, positions: [-2, -4] },
    { position: -5, positions: [-2, -4] },
    { position: -8, positions: [-2, -4, -6, -8] },
  ])(
    'aligns only necessary ledger lines at position $position',
    ({ position, positions }) => {
      const guide = buildCustosGeometry(position, 200, 124, 1, false);
      const lines = guide.ledgerLines;
      if (!lines) throw Error('Expected ledger run');
      expect(lines.count).toBe(positions.length);
      expect(
        Array.from({ length: lines.count }, (_, i) => lines.topY + i * 24),
      ).toEqual(positions.map((p) => 124 - p * 12));
      expect(lines.x1).toBe(200);
      expect(lines.x2).toBe(216);
      expect(guide.path.startsWith(`M203,${124 - position * 12 + 2}`)).toBe(
        true,
      );
      expect(guide.bounds.width).toBe(measureCustosWidth(position));
      expect(guide.bounds.y).toBeLessThanOrEqual(
        lines.topY - custosLedgerThickness / 2,
      );
      expect(guide.bounds.y + guide.bounds.height).toBeGreaterThanOrEqual(
        lines.bottomY + custosLedgerThickness / 2,
      );
      const moved = buildCustosGeometry(position, 230, 368, 1, true);
      expect(moved.ledgerLines?.topY).toBe(lines.topY + 244);
      expect(moved.ledgerLines?.x1).toBe(lines.x1 + 30);
      expect(moved.staffPosition).toBe(position);
    },
  );
  it('keeps exceptionally distant pitch runs compact without truncating their ledger count', () => {
    const g = buildCustosGeometry(Number.MAX_SAFE_INTEGER, 200, 124, 1, false);
    expect(g.ledgerLines?.count).toBe(
      Math.floor((Number.MAX_SAFE_INTEGER - 6) / 2),
    );
    expect(Number.isFinite(g.bounds.height)).toBe(true);
  });
  it.each([14, -10])(
    'contains complete guide ink and ledgers at position %s in the canvas, without moving the staff',
    (position) => {
      const document = {
        ...fixture(),
        clefChanges: [change('C')],
        neumes: [punctum('A'), punctum('B', position + 2)],
      };
      const l = layoutChant(document);
      const g = l.systems[0].custodes[0];
      expect(g.staffPosition).toBe(position);
      expect(l.systems[0].staffLines[0].y).toBe(124);
      expect(l.y).toBeLessThanOrEqual(g.bounds.y - 12);
      expect(l.y + l.height).toBeGreaterThanOrEqual(
        g.bounds.y + g.bounds.height + 12,
      );
      expect(l.width + l.x).toBeGreaterThanOrEqual(g.bounds.x + g.bounds.width);
    },
  );
  it('keeps guide pitches, whole-neume order and measured clearance across ledger-bearing wrapping', () => {
    const document = {
      ...fixture(),
      neumes: Array.from({ length: 40 }, (_, i) =>
        punctum(`n${i}`, i % 2 ? 12 : -6),
      ),
      clefChanges: [change('C', 'n11')],
    };
    const l = layoutChant(document);
    expect(l.systems.flatMap((s) => s.neumes.map((n) => n.neumeId))).toEqual(
      document.neumes.map((n) => n.id),
    );
    expect(l.systems.length).toBeGreaterThan(1);
    for (const system of l.systems)
      for (const g of system.custodes) {
        const incoming =
          g.nextNeumeIndex >= 11 ? document.clefChanges[0].clef : document.clef;
        const outgoing = g.outgoing
          ? (system.clefChanges.at(-1) ?? system.clef)
          : system.clef;
        expect(g.staffPosition).toBe(
          document.neumes[g.nextNeumeIndex].notes[0].staffPosition +
            clefOffset(incoming) -
            clefOffset(outgoing),
        );
        expect(g.ledgerLines).not.toBeNull();
        expect(g.bounds.x + g.bounds.width).toBeLessThanOrEqual(
          system.staffLines[0].x2,
        );
        const following = system.clefChanges.find(
          (c) => c.bounds.x > g.bounds.x,
        );
        if (following)
          expect(g.bounds.x + g.bounds.width + 10).toBeLessThanOrEqual(
            following.bounds.x,
          );
      }
  });
});

it('extends oversized staffs/canvas and keeps insertion carets clear of the complete ledger width', () => {
  const document = {
    ...fixture(),
    neumes: [punctum('A'), punctum('B', 12)],
    clefChanges: [change('C')],
    syllables: [
      {
        id: 's',
        text: 'a'.repeat(150),
        startsAtNeumeId: 'A',
        boundaryBefore: 'word' as const,
      },
    ],
  };
  const l = layoutChant(document, (text) => ({
    width: text.length * 20,
    boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 20),
  }));
  expect(l.systems.some((s) => s.staffLines[0].x2 > 656)).toBe(true);
  for (const s of l.systems)
    for (const g of s.custodes) {
      expect(g.ledgerLines).not.toBeNull();
      expect(g.bounds.x + g.bounds.width).toBeLessThan(s.staffLines[0].x2);
      expect(g.bounds.x + g.bounds.width).toBeLessThan(l.x + l.width);
      for (const slot of s.slots) {
        expect(
          slot.x + 4 <= g.bounds.x || slot.x - 4 >= g.bounds.x + g.bounds.width,
        ).toBe(true);
        expect(
          resolveScoreSlot(l, { x: slot.x, y: s.staffLines[1].y })?.slot
            .boundary,
        ).toEqual(slot.boundary);
      }
    }
});
