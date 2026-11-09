import { describe, expect, it } from 'vitest';
import { layoutChant } from '../layout/layout-chant';
import { change, fixture, punctum } from '../clef-change.test-cases';
import {
  createEditorSession,
  reduceEditorSession as reduce,
  type EditorAction,
} from './editor-session';
import { staffPosition, type Clef } from '../domain/chant-document';

const start = (id = 'C'): EditorAction => ({
  type: 'start-clef-change',
  id,
  boundary: { beforeNeumeId: 'B', beforeDivisionId: null, beforeClefId: null },
});
describe('staged clef transactions', () => {
  it('stages repeated changes, then commits one final pitch decision and exact undo/redo', () => {
    const d = fixture();
    let s = reduce(createEditorSession(d), start());
    const history = s.history;
    for (const clef of [
      { type: 'f', staffLine: 1 },
      { type: 'c', staffLine: 2 },
      { type: 'c', staffLine: 4 },
    ] satisfies Clef[])
      s = reduce(s, { type: 'draft-clef-change', clef });
    expect(s.history).toBe(history);
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.clefTransaction?.candidate).not.toBeNull();
    expect(s.history).toBe(history);
    const blocked: EditorAction[] = [
      { type: 'history', direction: 'undo', focusedNoteId: null },
      { type: 'change-clef', clef: { type: 'f', staffLine: 1 } },
      { type: 'edit', edit: () => fixture() },
      { type: 'delete-division', id: 'D' },
      { type: 'lyrics', action: { type: 'cancel' }, newId: 'unused' },
    ];
    for (const action of blocked) expect(reduce(s, action)).toBe(s);
    s = reduce(s, { type: 'confirm-clef-change', preserve: 'melody' });
    expect(s.history.past).toHaveLength(1);
    expect(s.history.present.neumes[1].notes[0].staffPosition).toBe(4);
    const committed = s.history.present;
    s = reduce(s, { type: 'history', direction: 'undo', focusedNoteId: null });
    expect(s.history.present).toBe(d);
    s = reduce(s, { type: 'history', direction: 'redo', focusedNoteId: null });
    expect(s.history.present).toBe(committed);
    expect(s.clefTransaction).toBeNull();
  });
  it('preserves noteheads, limits affected passages and prompts once for deletion', () => {
    const d = {
      ...fixture(),
      clefChanges: [
        change('C'),
        change('later', 'E', null, { type: 'f', staffLine: 3 }),
      ],
    };
    let s = reduce(createEditorSession(d), {
      type: 'start-clef-change',
      id: 'C',
    });
    s = reduce(s, { type: 'apply-clef-change', remove: true });
    expect(s.history.present).toBe(d);
    const pending = s;
    expect(reduce(s, { type: 'apply-clef-change', remove: true })).toBe(
      pending,
    );
    s = reduce(s, { type: 'confirm-clef-change', preserve: 'noteheads' });
    expect(s.history.present.neumes).toBe(d.neumes);
    expect(s.history.present.clefChanges.map((c) => c.id)).toEqual(['later']);
    expect(s.focusRequest).toEqual({ kind: 'palette', tool: 'select' });
  });
  it('cancel and final no-op preserve the exact redo branch and lyric draft', () => {
    const d = { ...fixture(), clefChanges: [change('C')] };
    let s = createEditorSession(d);
    s = reduce(s, { type: 'change-clef', clef: { type: 'f', staffLine: 2 } });
    s = reduce(s, { type: 'history', direction: 'undo', focusedNoteId: null });
    s = reduce(s, {
      type: 'lyrics',
      action: { type: 'start', neumeId: 'A' },
      newId: 'lyric',
    });
    s = reduce(s, {
      type: 'lyrics',
      action: { type: 'text', text: 'Ky' },
      newId: 'lyric',
    });
    const history = s.history,
      lyrics = s.lyrics;
    s = reduce(s, { type: 'start-clef-change', id: 'C' });
    s = reduce(s, {
      type: 'draft-clef-change',
      clef: { type: 'f', staffLine: 1 },
    });
    s = reduce(s, { type: 'clef-insertion-policy', preserve: 'noteheads' });
    s = reduce(s, { type: 'cancel-clef-change' });
    expect(s.history).toBe(history);
    expect(s.lyrics).toBe(lyrics);
    s = reduce(s, { type: 'start-clef-change', id: 'C' });
    s = reduce(s, {
      type: 'draft-clef-change',
      clef: { type: 'f', staffLine: 1 },
    });
    s = reduce(s, {
      type: 'draft-clef-change',
      clef: { type: 'c', staffLine: 4 },
    });
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.history).toBe(history);
    expect(s.clefTransaction).toBeNull();
  });
  it('retains redundant and trailing authored changes without a prompt', () => {
    let s = reduce(createEditorSession(fixture()), {
      type: 'start-clef-change',
      id: 'tail',
      boundary: { beforeNeumeId: null, beforeDivisionId: null },
    });
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.clefTransaction).toBeNull();
    expect(s.history.present.clefChanges[0].id).toBe('tail');
    expect(s.history.past).toHaveLength(1);
    s = reduce(s, start('redundant'));
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.clefTransaction).toBeNull();
    expect(s.history.past).toHaveLength(2);
  });
  it('restores keyboard invocation focus independently of the preceding selection', () => {
    const document = { ...fixture(), clefChanges: [change('C')] };
    let s = reduce(createEditorSession(document), {
      type: 'select',
      selection: { kind: 'note', noteId: 'note-A' },
    });
    s = reduce(s, { type: 'start-clef-change', id: 'C' });
    s = reduce(s, { type: 'cancel-clef-change' });
    expect(s.selection).toEqual({ kind: 'note', noteId: 'note-A' });
    expect(s.focusRequest).toEqual({ kind: 'clef-change', clefChangeId: 'C' });
  });
  it('rejects stale or unsafe candidates without partial mutation', () => {
    let s = reduce(createEditorSession(fixture()), start());
    const changed = {
      ...s,
      history: {
        ...s.history,
        present: { ...s.history.present, title: 'Concurrent' },
      },
    };
    expect(reduce(changed, { type: 'apply-clef-change' }).history).toBe(
      changed.history,
    );
    s = reduce(s, { type: 'cancel-clef-change' });
    const unsafe = fixture();
    unsafe.neumes[1] = {
      id: 'B',
      kind: 'punctum',
      notes: [
        { id: 'note-B', staffPosition: staffPosition(Number.MAX_SAFE_INTEGER) },
      ],
    };
    s = reduce(createEditorSession(unsafe), start());
    s = reduce(s, {
      type: 'draft-clef-change',
      clef: { type: 'c', staffLine: 4 },
    });
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.history.present).toBe(unsafe);
    expect(s.history.past).toHaveLength(0);
    expect(s.clefTransaction?.candidate).not.toBeNull();
    s = reduce(s, { type: 'confirm-clef-change', preserve: 'melody' });
    expect(s.history.present).toBe(unsafe);
    expect(s.history.past).toHaveLength(0);
    expect(s.announcement.text).toContain('overflow');
    s = reduce(s, { type: 'confirm-clef-change', preserve: 'noteheads' });
    expect(s.history.present.neumes).toBe(unsafe.neumes);
    expect(s.history.present.clefChanges).toHaveLength(1);
    expect(s.history.past).toHaveLength(1);
  });
});

