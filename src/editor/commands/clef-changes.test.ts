import { clefOffset } from '../domain/clef';
import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Clef,
  type ClefChange,
} from '../domain/chant-document';
import {
  deriveScoreOrder,
  hasValidDivisions,
  resolveScoreBoundary,
  scoreBoundaryAt,
} from '../domain/divisions';
import {
  insertClefChange,
  updateClefChange,
  deleteClefChange,
  preserveClefMelody,
  hasChangedEffectivePitches,
} from './edit-clef-change';
import {
  insertDivision,
  deleteDivision,
  updateDivisionKind,
} from './edit-division';
import { insertNeume } from './insert-neume';
import { deleteNeume } from './delete-neume';
import { deleteNote } from './delete-note';
import { updateClef } from './update-clef';

import { punctum, fixture, change } from '../clef-change.test-cases';
const ids = (d: ChantDocument) => deriveScoreOrder(d)?.map((i) => i.entity.id);
const slot = (d: ChantDocument, index: number) =>
  scoreBoundaryAt(deriveScoreOrder(d) ?? [], index);

describe('mixed semantic clef boundaries', () => {
  it('splits a clef run with a division and then merges in derived order', () => {
    const d = { ...fixture(), clefChanges: [change('C1'), change('C2')] };
    const next = insertDivision(
      d,
      { id: 'D', kind: 'minor', beforeNeumeId: 'B' },
      slot(d, 2),
    );
    expect(ids(next)).toEqual(['A', 'C1', 'D', 'C2', 'B', 'E']);
    expect(next.clefChanges.map((c) => c.beforeDivisionId)).toEqual([
      'D',
      null,
    ]);
    expect(ids(deleteDivision(next, 'D'))).toEqual(ids(d));
    expect(ids(updateDivisionKind(next, 'D', 'finalis'))).toEqual(ids(next));
  });
  it('merges transferred events before destination events with reversed collection order', () => {
    const d = {
      ...fixture(),
      divisions: [{ id: 'D', kind: 'minor' as const, beforeNeumeId: 'E' }],
      clefChanges: [change('C2', 'E'), change('C1', 'B')],
    };
    expect(ids(d)).toEqual(['A', 'C1', 'B', 'D', 'C2', 'E']);
    const next = deleteNeume(d, 'B');
    expect(ids(next)).toEqual(['A', 'C1', 'D', 'C2', 'E']);
    expect(next.clefChanges.find((c) => c.id === 'C1')?.beforeDivisionId).toBe(
      'D',
    );
    expect(hasValidDivisions(next)).toBe(true);
    expect(ids(deleteDivision(next, 'D'))).toEqual(['A', 'C1', 'C2', 'E']);
  });
  it('splits and reanchors mixed events at every insertion slot', () => {
    const d = {
      ...fixture(),
      divisions: [
        { id: 'D1', kind: 'minor' as const, beforeNeumeId: 'B' },
        { id: 'D2', kind: 'finalis' as const, beforeNeumeId: 'B' },
      ],
      clefChanges: [
        change('C3'),
        change('C1', 'B', 'D1'),
        change('C2', 'B', 'D2'),
      ],
    };
    const order = ids(d) ?? [];
    for (let i = 0; i <= order.length; i++) {
      const next = insertNeume(d, punctum('X'), slot(d, i));
      expect(ids(next)).toEqual([...order.slice(0, i), 'X', ...order.slice(i)]);
      expect(hasValidDivisions(next)).toBe(true);
      expect(ids(deleteNeume(next, 'X'))).toEqual(order);
    }
  });
  it('rejects legacy ambiguity and stale/wrong-slot references exactly', () => {
    const d = { ...fixture(), clefChanges: [change('C1')] };
    expect(insertNeume(d, punctum('X'), 1)).toBe(d);
    expect(
      resolveScoreBoundary(d, { beforeNeumeId: 'B', beforeDivisionId: null }),
    ).toBeNull();
    for (const boundary of [
      { beforeNeumeId: 'A', beforeDivisionId: null, beforeClefId: 'C1' },
      { beforeNeumeId: 'B', beforeDivisionId: 'missing', beforeClefId: null },
      { beforeNeumeId: 'B', beforeDivisionId: null, beforeClefId: 'missing' },
    ])
      expect(insertNeume(d, punctum('X'), boundary)).toBe(d);
    expect(
      insertNeume(d, punctum('X'), {
        beforeNeumeId: 'A',
        beforeDivisionId: null,
      }),
    ).not.toBe(d);
  });
  it('supports leading, trailing, redundant and division-only empty scores', () => {
    let d: ChantDocument = { ...fixture(), neumes: [] };
    for (let i = 0; i < 5; i++)
      d = insertClefChange(d, change(`C${i}`, null, null, d.clef), {
        beforeNeumeId: null,
        beforeDivisionId: null,
        beforeClefId: null,
      });
    expect(ids(d)).toEqual(['C0', 'C1', 'C2', 'C3', 'C4']);
    d = insertDivision(
      d,
      { id: 'D', kind: 'finalis', beforeNeumeId: null },
      slot(d, 2),
    );
    expect(ids(d)).toEqual(['C0', 'C1', 'D', 'C2', 'C3', 'C4']);
    expect(ids(deleteClefChange(d, 'C3'))).toEqual([
      'C0',
      'C1',
      'D',
      'C2',
      'C4',
    ]);
  });
  it('preserves anchors when note deletion normalizes a stable neume', () => {
    const d: ChantDocument = {
      ...fixture(),
      clefChanges: [change('C1')],
      neumes: [
        punctum('A'),
        {
          id: 'B',
          kind: 'podatus',
          notes: [
            { id: 'b1', staffPosition: staffPosition(1) },
            { id: 'b2', staffPosition: staffPosition(3) },
          ],
        },
        punctum('E'),
      ],
    };
    expect(deleteNote(d, 'b1').clefChanges).toBe(d.clefChanges);
    expect(ids(deleteNote(d, 'b1'))).toEqual(ids(d));
  });
  it('rejects malformed values, cross-boundary anchors and all identity collisions', () => {
    const d = fixture();
    for (const c of [
      change('A'),
      change('note-A'),
      change(''),
      change('bad', 'missing'),
      change('bad', 'B', 'missing'),
      { ...change('bad'), clef: { type: 'g', staffLine: 3 } },
      { ...change('bad'), extra: true },
    ])
      expect(hasValidDivisions({ ...d, clefChanges: [c as ClefChange] })).toBe(
        false,
      );
    expect(
      hasValidDivisions({ ...d, clefChanges: [change('C'), change('C')] }),
    ).toBe(false);
    expect(
      hasValidDivisions({
        ...d,
        clefChanges: undefined,
      } as unknown as ChantDocument),
    ).toBe(false);
    expect(deleteClefChange(d, 'missing')).toBe(d);
    expect(updateClefChange(d, 'missing', d.clef)).toBe(d);
    const occupied = { ...d, clefChanges: [change('C')] };
    expect(updateClefChange(occupied, 'C', occupied.clefChanges[0].clef)).toBe(
      occupied,
    );
  });
});

