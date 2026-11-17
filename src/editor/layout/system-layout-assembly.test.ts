import { describe, expect, it } from 'vitest';
import { staffPosition, type Neume } from '../domain/chant-document';
import {
  composeSystemsHorizontally,
  geometryInput,
  type BoundaryEvent,
  type PositionedSystem,
} from './horizontal-system-composition';
import type { LayoutBounds } from './neume-geometry';
import { firstSystemBottomStaffY } from './staff-metrics';
import { positionComposedSystem } from './system-layout-assembly';

function punctum(id: string, position: number): Neume {
  return {
    id,
    kind: 'punctum',
    notes: [{ id: `${id}-note`, staffPosition: staffPosition(position) }],
  };
}

/** Every bounds of a composed system, in a stable order. */
function systemBounds(system: PositionedSystem): LayoutBounds[] {
  return [
    ...system.geometries.flatMap((g) => [
      g.bounds,
      ...g.notes,
      ...(g.accidentals ?? []).map((a) => a.hitBounds),
    ]),
    ...system.divisions.map((d) => d.bounds),
    ...system.clefChanges.map((c) => c.bounds),
    ...system.custodes.map((c) => c.bounds),
  ];
}

describe('composed-system translation seam (ADR 0028)', () => {
  // A clef change after the second neume needs an anticipated custos, and a
  // division follows the fourth: every rebuilt element kind is present.
  const neumes = [0, 2, 4, 1, 3].map((p, i) => punctum(`n${i}`, p));
  const events = new Map<number, BoundaryEvent[]>([
    [
      1,
      [
        {
          type: 'clef',
          entity: {
            id: 'clef',
            clef: { type: 'f', staffLine: 3 },
            beforeNeumeId: 'n2',
            beforeDivisionId: null,
          },
        },
      ],
    ],
    [
      3,
      [
        {
          type: 'division',
          entity: { id: 'bar', kind: 'minor', beforeNeumeId: 'n4' },
        },
      ],
    ],
  ]);
  const inputs = neumes.map(geometryInput);
  const [composed] = composeSystemsHorizontally({
    neumes: inputs,
    followingEvents: events,
    initialClef: { type: 'c', staffLine: 3 },
    noteClefs: neumes.map((_, i) =>
      i < 2 ? { type: 'c', staffLine: 3 } : { type: 'f', staffLine: 3 },
    ),
  });

  it('composes the fixture with every rebuilt element kind', () => {
    expect(composed.geometries).toHaveLength(5);
    expect(composed.clefChanges).toHaveLength(1);
    expect(composed.divisions).toHaveLength(1);
    expect(composed.custodes).toHaveLength(1);
  });

  it('reuses a system already at the canonical origin', () => {
    expect(
      positionComposedSystem(composed, firstSystemBottomStaffY, inputs),
    ).toBe(composed);
  });

  it('translates every element vertically and keeps x, identity and order', () => {
    const delta = 337;
    const moved = positionComposedSystem(
      composed,
      firstSystemBottomStaffY + delta,
      inputs,
    );
    expect(Object.keys(moved).sort()).toEqual(Object.keys(composed).sort());
    expect(moved.startNeumeIndex).toBe(composed.startNeumeIndex);
    expect(moved.leadingClef).toEqual(composed.leadingClef);
    expect(moved.clefChanges.map((c) => c.clefChangeId)).toEqual(['clef']);
    expect(moved.divisions.map((d) => d.divisionId)).toEqual(['bar']);
    expect(moved.custodes.map((c) => [c.nextNeumeIndex, c.outgoing])).toEqual(
      composed.custodes.map((c) => [c.nextNeumeIndex, c.outgoing]),
    );
    const before = systemBounds(composed);
    const after = systemBounds(moved);
    expect(after).toHaveLength(before.length);
    after.forEach((bounds, i) => {
      expect(bounds.x).toBe(before[i].x);
      expect(bounds.width).toBe(before[i].width);
      expect(bounds.height).toBe(before[i].height);
      expect(bounds.y - before[i].y).toBe(delta);
    });
  });
});
