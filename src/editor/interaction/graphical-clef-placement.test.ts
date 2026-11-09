import { describe, expect, it } from 'vitest';
import { effectiveOffsets } from '../commands/edit-clef-change';
import { fixture, change, punctum } from '../clef-change.test-cases';
import { layoutChant } from '../layout/layout-chant';
import { buildClefGeometry } from '../layout/clef-geometry';
import {
  resolveGraphicalClefPlacement,
  resolveKeyboardClefPlacement,
  layoutClefDraftPreview,
} from './resolve-graphical-clef-placement';
import {
  createEditorSession,
  reduceEditorSession as reduce,
  type EditorAction,
} from '../state/editor-session';
import { deriveScoreOrder, scoreBoundaryAt } from '../domain/divisions';
import { getGraphicalNeumeKind } from './get-graphical-neume-kind';
import type { Clef, StaffLine } from '../domain/chant-document';

const arm = (clefType: Clef['type'] = 'c'): EditorAction => ({
  type: 'arm',
  tool: { kind: 'place-clef', clefType },
});
const scene = () => ({
  ...fixture(),
  clefChanges: [
    change('C1', 'B', 'D'),
    change('C2', 'B'),
    change('tail', null),
  ],
  divisions: [{ id: 'D', kind: 'minor' as const, beforeNeumeId: 'B' }],
});
describe('graphical C/F clef placement', () => {
  it.each(
    (['c', 'f'] as const).flatMap((type) =>
      ([1, 2, 3, 4] as const).map((staffLine) => ({ type, staffLine })),
    ),
  )(
    'snaps $type to staff line $staffLine with the approved glyph',
    ({ type, staffLine }) => {
      const layout = layoutChant(fixture()),
        system = layout.systems[0],
        slot = system.slots[1];
      for (const delta of [-11, 0, 11]) {
        const placed = resolveGraphicalClefPlacement(layout, type, {
          x: slot.x,
          y: system.staffLines[staffLine - 1].y + delta,
        });
        expect(placed?.clef).toEqual({ type, staffLine });
        expect(placed?.boundary).toEqual(slot.boundary);
        const glyph = placed?.preview.clef;
        if (!glyph) throw Error('Missing glyph');
        expect(glyph).toEqual(
          buildClefGeometry(
            { type, staffLine },
            glyph.x,
            system.staffLines[staffLine - 1].y,
          ),
        );
        expect(glyph.bounds.x).toBeGreaterThanOrEqual(system.staffLines[0].x1);
        expect(glyph.bounds.x + glyph.bounds.width).toBeLessThanOrEqual(
          system.staffLines[0].x2,
        );
        expect('id' in glyph).toBe(false);
      }
    },
  );
  it('rejects invalid/out-of-band points instead of clamping and breaks half-line ties upward', () => {
    const l = layoutChant(fixture());
    for (const point of [
      { x: 200, y: 39.9 },
      { x: 200, y: 136.1 },
      { x: 63.9, y: 100 },
      { x: 657, y: 100 },
      { x: NaN, y: 100 },
      { x: 200, y: Infinity },
      { x: 200, y: 225 },
    ])
      expect(resolveGraphicalClefPlacement(l, 'c', point)).toBeNull();
    expect(
      resolveGraphicalClefPlacement(l, 'c', { x: 200, y: 112 })?.staffLine,
    ).toBe(2);
  });
  it('preserves every mixed semantic slot through preview and commit, including empty and division-only scores', () => {
    for (const d of [
      scene(),
      { ...fixture(), neumes: [] },
      {
        ...fixture(),
        neumes: [],
        divisions: [{ id: 'D', kind: 'finalis' as const, beforeNeumeId: null }],
        clefChanges: [change('C', null, 'D')],
      },
    ]) {
      const l = layoutChant(d),
        order = deriveScoreOrder(d) ?? [];
      for (const s of l.systems)
        for (const slot of s.slots) {
          const point = { x: slot.x, y: s.staffLines[2].y };
          const preview = resolveGraphicalClefPlacement(l, 'c', point);
          expect(preview?.boundary).toEqual(slot.boundary);
          let state = reduce(createEditorSession(d), arm());
          state = reduce(state, {
            type: 'place-clef',
            clefType: 'c',
            id: 'new',
            point,
          });
          expect(state.clefTransaction).toBeNull();
          const expectedIndex = order.findIndex(
            (_, i) =>
              JSON.stringify(scoreBoundaryAt(order, i)) ===
              JSON.stringify(slot.boundary),
          );
          const index = expectedIndex < 0 ? order.length : expectedIndex;
          expect(
            deriveScoreOrder(state.history.present)?.map((i) => i.entity.id),
          ).toEqual([
            ...order.slice(0, index).map((i) => i.entity.id),
            'new',
            ...order.slice(index).map((i) => i.entity.id),
          ]);
          expect(state.history.past).toHaveLength(1);
          expect(state.activeTool).toEqual({
            kind: 'place-clef',
            clefType: 'c',
          });
        }
    }
  });
  it('uses the latest measured layout on click and rejects stale tools, IDs, bands and keyboard targets', () => {
    const d = scene();
    const measure = (text: string) => ({
      width: text.length * 20,
      boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 20),
    });
    d.syllables = [
      {
        id: 's',
        text: 'Alleluia',
        startsAtNeumeId: 'A',
        boundaryBefore: 'word',
      },
    ];
    let s = reduce(createEditorSession(d), arm('f'));
    const point = { x: 300, y: 100 };
    const expected = resolveGraphicalClefPlacement(
      layoutChant(d, measure),
      'f',
      point,
    );
    s = reduce(s, {
      type: 'place-clef',
      clefType: 'f',
      id: 'new',
      point,
      measureLyrics: measure,
    });
    expect(s.clefTransaction).toBeNull();
    const order = deriveScoreOrder(s.history.present) ?? [];
    expect(order.findIndex((i) => i.entity.id === 'new')).toBe(
      (deriveScoreOrder(d) ?? []).findIndex(
        (i) => i.entity.id === expected?.boundary.beforeClefId,
      ),
    );
    const fresh = reduce(createEditorSession(d), arm());
    for (const action of [
      { type: 'place-clef', clefType: 'f', id: 'x', point },
      { type: 'place-clef', clefType: 'c', id: 'C1', point },
      { type: 'place-clef', clefType: 'c', id: 'x', point: { x: 200, y: 200 } },
    ] satisfies EditorAction[])
      expect(reduce(fresh, action)).toBe(fresh);
    expect(
      resolveKeyboardClefPlacement(layoutChant(d), 'c', {
        boundary: {
          beforeNeumeId: 'gone',
          beforeDivisionId: null,
          beforeClefId: null,
        },
        staffLine: 3,
      }),
    ).toBeNull();
  });
  it('commits trailing/redundant placements directly; hover and cancel preserve history, redo and lyric drafts', () => {
    let s = createEditorSession(fixture());
    s = reduce(s, {
      type: 'engraving-edit',
      edit: (d) => ({ ...d, title: 'Changed' }),
    });
    s = reduce(s, { type: 'history', direction: 'undo', focusedNoteId: null });
    s = reduce(s, {
      type: 'lyrics',
      action: { type: 'start', neumeId: 'A' },
      newId: 's',
    });
    s = reduce(s, {
      type: 'lyrics',
      action: { type: 'text', text: 'Ky' },
      newId: 's',
    });
    const history = s.history,
      lyrics = s.lyrics;
    s = reduce(s, arm());
    s = reduce(s, { type: 'hover', point: { x: 200, y: 52 } });
    expect(s.history).toBe(history);
    expect(s.lyrics).toBe(lyrics);
    s = reduce(s, { type: 'select-tool' });
    expect(s.history).toBe(history);
    expect(s.lyrics).toBe(lyrics);
    s = reduce(s, arm());
    s = reduce(s, {
      type: 'place-clef',
      clefType: 'c',
      id: 'redundant',
      point: { x: 200, y: 76 },
    });
    expect(s.clefTransaction).toBeNull();
    expect(s.history.past).toHaveLength(1);
    expect(s.lyrics).toBe(lyrics);
    const tail = reduce(reduce(createEditorSession(fixture()), arm('f')), {
      type: 'place-clef',
      clefType: 'f',
      id: 'tail',
      point: { x: 650, y: 124 },
    });
    expect(tail.clefTransaction).toBeNull();
    expect(tail.history.past).toHaveLength(1);
  });
  it.each(['melody', 'noteheads'] as const)(
    'inserts immediately and restores exact snapshots with %s',
    (preserve) => {
      const d = fixture();
      let s = reduce(
        reduce(
          reduce(createEditorSession(d), {
            type: 'clef-insertion-policy',
            preserve,
          }),
          arm(),
        ),
        {
          type: 'place-clef',
          clefType: 'c',
          id: 'C',
          point: { x: 180, y: 52 },
        },
      );
      expect(s.clefTransaction).toBeNull();
      expect(s.history.present.clefChanges[0].clef.staffLine).toBe(4);
      const committed = s.history.present;
      expect(committed.neumes[1].notes[0].staffPosition).toBe(
        preserve === 'melody' ? 4 : 2,
      );
      expect(s.history.past).toHaveLength(1);
      s = reduce(s, {
        type: 'history',
        direction: 'undo',
        focusedNoteId: null,
      });
      expect(s.history.present).toBe(d);
      s = reduce(s, {
        type: 'history',
        direction: 'redo',
        focusedNoteId: null,
      });
      expect(s.history.present).toBe(committed);
      expect(s.clefTransaction).toBeNull();
    },
  );
  it('supports keyboard-only mixed-slot navigation, persistent insertion and remembered-neume I', () => {
    const d = scene();
    let s = reduce(
      reduce(createEditorSession(d), {
        type: 'arm',
        tool: { kind: 'place-podatus' },
      }),
      arm('f'),
    );
    expect(getGraphicalNeumeKind(s.activeTool)).toBeNull();
    expect(s.rememberedKind).toBe('podatus');
    s = reduce(s, { type: 'clef-keyboard', command: 'start' });
    for (const command of ['next', 'next', 'down', 'down'] as const)
      s = reduce(s, { type: 'clef-keyboard', command });
    expect(s.keyboardClefPlacement).toEqual({
      boundary: scoreBoundaryAt(deriveScoreOrder(d) ?? [], 2),
      staffLine: 1,
    });
    s = reduce(s, { type: 'clef-keyboard', command: 'last' });
    s = reduce(s, { type: 'place-clef', clefType: 'f', id: 'key' });
    expect(
      s.history.present.clefChanges.find((c) => c.id === 'key')?.clef,
    ).toEqual({ type: 'f', staffLine: 1 });
    expect(s.activeTool.kind).toBe('place-clef');
    expect(s.keyboardClefPlacement?.boundary).toEqual({
      beforeNeumeId: null,
      beforeDivisionId: null,
      beforeClefId: null,
    });
    s = reduce(s, { type: 'select-tool' });
    expect(s.keyboardClefPlacement).toBeNull();
    s = reduce(s, { type: 'select', selection: { kind: 'none' } });
    s = reduce(s, {
      type: 'insert',
      ids: { neumeId: 'X', noteIds: ['x1', 'x2', 'x3'] },
    });
    expect(s.history.present.neumes.at(-1)?.kind).toBe('podatus');
  });
  it('finds continuation-side slots and a safe existing-clef draft without changing committed layout', () => {
    const d = {
      ...fixture(),
      neumes: Array.from({ length: 25 }, (_, i) => punctum(`n${i}`)),
      clefChanges: [change('C', 'n11')],
    };
    const l = layoutChant(d),
      snapshot = JSON.stringify(l);
    const cursor = {
      boundary: {
        beforeNeumeId: 'n11',
        beforeDivisionId: null,
        beforeClefId: 'C',
      },
      staffLine: 2 as StaffLine,
    };
    const keyboard = resolveKeyboardClefPlacement(l, 'f', cursor);
    expect(keyboard?.preview.systemIndex).toBe(1);
    const draft = layoutClefDraftPreview(l, 'C', { type: 'f', staffLine: 2 });
    expect(draft?.clef.type).toBe('f');
    expect(draft?.clef.staffLine).toBe(2);
    expect(JSON.stringify(l)).toBe(snapshot);
    expect(
      layoutClefDraftPreview(l, 'gone', { type: 'c', staffLine: 1 }),
    ).toBeNull();
  });
});