describe('shared pitch mode for existing-clef edits', () => {
  it.each(['melody', 'noteheads'] as const)(
    'applies a final type/line draft immediately under %s with scoped exact history',
    (preserve) => {
      const d = {
        ...fixture(),
        clefChanges: [
          change('C'),
          change('later', 'E', null, { type: 'f', staffLine: 3 }),
        ],
      };
      let s = reduce(createEditorSession(d), {
        type: 'start-clef-change',
        id: 'C',
      });
      const history = s.history;
      for (const clef of [
        { type: 'c', staffLine: 1 },
        { type: 'f', staffLine: 2 },
      ] satisfies Clef[]) {
        s = reduce(s, { type: 'draft-clef-change', clef });
        expect(s.history).toBe(history);
      }
      s = reduce(s, { type: 'clef-insertion-policy', preserve });
      expect(s.history).toBe(history);
      s = reduce(s, { type: 'apply-clef-change' });
      expect(s.clefTransaction).toBeNull();
      expect(s.history.past).toEqual([d]);
      expect(s.history.present.neumes[0]).toBe(d.neumes[0]);
      expect(s.history.present.neumes[2]).toBe(d.neumes[2]);
      expect(s.history.present.neumes[1].notes[0].staffPosition).toBe(
        preserve === 'melody' ? -5 : 2,
      );
      expect(s.history.present.clefChanges[0].clef).toEqual({
        type: 'f',
        staffLine: 2,
      });
      const committed = s.history.present;
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
  it('keeps an overflowing draft pending, supports mode switch or revision, and never falls back', () => {
    const d = {
      ...fixture(),
      clefChanges: [change('C', 'B', null, { type: 'c', staffLine: 3 })],
    };
    d.neumes[1] = {
      id: 'B',
      kind: 'punctum',
      notes: [
        { id: 'note-B', staffPosition: staffPosition(Number.MAX_SAFE_INTEGER) },
      ],
    };
    let s = reduce(createEditorSession(d), {
      type: 'start-clef-change',
      id: 'C',
    });
    s = reduce(s, {
      type: 'draft-clef-change',
      clef: { type: 'c', staffLine: 4 },
    });
    const history = s.history;
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.history).toBe(history);
    expect(s.clefTransaction?.candidate).toBeNull();
    expect(s.clefTransaction?.policyError).toContain('overflow');
    expect(s.clefInsertionPolicy).toBe('melody');
    const failed = s;
    s = reduce(s, {
      type: 'draft-clef-change',
      clef: { type: 'c', staffLine: 2 },
    });
    expect(s.clefTransaction?.policyError).toBeUndefined();
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.clefTransaction).toBeNull();
    expect(s.history.present.neumes[1].notes[0].staffPosition).toBe(
      Number.MAX_SAFE_INTEGER - 2,
    );
    s = reduce(failed, {
      type: 'clef-insertion-policy',
      preserve: 'noteheads',
    });
    expect(s.clefTransaction?.policyError).toBeUndefined();
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.clefTransaction).toBeNull();
    expect(s.history.present.neumes).toBe(d.neumes);
    expect(s.history.past).toHaveLength(1);
  });
  it('shares one option across insertion → edit → insertion and keeps cancellation/no-op outside history', () => {
    let s = reduce(createEditorSession(fixture()), {
      type: 'arm',
      tool: { kind: 'place-clef', clefType: 'f' },
    });
    s = reduce(s, { type: 'clef-insertion-policy', preserve: 'noteheads' });
    s = reduce(s, {
      type: 'place-clef',
      clefType: 'f',
      id: 'C',
      point: { x: 180, y: 52 },
    });
    s = reduce(s, { type: 'select-tool' });
    s = reduce(s, { type: 'start-clef-change', id: 'C' });
    s = reduce(s, {
      type: 'draft-clef-change',
      clef: { type: 'f', staffLine: 2 },
    });
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.clefInsertionPolicy).toBe('noteheads');
    expect(s.clefTransaction).toBeNull();
    s = reduce(s, { type: 'start-clef-change', id: 'C' });
    const history = s.history;
    s = reduce(s, { type: 'clef-insertion-policy', preserve: 'melody' });
    s = reduce(s, {
      type: 'draft-clef-change',
      clef: { type: 'c', staffLine: 1 },
    });
    s = reduce(s, { type: 'cancel-clef-change' });
    expect(s.history).toBe(history);
    expect(s.clefInsertionPolicy).toBe('melody');
    s = reduce(s, { type: 'start-clef-change', id: 'C' });
    s = reduce(s, { type: 'apply-clef-change' });
    expect(s.history).toBe(history);
    s = reduce(s, { type: 'arm', tool: { kind: 'place-clef', clefType: 'c' } });
    expect(s.clefInsertionPolicy).toBe('melody');
    s = reduce(s, {
      type: 'place-clef',
      clefType: 'c',
      id: 'tail',
      point: { x: 650, y: 76 },
    });
    expect(s.clefTransaction).toBeNull();
    expect(s.history.past).toHaveLength(3);
  });
});

