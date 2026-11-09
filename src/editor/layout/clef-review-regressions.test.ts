import { describe, expect, it } from 'vitest';
import { fixture, change, punctum } from '../clef-change.test-cases';
import { layoutChant, staffEndX } from './layout-chant';
import { resolveScoreSlot } from '../interaction/resolve-score-slot';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { insertNeume } from '../commands/insert-neume';
import { deriveScoreOrder, scoreBoundaryAt } from '../domain/divisions';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { divisionGap } from './division-geometry';
import { getScoreAccessibleDescription } from '../rendering/score-accessible-description';

describe('PR 60 clef layout regressions', () => {
  it.each(['mid-staff', 'trailing', 'system-leading'] as const)(
    'inserts graphical neumes on both sides of a %s authored clef',
    (position) => {
      const d = fixture();
      if (position === 'system-leading')
        d.neumes = [
          ...Array.from({ length: 11 }, (_, i) => punctum(`p${i}`)),
          punctum('B'),
        ];
      d.clefChanges = [change('C', position === 'trailing' ? null : 'B')];
      const l = layoutChant(d);
      const system = l.systems.find((s) => s.clefChanges.length);
      if (!system) throw Error('Missing authored clef');
      const clef = system.clefChanges[0];
      if (position === 'system-leading')
        expect(system.leadingClefChangeId).toBe('C');
      const order = deriveScoreOrder(d) ?? [];
      const index = order.findIndex((i) => i.entity.id === 'C');
      for (const after of [false, true]) {
        const result = resolveGraphicalNeumePlacement(l, 'punctum', {
          x: after ? clef.bounds.x + clef.bounds.width + 1 : clef.bounds.x - 1,
          y: system.staffLines[1].y,
        });
        expect(result?.boundary).toEqual(
          scoreBoundaryAt(order, index + Number(after)),
        );
        if (!result) throw Error('Missing placement');
        const next = insertNeume(d, punctum('X'), result.boundary);
        expect(deriveScoreOrder(next)?.map((i) => i.entity.id)).toEqual([
          ...order.slice(0, index + Number(after)).map((i) => i.entity.id),
          'X',
          ...order.slice(index + Number(after)).map((i) => i.entity.id),
        ]);
      }
    },
  );
  it.each([false, true])(
    'extends staff ink through oversized clefs and guides; trailing=%s',
    (trailing) => {
      const d = {
        ...fixture(),
        clefChanges: [change('C', trailing ? null : 'B')],
        syllables: [
          {
            id: 's',
            text: 'a'.repeat(120),
            startsAtNeumeId: trailing ? 'E' : 'A',
            boundaryBefore: 'word' as const,
          },
        ],
      };
      const l = layoutChant(d, (text) => ({
        width: text.length * 12,
        boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 12),
      }));
      const system = l.systems.find((s) => s.clefChanges.length);
      if (!system) throw Error('Missing clef system');
      expect(system.staffLines[0].x2).toBeGreaterThan(staffEndX);
      for (const item of [...system.clefChanges, ...system.custodes])
        expect(system.staffLines[0].x2).toBeGreaterThan(
          item.bounds.x + item.bounds.width,
        );
      for (const slot of system.slots) {
        expect(
          resolveScoreSlot(l, { x: slot.x, y: system.staffLines[1].y })?.slot
            .boundary,
        ).toEqual(slot.boundary);
        expect(
          resolveGraphicalNeumePlacement(l, 'punctum', {
            x: slot.x,
            y: system.staffLines[1].y,
          })?.boundary,
        ).toEqual(slot.boundary);
      }
    },
  );
  it('keeps caret caps clear of both mid-staff and outgoing custodes', () => {
    const d = {
      ...fixture(),
      neumes: [...Array.from({ length: 25 }, (_, i) => punctum(`n${i}`))],
      clefChanges: [change('C', 'n3')],
    };
    const l = layoutChant(d);
    expect(l.systems.flatMap((s) => s.custodes).some((c) => !c.outgoing)).toBe(
      true,
    );
    expect(l.systems.flatMap((s) => s.custodes).some((c) => c.outgoing)).toBe(
      true,
    );
    for (const s of l.systems)
      for (const slot of s.slots)
        for (const c of s.custodes)
          expect(
            slot.x + 4 <= c.bounds.x ||
              slot.x - 4 >= c.bounds.x + c.bounds.width,
          ).toBe(true);
  });
  it('does not duplicate the outgoing guide when the next staff starts with divisions before its clef', () => {
    const d = {
      ...fixture(),
      neumes: [punctum('A'), punctum('B')],
      divisions: Array.from({ length: 30 }, (_, i) => ({
        id: `D${i}`,
        kind: 'minor' as const,
        beforeNeumeId: 'B',
      })),
      clefChanges: [change('C', 'B', 'D29')],
    };
    const systems = layoutChant(d).systems;
    expect(systems).toHaveLength(2);
    expect(systems[1].divisions[0].divisionId).toBe('D27');
    expect(systems[1].leadingClefChangeId).toBeNull();
    expect(systems[0].custodes).toHaveLength(1);
    expect(systems[0].custodes[0].outgoing).toBe(true);
    expect(systems[1].custodes).toHaveLength(0);
  });
  it('reclaims the removed mid-staff guide advance when the following neume wraps', () => {
    const d: ChantDocument = {
      ...fixture(),
      neumes: [
        ...Array.from({ length: 10 }, (_, i) => punctum(`p${i}`)),
        {
          id: 'B',
          kind: 'clivis',
          notes: [
            { id: 'b1', staffPosition: staffPosition(4) },
            { id: 'b2', staffPosition: staffPosition(2) },
          ],
        },
      ],
      clefChanges: [change('C')],
    };
    const systems = layoutChant(d).systems;
    expect(systems).toHaveLength(2);
    expect(systems[0].clefChanges).toHaveLength(1);
    expect(systems[0].custodes.map((c) => c.outgoing)).toEqual([true]);
    const last = systems[0].neumes.at(-1);
    expect(systems[0].clefChanges[0].bounds.x).toBe(
      (last?.bounds.x ?? 0) + (last?.bounds.width ?? 0) + divisionGap,
    );
  });
  it('repeats an effective clef differing from the initial clef on a continuation staff', () => {
    const d = {
      ...fixture(),
      neumes: Array.from({ length: 30 }, (_, i) => punctum(`n${i}`)),
      clefChanges: [
        change('C', 'n1', null, { type: 'f' as const, staffLine: 2 as const }),
      ],
    };
    const l = layoutChant(d);
    expect(l.systems.length).toBeGreaterThan(1);
    expect(l.systems[1].leadingClefChangeId).toBeNull();
    expect(l.systems[1].clef).toMatchObject({ type: 'f', staffLine: 2 });
    const description = getScoreAccessibleDescription(l);
    expect(description).toContain('1 authored clef change');
    expect(description).toContain('F (fa) on staff line 2');
    expect(description).not.toContain('repeated on every system');
  });
});