it('rejects a keyboard cursor after its referenced clef is removed, without changing the new history', () => {
  const document = scene();
  let s = reduce(createEditorSession(document), arm());
  s = reduce(s, { type: 'clef-keyboard', command: 'start' });
  s = reduce(s, { type: 'clef-keyboard', command: 'next' });
  expect(s.keyboardClefPlacement?.boundary.beforeClefId).toBe('C1');
  s = reduce(s, {
    type: 'edit',
    edit: (d) => ({
      ...d,
      clefChanges: d.clefChanges.filter((c) => c.id !== 'C1'),
    }),
  });
  const history = s.history;
  expect(
    reduce(s, { type: 'place-clef', clefType: 'c', id: 'stale' }).history,
  ).toBe(history);
});

it.each(['melody', 'noteheads'] as const)(
  'remembers %s across consecutive C/F keyboard placements',
  (preserve) => {
    let s = createEditorSession(fixture());
    expect(s.clefInsertionPolicy).toBe('melody');
    s = reduce(s, { type: 'clef-insertion-policy', preserve });
    for (const [index, type] of (['c', 'f', 'c'] as const).entries()) {
      s = reduce(s, arm(type));
      s = reduce(s, { type: 'clef-keyboard', command: 'first' });
      s = reduce(s, { type: 'clef-keyboard', command: 'up' });
      const before = s.history.present;
      s = reduce(s, {
        type: 'place-clef',
        clefType: type,
        id: `placed-${index}`,
      });
      expect(s.clefTransaction).toBeNull();
      expect(s.clefInsertionPolicy).toBe(preserve);
      expect(s.history.past).toHaveLength(index + 1);
      if (preserve === 'noteheads')
        expect(s.history.present.neumes).toBe(before.neumes);
      if (preserve === 'melody')
        for (const n of s.history.present.neumes) {
          const previous = before.neumes.find((old) => old.id === n.id);
          expect(
            n.notes[0].staffPosition +
              (effectiveOffsets(s.history.present)?.get(n.id) ?? 0),
          ).toBe(
            (previous?.notes[0].staffPosition ?? 0) +
              (effectiveOffsets(before)?.get(n.id) ?? 0),
          );
        }
      expect(s.activeTool).toEqual({ kind: 'place-clef', clefType: type });
    }
    expect(s.history.present.clefChanges).toHaveLength(3);
  },
);

