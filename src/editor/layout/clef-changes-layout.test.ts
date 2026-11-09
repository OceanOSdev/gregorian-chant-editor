import { describe, expect, it } from 'vitest';
import { change, fixture, punctum } from '../clef-change.test-cases';
import { clefOffset } from '../domain/clef';
import { deriveScoreOrder } from '../domain/divisions';
import { layoutChant, staffEndX } from './layout-chant';
import { resolveScoreSlot } from '../interaction/resolve-score-slot';
import type { Clef } from '../domain/chant-document';

const clefs: Clef[] = (['c', 'f'] as const).flatMap((type) =>
  ([1, 2, 3, 4] as const).map((staffLine) => ({ type, staffLine })),
);
describe('measured clef changes and derived custodes', () => {
  it.each(
    clefs.flatMap((outgoing) =>
      clefs.map((incoming) => ({ outgoing, incoming })),
    ),
  )(
    'derives the guide under the outgoing clef: $outgoing to $incoming',
    ({ outgoing, incoming }) => {
      const d = {
        ...fixture(),
        clef: outgoing,
        clefChanges: [change('C', 'B', null, incoming)],
      };
      const s = layoutChant(d).systems[0];
      expect(s.clefChanges.map((c) => c.clefChangeId)).toEqual(['C']);
      const guide = s.custodes[0];
      if (clefOffset(outgoing) === clefOffset(incoming))
        expect(guide).toBeUndefined();
      else {
        expect(guide.staffPosition).toBe(
          2 + clefOffset(incoming) - clefOffset(outgoing),
        );
        expect(guide.outgoing).toBe(false);
        expect(guide.bounds.x + guide.bounds.width).toBeLessThan(
          s.clefChanges[0].bounds.x,
        );
        expect(
          s.clefChanges[0].bounds.x + s.clefChanges[0].bounds.width,
        ).toBeLessThan(s.neumes[1].bounds.x);
      }
    },
  );
  it('retains leading/consecutive/redundant/trailing clefs and uses only one meaningful guide', () => {
    const d = {
      ...fixture(),
      clefChanges: [
        change('leading', 'A'),
        change('C1'),
        change('C2', 'B', null, { type: 'f', staffLine: 1 }),
        change('tail', null),
      ],
    };
    const l = layoutChant(d);
    expect(l.systems[0].clef.type).toBe('c');
    expect(l.systems[0].leadingClefChangeId).toBeNull();
    expect(
      l.systems.flatMap((s) => s.clefChanges.map((c) => c.clefChangeId)),
    ).toEqual(['leading', 'C1', 'C2', 'tail']);
    expect(
      l.systems[0].custodes
        .filter((c) => !c.outgoing)
        .map((c) => c.nextNeumeIndex),
    ).toEqual([0, 1]);
    const empty = layoutChant({
      ...d,
      neumes: [],
      clefChanges: [change('empty', null)],
    });
    expect(empty.systems[0].clefChanges).toHaveLength(1);
    expect(empty.systems[0].custodes).toHaveLength(0);
  });
  it('substitutes only the first authored system-leading clef and keeps a preceding bar on the old staff', () => {
    const d = {
      ...fixture(),
      neumes: Array.from({ length: 15 }, (_, i) => punctum(`n${i}`)),
      divisions: [{ id: 'D', kind: 'minima' as const, beforeNeumeId: 'n11' }],
      clefChanges: [
        change('C1', 'n11'),
        change('C2', 'n11', null, { type: 'f', staffLine: 2 }),
      ],
    };
    const l = layoutChant(d);
    const target = l.systems.find((s) =>
      s.clefChanges.some((c) => c.clefChangeId === 'C1'),
    );
    expect(target?.index).toBeGreaterThan(0);
    expect(target?.leadingClefChangeId).toBe('C1');
    expect(target?.clefChanges[0].x).toBe(100);
    expect(target?.clefChanges.map((c) => c.clefChangeId)).toEqual([
      'C1',
      'C2',
    ]);
    const previous = l.systems[(target?.index ?? 1) - 1];
    expect(previous.divisions.map((d) => d.divisionId)).toEqual(['D']);
    expect(previous.custodes).toHaveLength(1);
    expect(previous.custodes[0].outgoing).toBe(true);
    expect(previous.custodes[0].staffPosition).toBe(
      2 + clefOffset(d.clefChanges[1].clef) - clefOffset(d.clef),
    );
    expect(target?.custodes.filter((c) => !c.outgoing)).toHaveLength(0);
  });
  it('repeats the incoming decorative clef when a division is the first semantic event', () => {
    const d = {
      ...fixture(),
      neumes: [],
      divisions: Array.from({ length: 70 }, (_, i) => ({
        id: `d${i}`,
        kind: 'finalis' as const,
        beforeNeumeId: null,
      })),
      clefChanges: [change('C', null, 'd40', { type: 'f', staffLine: 1 })],
    };
    const l = layoutChant(d);
    expect(l.systems.length).toBeGreaterThan(1);
    expect(l.systems.flatMap((s) => s.divisions)).toHaveLength(70);
    const s = l.systems.find((s) => s.clefChanges.length);
    expect(s?.divisions[0].bounds.x).toBeLessThan(
      s?.clefChanges[0].bounds.x ?? 0,
    );
    expect(s?.leadingClefChangeId).toBeNull();
    expect(s?.clef.type).toBe('c');
    expect(l.systems.flatMap((s) => s.custodes)).toHaveLength(0);
  });
  it('makes bounded deterministic progress for a long mixed run with complete IDs and slots', () => {
    const d = {
      ...fixture(),
      divisions: Array.from({ length: 150 }, (_, i) => ({
        id: `D${i}`,
        kind: 'finalis' as const,
        beforeNeumeId: 'B',
      })),
      clefChanges: Array.from({ length: 150 }, (_, i) =>
        change(`C${i}`, 'B', `D${149 - i}`),
      ),
    };
    const l = layoutChant(d);
    expect(layoutChant(d)).toEqual(l);
    expect(l.systems.length).toBeLessThan(301);
    expect(l.systems.flatMap((s) => s.divisions)).toHaveLength(150);
    expect(l.systems.flatMap((s) => s.clefChanges)).toHaveLength(150);
    const expected = deriveScoreOrder(d)?.map((i) => i.entity.id);
    const actual = l.systems.flatMap((s) =>
      [
        ...s.neumes.map((n) => ({ id: n.neumeId, x: n.bounds.x })),
        ...s.divisions.map((n) => ({ id: n.divisionId, x: n.bounds.x })),
        ...s.clefChanges.map((n) => ({ id: n.clefChangeId, x: n.bounds.x })),
      ]
        .sort((a, b) => a.x - b.x)
        .map((i) => i.id),
    );
    expect(actual).toEqual(expected);
    for (const system of l.systems) {
      for (const slot of system.slots) {
        const resolved = resolveScoreSlot(l, {
          x: slot.x,
          y: system.staffLines[1].y,
        });
        expect(resolved?.slot.boundary).toEqual(slot.boundary);
      }
      for (const c of system.custodes)
        expect(c.bounds.x + c.bounds.width).toBeLessThanOrEqual(staffEndX);
    }
  });
});