describe('in-score authored-clef arrow drafts', () => {
  it.each(['melody', 'noteheads'] as const)(
    'moves on the first press, continues through bounds, and applies once under %s',
    (preserve) => {
      const d = {
        ...fixture(),
        clefChanges: [
          change('C', 'B', null, { type: 'c', staffLine: 3 }),
          change('later', 'E'),
        ],
      };
      let s = reduce(createEditorSession(d), {
        type: 'clef-insertion-policy',
        preserve,
      });
      const history = s.history;
      s = reduce(s, { type: 'step-clef-change', id: 'C', direction: 1 });
      expect(s.clefTransaction?.clef.staffLine).toBe(4);
      expect(s.clefTransaction?.keepScoreFocus).toBe(true);
      expect(s.history).toBe(history);
      expect(
        reduce(s, { type: 'step-clef-change', id: 'C', direction: 1 }),
      ).toBe(s);
      for (const staffLine of [3, 2, 1]) {
        s = reduce(s, { type: 'step-clef-change', id: 'C', direction: -1 });
        expect(s.clefTransaction?.clef.staffLine).toBe(staffLine);
        expect(s.history).toBe(history);
      }
      expect(
        reduce(s, { type: 'step-clef-change', id: 'C', direction: -1 }),
      ).toBe(s);
      s = reduce(s, { type: 'apply-clef-change' });
      expect(s.clefTransaction).toBeNull();
      expect(s.history.past).toEqual([d]);
      expect(s.history.present.clefChanges[0].clef.staffLine).toBe(1);
      expect(s.history.present.clefChanges[0].beforeNeumeId).toBe('B');
      expect(s.history.present.neumes[1].notes[0].staffPosition).toBe(
        preserve === 'melody' ? -2 : 2,
      );
      expect(s.history.present.neumes[2]).toBe(d.neumes[2]);
      const committed = s.history.present;
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
    },
  );
  it('cancels an arrow sequence with exact redo/draft preservation and restores target focus', () => {
    const d = { ...fixture(), clefChanges: [change('C')] };
    let s = createEditorSession(d);
    s = reduce(s, { type: 'change-clef', clef: { type: 'f', staffLine: 2 } });
    s = reduce(s, { type: 'history', direction: 'undo', focusedNoteId: null });
    s = reduce(s, {
      type: 'lyrics',
      action: { type: 'start', neumeId: 'A' },
      newId: 'lyric',
    });
    s = reduce(s, {
      type: 'lyrics',
      action: { type: 'text', text: 'Ky' },
      newId: 'lyric',
    });
    const history = s.history,
      lyrics = s.lyrics;
    s = reduce(s, { type: 'step-clef-change', id: 'C', direction: -1 });
    s = reduce(s, { type: 'step-clef-change', id: 'C', direction: -1 });
    s = reduce(s, { type: 'cancel-clef-change' });
    expect(s.history).toBe(history);
    expect(s.lyrics).toBe(lyrics);
    expect(s.focusRequest).toEqual({ kind: 'clef-change', clefChangeId: 'C' });
  });
  it('rejects outward first presses, missing/stale/competing targets, placement and pending deletion', () => {
    const d = { ...fixture(), clefChanges: [change('C')] };
    const s = createEditorSession(d);
    expect(reduce(s, { type: 'step-clef-change', id: 'C', direction: 1 })).toBe(
      s,
    );
    expect(
      reduce(s, { type: 'step-clef-change', id: 'gone', direction: -1 }),
    ).toBe(s);
    const armed = reduce(s, {
      type: 'arm',
      tool: { kind: 'place-clef', clefType: 'f' },
    });
    expect(
      reduce(armed, { type: 'step-clef-change', id: 'C', direction: -1 }),
    ).toBe(armed);
    let pending = reduce(s, { type: 'start-clef-change', id: 'C' });
    expect(
      reduce(pending, { type: 'step-clef-change', id: 'other', direction: -1 }),
    ).toBe(pending);
    const stale = {
      ...pending,
      history: { ...pending.history, present: { ...d, title: 'New' } },
    };
    expect(
      reduce(stale, { type: 'step-clef-change', id: 'C', direction: -1 }),
    ).toBe(stale);
    pending = reduce(pending, { type: 'apply-clef-change', remove: true });
    expect(
      reduce(pending, { type: 'step-clef-change', id: 'C', direction: -1 }),
    ).toBe(pending);
  });
});