it('rejects an overflowing selected insertion policy without fallback, history mutation or a pending dialog; retries explicitly', () => {
  const d = { ...fixture(), neumes: [punctum('A', Number.MAX_SAFE_INTEGER)] };
  let s = reduce(createEditorSession(d), arm());
  s = reduce(s, { type: 'clef-keyboard', command: 'first' });
  s = reduce(s, { type: 'clef-keyboard', command: 'up' });
  const history = s.history;
  const selection = s.selection;
  s = reduce(s, { type: 'place-clef', clefType: 'c', id: 'unsafe' });
  expect(s.history).toBe(history);
  expect(s.selection).toEqual(selection);
  expect(s.clefTransaction).toBeNull();
  expect(s.clefInsertionPolicy).toBe('melody');
  expect(s.clefInsertionError).toContain('overflow');
  expect(s.announcement.text).toBe(s.clefInsertionError);
  s = reduce(s, { type: 'clef-insertion-policy', preserve: 'noteheads' });
  s = reduce(s, { type: 'place-clef', clefType: 'c', id: 'safe' });
  expect(s.history.present.neumes).toBe(d.neumes);
  expect(s.history.past).toHaveLength(1);
  expect(s.clefInsertionError).toBeNull();
  expect(s.clefTransaction).toBeNull();
});

it.each(['melody', 'noteheads'] as const)(
  'commits unaffected trailing and redundant insertion under %s',
  (preserve) => {
    for (const point of [
      { x: 650, y: 52 },
      { x: 180, y: 76 },
    ]) {
      const d = fixture();
      let s = reduce(createEditorSession(d), {
        type: 'clef-insertion-policy',
        preserve,
      });
      s = reduce(s, arm());
      s = reduce(s, { type: 'place-clef', clefType: 'c', id: 'C', point });
      expect(s.clefTransaction).toBeNull();
      expect(s.history.past).toHaveLength(1);
      expect(s.history.present.neumes).toEqual(d.neumes);
    }
  },
);

it('keeps insertion options isolated from a pending existing-clef edit/removal', () => {
  let s = createEditorSession(scene());
  s = reduce(s, { type: 'start-clef-change', id: 'C1' });
  expect(
    reduce(s, { type: 'clef-insertion-policy', preserve: 'noteheads' }),
  ).toBe(s);
  expect(
    reduce(s, {
      type: 'place-clef',
      clefType: 'c',
      id: 'blocked',
      point: { x: 180, y: 52 },
    }),
  ).toBe(s);
});
