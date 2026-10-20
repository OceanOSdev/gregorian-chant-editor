import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { updateLyricSyllableText } from '../commands/update-lyric-syllable';
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import type { InsertionIds } from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { layoutChant, type GraphicalNeumeKind } from '../layout/layout-chant';
import {
  createEditorSession,
  getSelectFocusRequest,
  reduceEditorSession,
  type EditorSession,
} from './editor-session';
import type { EditorTool } from './editor-tool';
import { selectNeume, selectNote } from './selection';

const kinds = [
  'punctum',
  'podatus',
  'clivis',
  'scandicus',
  'torculus',
  'climacus',
  'porrectus',
] as const;
const contours = [
  [2],
  [2, 3],
  [3, 2],
  [2, 3, 4],
  [2, 4, 3],
  [3, 2, 1],
  [3, 1, 2],
];
function document(): ChantDocument {
  return {
    title: 'Test',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 's1', text: 'Ky' },
      { id: 's2', text: 'ri' },
    ],
    neumes: [],
  };
}
function ids(index: number): InsertionIds {
  return {
    neumeId: `n${index}`,
    noteIds: [`a${index}`, `b${index}`, `c${index}`],
  };
}
function tool(kind: GraphicalNeumeKind): EditorTool {
  return { kind: `place-${kind}` };
}
function arm(kind: GraphicalNeumeKind = 'punctum', initial = document()) {
  let state = createEditorSession(initial);
  return reduceEditorSession(state, { type: 'arm', tool: tool(kind) });
}
function place(state: EditorSession, index = 1, point = { x: 300, y: 100 }) {
  const kind = getGraphicalNeumeKind(state.activeTool) ?? 'punctum';
  return reduceEditorSession(state, {
    type: 'place',
    kind,
    point,
    ids: ids(index),
  });
}