it('keeps arrow changes uncommitted until the final Apply reflows complete neumes', () => {
  const d = {
    ...fixture(),
    neumes: Array.from({ length: 25 }, (_, i) => punctum(`n${i}`, -2)),
    clefChanges: [change('C', 'n1', null, { type: 'c', staffLine: 3 })],
    divisions: [{ id: 'D', kind: 'minima' as const, beforeNeumeId: 'n1' }],
  };
  let s = reduce(createEditorSession(d), {
    type: 'clef-insertion-policy',
    preserve: 'noteheads',
  });
  s = reduce(s, { type: 'step-clef-change', id: 'C', direction: 1 });
  expect(
    layoutChant(s.history.present).systems.map(
      (system) => system.startNeumeIndex,
    ),
  ).toEqual([0, 10, 21]);
  s = reduce(s, { type: 'apply-clef-change' });
  expect(
    layoutChant(s.history.present).systems.map(
      (system) => system.startNeumeIndex,
    ),
  ).toEqual([0, 9, 20]);
  expect(s.history.past).toEqual([d]);
  expect(s.focusRequest).toEqual({ kind: 'clef-change', clefChangeId: 'C' });
});

it('creates no history when an arrow draft returns to its committed line', () => {
  const d = {
    ...fixture(),
    clefChanges: [change('C', 'B', null, { type: 'c', staffLine: 3 })],
  };
  let s = createEditorSession(d);
  const history = s.history;
  s = reduce(s, { type: 'step-clef-change', id: 'C', direction: 1 });
  s = reduce(s, { type: 'step-clef-change', id: 'C', direction: -1 });
  s = reduce(s, { type: 'apply-clef-change' });
  expect(s.history).toBe(history);
  expect(s.clefTransaction).toBeNull();
  expect(s.focusRequest).toEqual({ kind: 'clef-change', clefChangeId: 'C' });
});