const clefs: Clef[] = (['c', 'f'] as const).flatMap((type) =>
  ([1, 2, 3, 4] as const).map((staffLine) => ({ type, staffLine })),
);
describe('effective passage transformations', () => {
  it.each(clefs.flatMap((before) => clefs.map((after) => ({ before, after }))))(
    'scopes $before → $after to the governed passage',
    ({ before, after }) => {
      const d = {
        ...fixture(),
        clef: before,
        clefChanges: [
          change('C1', 'B', null, before),
          change('C2', 'E', null, { type: 'f', staffLine: 3 }),
        ],
      };
      const candidate = updateClefChange(d, 'C1', after);
      const kept = preserveClefMelody(d, candidate);
      expect(kept?.neumes[0]).toBe(d.neumes[0]);
      expect(kept?.neumes[2]).toBe(d.neumes[2]);
      expect(kept?.neumes[1].notes[0].staffPosition).toBe(
        2 + clefOffset(before) - clefOffset(after),
      );
      expect(kept?.neumes[1].notes[0].id).toBe('note-B');
      expect(candidate.neumes).toBe(d.neumes);
      expect(hasChangedEffectivePitches(d, candidate)).toBe(
        clefOffset(before) !== clefOffset(after),
      );
    },
  );
  it('initial editing always preserves melody only before the first explicit change', () => {
    const d = { ...fixture(), clefChanges: [change('C1')] };
    const next = updateClef(d, { type: 'f', staffLine: 3 });
    expect(next.neumes[0].notes[0].staffPosition).toBe(-1);
    expect(next.neumes[1]).toBe(d.neumes[1]);
    expect(next.neumes[2]).toBe(d.neumes[2]);
    const leading = { ...d, clefChanges: [change('C1', 'A')] };
    expect(updateClef(leading, { type: 'f', staffLine: 1 }).neumes).toEqual(
      d.neumes,
    );
  });
  it('retains redundant authored events without a prompt and rejects unsafe translations', () => {
    const d = fixture();
    const next = insertClefChange(d, change('C', 'B', null, d.clef), {
      beforeNeumeId: 'B',
      beforeDivisionId: null,
    });
    expect(next.clefChanges).toHaveLength(1);
    expect(hasChangedEffectivePitches(d, next)).toBe(false);
    const unsafe = { ...d, neumes: [punctum('A', Number.MAX_SAFE_INTEGER)] };
    expect(updateClef(unsafe, { type: 'c', staffLine: 4 })).toBe(unsafe);
  });
});