describe('placement lifecycle', () => {
  it.each(kinds)(
    'repeats %s using fresh document/layout and preserves insertion intent',
    (kind) => {
      let state = arm(kind);
      const initial = state.history.present;
      const messages = [];
      for (let i = 1; i <= 35; i++) {
        const previous = state;
        const intent = resolveGraphicalNeumePlacement(
          state.history.present,
          layoutChant(state.history.present),
          's1',
          kind,
          { x: 300, y: 100 },
        );
        expect(intent).not.toBeNull();
        state = place(state, i);
        expect(
          state.history.present.neumes[intent?.insertionIndex ?? -1]?.id,
        ).toBe(`n${i}`);
        expect(
          state.history.present.neumes
            .find((neume) => neume.id === `n${i}`)
            ?.notes.map((note) => note.staffPosition),
        ).toEqual(intent?.staffPositions);
        expect(state.history.past).toHaveLength(i);
        expect(state.history.present.neumes).toHaveLength(i);
        expect(state.activeTool).toBe(previous.activeTool);
        expect(state.focusRequest).toEqual({
          kind: 'placement',
          noteId: `a${i}`,
        });
        expect(state.hoveredPoint).toBeNull();
        expect(state.announcement.sequence).toBe(
          previous.announcement.sequence + 1,
        );
        messages.push(state.announcement.text);
      }
      expect(new Set(messages).size).toBe(1); // Equal text still represents distinct events.
      expect(layoutChant(state.history.present).systems.length).toBeGreaterThan(
        2,
      );
      const inserted = state.history.present;
      for (let i = 0; i < 35; i++)
        state = reduceEditorSession(state, {
          type: 'history',
          direction: 'undo',
          focusedNoteId: 'a35',
        });
      expect(state.history.present).toBe(initial);
      expect(state.selection.kind).toBe('none');
      expect(state.focusRequest).toBeNull();
      expect(state.activeTool.kind).toBe(`place-${kind}`);
      for (let i = 0; i < 35; i++)
        state = reduceEditorSession(state, {
          type: 'history',
          direction: 'redo',
          focusedNoteId: null,
        });
      expect(state.history.present).toBe(inserted);
      expect(state.rememberedKind).toBe(kind);
      state = reduceEditorSession(state, {
        type: 'history',
        direction: 'undo',
        focusedNoteId: null,
      });
      state = place(state, 100);
      expect(state.history.future).toHaveLength(0);
    },
  );

  it.each(kinds)(
    'contextually inserts remembered %s, selects its first note, and exits placement',
    (kind) => {
      const state = arm(kind);
      const next = reduceEditorSession(state, { type: 'insert', ids: ids(1) });
      expect(next.activeTool.kind).toBe('select');
      expect(next.rememberedKind).toBe(kind);
      expect(next.selection).toEqual(selectNote('a1'));
      expect(next.focusRequest).toEqual({ kind: 'note', noteId: 'a1' });
      expect(next.history.past).toHaveLength(1);
      expect(
        next.history.present.neumes[0]?.notes.map((note) => note.staffPosition),
      ).toEqual(contours[kinds.indexOf(kind)]);
      const repeated = reduceEditorSession(next, {
        type: 'insert',
        ids: ids(2),
      });
      expect(repeated.history.present.neumes[1]?.kind).toBe(kind);
      expect(repeated.history.past).toHaveLength(2);
    },
  );

  it('remembers activation across Select, focus browsing, selection, target changes, and history', () => {
    let state = createEditorSession(document());
    expect(state.rememberedKind).toBe('punctum');
    state = reduceEditorSession(state, { type: 'arm', tool: tool('podatus') });
    state = place(state);
    state = reduceEditorSession(state, { type: 'select-tool' });
    const original = state;
    state = reduceEditorSession(state, { type: 'focus-palette' });
    expect(state.focusRequest).toEqual({ kind: 'palette', tool: 'podatus' });
    expect(state.history).toBe(original.history);
    expect(state.selection).toBe(original.selection);
    expect(state.announcement).toBe(original.announcement);
    expect(state.activeTool.kind).toBe('select');
    state = reduceEditorSession(state, {
      type: 'select',
      selection: selectNeume('n1'),
    });
    state = reduceEditorSession(state, { type: 'syllable', id: 's2' });
    state = reduceEditorSession(state, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(state.rememberedKind).toBe('podatus');
    state = reduceEditorSession(state, { type: 'insert', ids: ids(2) });
    expect(state.history.present.neumes[0]?.kind).toBe('podatus');
    expect(state.history.present.neumes[0]?.lyricSyllableId).toBe('s2');
  });

  it('clears old preview on kind changes and rejects invalid points without history/events', () => {
    let state = arm('punctum');
    const history = state.history;
    state = reduceEditorSession(state, {
      type: 'hover',
      point: { x: 300, y: 100 },
    });
    expect(state.announcement.sequence).toBe(1);
    state = reduceEditorSession(state, { type: 'arm', tool: tool('podatus') });
    expect(state.hoveredPoint).toBeNull();
    for (const point of [
      { x: 0, y: 100 },
      { x: 300, y: -1 },
      { x: NaN, y: 100 },
      { x: 300, y: 230 },
    ]) {
      const next = place(state, 1, point);
      expect(next.history).toBe(history);
      expect(next.announcement).toBe(state.announcement);
      expect(next.activeTool).toBe(state.activeTool);
    }
    expect(
      reduceEditorSession(state, {
        type: 'place',
        kind: 'punctum',
        point: { x: 300, y: 100 },
        ids: ids(1),
      }),
    ).toBe(state);
    const none = createEditorSession({ ...document(), syllables: [] });
    expect(
      reduceEditorSession(none, { type: 'arm', tool: tool('punctum') })
        .activeTool.kind,
    ).toBe('place-punctum');
    expect(
      reduceEditorSession(none, {
        type: 'insert',
        ids: ids(1),
      }),
    ).toBe(none);
  });

  it('selects without an edit, remembers kind, and restores focus by stable ID', () => {
    const state = place(arm('punctum'));
    const next = reduceEditorSession(state, { type: 'select-tool' });
    expect(next.history).toBe(state.history);
    expect(next.rememberedKind).toBe('punctum');
    expect(next.selection).toEqual(state.selection);
    expect(next.focusRequest).toEqual({ kind: 'note', noteId: 'a1' });
    expect(next.announcement.text).toBe('Select tool.');
    expect(reduceEditorSession(next, { type: 'select-tool' })).toBe(next);
    expect(
      getSelectFocusRequest({ ...state, selection: selectNeume('n1') }),
    ).toEqual({ kind: 'note', noteId: 'a1' });
    expect(
      getSelectFocusRequest({ ...state, selection: selectNote('gone') }),
    ).toEqual({ kind: 'palette', tool: 'select' });
    expect(getSelectFocusRequest({ ...state, activeSyllableId: 's2' })).toEqual(
      { kind: 'palette', tool: 'select' },
    );
    expect(
      reduceEditorSession(next, {
        type: 'focus-handled',
        request: { kind: 'palette', tool: 'select' },
      }),
    ).toBe(next);
    if (next.focusRequest)
      expect(
        reduceEditorSession(next, {
          type: 'focus-handled',
          request: next.focusRequest,
        }).focusRequest,
      ).toBeNull();
  });

  it('retargets without disarming or selection-driven reversal, and uses actual target text', () => {
    let state = place(arm('punctum'));
    state = reduceEditorSession(state, { type: 'syllable', id: 's2' });
    expect(state.selection.kind).toBe('none');
    expect(state.announcement.text).toBe('Target: syllable 2, ri.');
    state = place(state, 2);
    expect(
      state.history.present.neumes.find((n) => n.id === 'n2')?.lyricSyllableId,
    ).toBe('s2');
    const before = state.announcement;
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (d) => updateLyricSyllableText(d, 's2', 'ri-'),
    });
    expect(state.announcement).toBe(before);
    state = reduceEditorSession(state, {
      type: 'add-syllable',
      syllable: { id: 's3', text: '' },
    });
    expect(state.announcement.text).toBe('Target: syllable 3, empty.');
    state = reduceEditorSession(state, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(state.activeSyllableId).toBe('s2');
    expect(state.announcement.text).toBe('Undo. Target: syllable 2, ri-.');
    expect(state.activeTool.kind).toBe('place-punctum');
  });

  it('ends placement and requests the visible control if history removes the only target', () => {
    let state = createEditorSession({ ...document(), syllables: [] });
    state = reduceEditorSession(state, {
      type: 'add-syllable',
      syllable: { id: 'only', text: '' },
    });
    state = reduceEditorSession(state, { type: 'arm', tool: tool('punctum') });
    state = reduceEditorSession(state, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(state.activeSyllableId).toBeNull();
    expect(state.activeTool.kind).toBe('select');
    expect(state.focusRequest).toEqual({ kind: 'palette', tool: 'select' });
    expect(state.announcement.text).toBe(
      'Undo. No target syllable. Select tool.',
    );
  });

  it('preserves note-only toolbar anchoring, reference pitches, and IDs of existing entities', () => {
    const initial = document();
    initial.neumes = [
      {
        id: 'existing1',
        kind: 'punctum',
        lyricSyllableId: 's1',
        notes: [{ id: 'old1', staffPosition: staffPosition(5) }],
      },
      {
        id: 'existing2',
        kind: 'punctum',
        lyricSyllableId: 's1',
        notes: [{ id: 'old2', staffPosition: staffPosition(1) }],
      },
    ];
    let start = arm('podatus', initial);
    start = reduceEditorSession(start, { type: 'select-tool' });
    const selected = reduceEditorSession(start, {
      type: 'select',
      selection: selectNote('old1'),
    });
    const middle = reduceEditorSession(selected, {
      type: 'insert',
      ids: ids(1),
    });
    expect(middle.history.present.neumes.map((n) => n.id)).toEqual([
      'existing1',
      'n1',
      'existing2',
    ]);
    expect(
      middle.history.present.neumes[1]?.notes.map((n) => n.staffPosition),
    ).toEqual([5, 6]);
    expect(middle.history.present.neumes[0]).toBe(initial.neumes[0]);
    const whole = reduceEditorSession(start, {
      type: 'select',
      selection: selectNeume('existing1'),
    });
    const appended = reduceEditorSession(whole, {
      type: 'insert',
      ids: ids(1),
    });
    expect(appended.history.present.neumes.map((n) => n.id)).toEqual([
      'existing1',
      'existing2',
      'n1',
    ]);
    expect(
      appended.history.present.neumes[2]?.notes.map((n) => n.staffPosition),
    ).toEqual([1, 2]);
  });
  it('re-resolves a same-position click after the latest document loses that system', () => {
    const initial = document();
    initial.neumes = Array.from({ length: 20 }, (_, i) => ({
      id: `old-${i}`,
      kind: 'punctum',
      lyricSyllableId: 's1',
      notes: [{ id: `old-note-${i}`, staffPosition: staffPosition(2) }],
    }));
    let state = arm('punctum', initial);
    const point = { x: 300, y: 344 };
    state = place(state, 1, point);
    expect(state.history.present.neumes).toHaveLength(21);
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (d) => ({ ...d, neumes: d.neumes.slice(0, 1) }),
    });
    const before = state;
    state = place(state, 2, point);
    expect(state).toBe(before);
    expect(state.history.present.neumes).toHaveLength(1);
  });

  it('is replay-safe with caller-supplied stable IDs and does not mutate prior state', () => {
    const state = arm('podatus');
    const action = {
      type: 'place',
      kind: 'podatus',
      point: { x: 300, y: 100 },
      ids: ids(1),
    } as const;
    const first = reduceEditorSession(state, action);
    const replay = reduceEditorSession(state, action);
    expect(replay).toEqual(first);
    expect(state.history.present.neumes).toEqual([]);
    expect(state.history.past).toEqual([]);
    expect(state.announcement.sequence).toBe(1);
  });
});