it.each(['word', 'continuation'] as const)(
  'clears measured lyrics and hyphens across a clef within a %s boundary',
  (boundaryBefore) => {
    const d = {
      ...fixture(),
      clefChanges: [change('C')],
      syllables: [
        {
          id: 's1',
          text: 'Alleluia',
          startsAtNeumeId: 'A',
          boundaryBefore: 'word' as const,
        },
        { id: 's2', text: 'Dominus', startsAtNeumeId: 'B', boundaryBefore },
      ],
    };
    const measure = (text: string) => ({
      width: text.length * 12,
      boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 12),
    });
    const l = layoutChant(d, measure);
    const s = l.systems[0];
    expect(s.clefChanges[0].bounds.x).toBeGreaterThan(s.lyrics[0].right ?? 0);
    expect(s.lyrics[1].left).toBeGreaterThan(
      s.clefChanges[0].bounds.x + s.clefChanges[0].bounds.width,
    );
    for (const mark of s.hyphens) {
      expect(mark.x).toBeGreaterThan(
        s.clefChanges[0].bounds.x + s.clefChanges[0].bounds.width,
      );
      expect(mark.x + 6).toBeLessThan(s.lyrics[1].left ?? 0);
    }
    expect(s.hyphens.length).toBe(boundaryBefore === 'continuation' ? 1 : 0);
  },
);

it('replaces the mid-staff guide with one outgoing guide when its transition reflows', () => {
  const score = (count: number) => ({
    ...fixture(),
    neumes: [
      ...Array.from({ length: count }, (_, i) => punctum(`prefix${i}`)),
      punctum('B'),
    ],
    clefChanges: [change('C')],
  });
  const mid = layoutChant(score(3));
  expect(mid.systems[0].custodes.map((g) => g.outgoing)).toEqual([false]);
  const wrapped = layoutChant(score(11));
  expect(wrapped.systems[1].leadingClefChangeId).toBe('C');
  expect(
    wrapped.systems.flatMap((s) => s.custodes).map((g) => g.outgoing),
  ).toEqual([true]);
});
