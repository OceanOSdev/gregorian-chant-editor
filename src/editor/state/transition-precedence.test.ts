import { describe, expect, it } from 'vitest';
import { deleteAccidental } from '../commands/update-accidental';
import { deleteNeume } from '../commands/delete-neume';
import {
  placeAccidental,
  updateAccidental,
} from '../commands/update-accidental';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import { applyDocumentEdit } from './document-history';
import {
  createEditorSession,
  reduceEditorSession as reduce,
  type EditorAction,
  type EditorSession,
} from './editor-session';

/*
 * Characterizes the order in which reduceEditorSession hands an action to its
 * owner: clipboard → passage selection → accidental placement → clef
 * transaction → lyric move → pending history → lyric entry → ordinary actions,
 * followed by cross-cutting document effects. Each test fails if an owner
 * moves earlier or later in that order.
 */

function punctum(id: string, position: number): Neume {
  return {
    id,
    kind: 'punctum',
    notes: [{ id: `${id}n`, staffPosition: staffPosition(position) }],
  };
}

function plain(): ChantDocument {
  return {
    accidentals: [],
    clefChanges: [],
    divisions: [],
    lyricLanguage: 'la',
    title: 'Precedence',
    clef: { type: 'c', staffLine: 4 },
    neumes: [punctum('f', 2), punctum('b', 5), punctum('next', 5)],
    syllables: [
      { id: 'sf', text: 'o', startsAtNeumeId: 'f', boundaryBefore: 'word' },
      {
        id: 'snext',
        text: 'ra',
        startsAtNeumeId: 'next',
        boundaryBefore: 'continuation',
      },
    ],
  };
}

/** A flat owned by the B note and explicitly placed above the earlier F. */
function placedFlat(): ChantDocument {
  return placeAccidental(
    updateAccidental(plain(), 'bn', 'flat', 'flat'),
    'flat',
    'fn',
  );
}

const startClef: EditorAction = {
  type: 'start-clef-change',
  id: 'C',
  boundary: { beforeNeumeId: 'next', beforeDivisionId: null },
};
const insert: EditorAction = {
  type: 'insert',
  ids: { neumeId: 'new', noteIds: ['newa', 'newb', 'newc'] },
};
const undo: EditorAction = {
  type: 'history',
  direction: 'undo',
  focusedNoteId: null,
};
const redo: EditorAction = { ...undo, direction: 'redo' };
const startMove: EditorAction = {
  type: 'lyric-move',
  action: { type: 'start', syllableId: 'snext', newId: 'moved' },
};
const startLyrics: EditorAction = {
  type: 'lyrics',
  action: { type: 'start', neumeId: 'b' },
  newId: 'lyric',
};
const retitle: EditorAction = {
  type: 'engraving-edit',
  edit: (d) => ({ ...d, title: 'Retitled' }),
};

/** A dirty lyric draft at the free neume after one earlier undoable edit. */
function dirtyDraft(): EditorSession {
  let s = reduce(createEditorSession(plain()), retitle);
  s = reduce(s, startLyrics);
  s = reduce(s, {
    type: 'lyrics',
    action: { type: 'text', text: 'ta' },
    newId: 'lyric',
  });
  expect(s.lyrics?.kind).toBe('draft');
  return s;
}

function acknowledge(state: EditorSession): EditorSession {
  if (!state.focusRequest) throw new Error('Expected a focus request.');
  const acknowledged = reduce(state, {
    type: 'focus-handled',
    request: state.focusRequest,
  });
  expect(acknowledged.focusRequest).toBeNull();
  // Only the exact pending request object is acknowledged.
  expect(
    reduce(state, {
      type: 'focus-handled',
      request: { ...state.focusRequest },
    }),
  ).toBe(state);
  return acknowledged;
}

describe('editor session transition precedence', () => {
  it('an accidental placement owns every action but clipboard feedback and focus acknowledgement', () => {
    const s = reduce(createEditorSession(placedFlat()), {
      type: 'start-accidental-placement',
      id: 'flat',
    });
    expect(s.accidentalTargetId).toBe('flat');
    const blocked: EditorAction[] = [
      startClef,
      { type: 'step-clef-change', id: 'C', direction: 1 },
      startMove,
      startLyrics,
      undo,
      insert,
      retitle,
      { type: 'select', selection: { kind: 'note', noteId: 'bn' } },
      { type: 'arm', tool: { kind: 'place-punctum' } },
      { type: 'extend-selection', noteId: 'nextn' },
      { type: 'delete-accidental', id: 'flat' },
      { type: 'start-accidental-placement', id: 'flat' },
    ];
    for (const action of blocked) expect(reduce(s, action)).toBe(s);
    const copied = reduce(s, { type: 'copy-passage' });
    expect(copied.clipboardFeedback).toMatch(/^Copy unavailable/);
    expect(copied.accidentalTargetId).toBe('flat');
    expect(copied.history).toBe(s.history);
    expect(acknowledge(s).accidentalTargetId).toBe('flat');
  });

  it('a clef transaction precedes lyric moves, history and lyric entry and keeps their state', () => {
    const draft = dirtyDraft();
    const s = reduce(draft, startClef);
    expect(s.clefTransaction?.id).toBe('C');
    expect(s.lyrics).toBe(draft.lyrics);
    const blocked: EditorAction[] = [
      startMove,
      startLyrics,
      undo,
      { type: 'resolve-history', choice: 'save', newId: 'x' },
      { type: 'start-accidental-placement', id: 'flat' },
      { type: 'start-clef-change', id: 'other' },
      { type: 'clef-keyboard', command: 'next' },
      insert,
      retitle,
      { type: 'select', selection: { kind: 'note', noteId: 'bn' } },
    ];
    for (const action of blocked) expect(reduce(s, action)).toBe(s);
    const policy = reduce(s, {
      type: 'clef-insertion-policy',
      preserve: 'noteheads',
    });
    expect(policy.clefInsertionPolicy).toBe('noteheads');
    expect(policy.clefTransaction?.id).toBe('C');
    const canceled = reduce(s, { type: 'cancel-clef-change' });
    expect(canceled.clefTransaction).toBeNull();
    expect(canceled.lyrics).toBe(draft.lyrics);
    expect(canceled.history).toBe(draft.history);
  });

  it('a clef transaction restores its context once the document is stale, and its actions need one', () => {
    const idle = createEditorSession(plain());
    for (const action of [
      { type: 'draft-clef-change', clef: { type: 'f', staffLine: 2 } },
      { type: 'apply-clef-change' },
      { type: 'confirm-clef-change', preserve: 'melody' },
      { type: 'cancel-clef-change' },
    ] satisfies EditorAction[])
      expect(reduce(idle, action)).toBe(idle);
    const s = reduce(idle, startClef);
    const stale = {
      ...s,
      history: applyDocumentEdit(s.history, (d) => ({ ...d, title: 'Other' })),
    };
    const restored = reduce(stale, { type: 'hover', point: null });
    expect(restored.clefTransaction).toBeNull();
    expect(restored.history).toBe(stale.history);
  });

  it('a lyric move precedes ordinary edits and is itself blocked by a pending history prompt', () => {
    const s = reduce(createEditorSession(placedFlat()), startMove);
    expect(s.lyricMove?.syllableId).toBe('snext');
    const blocked: EditorAction[] = [
      startLyrics,
      undo,
      startClef,
      { type: 'step-clef-change', id: 'C', direction: 1 },
      { type: 'start-accidental-placement', id: 'flat' },
      { type: 'delete-accidental', id: 'flat' },
      insert,
      retitle,
      { type: 'change-clef', clef: { type: 'f', staffLine: 3 } },
      { type: 'select', selection: { kind: 'note', noteId: 'bn' } },
      { type: 'arm', tool: { kind: 'place-punctum' } },
    ];
    for (const action of blocked) expect(reduce(s, action)).toBe(s);
    expect(
      reduce(s, { type: 'copy-passage' }).clipboardFeedback,
    ).not.toBeNull();
    acknowledge(s);
    const pending: EditorSession = {
      ...createEditorSession(plain()),
      pendingHistory: { direction: 'undo', focusedNoteId: null },
    };
    expect(reduce(pending, startMove)).toBe(pending);
  });

  it('a dirty lyric draft turns history into a prompt that owns every other action', () => {
    const draft = dirtyDraft();
    const p = reduce(draft, undo);
    expect(p.pendingHistory?.direction).toBe('undo');
    expect(p.history).toBe(draft.history);
    expect(p.lyrics).toBe(draft.lyrics);
    expect(p.focusRequest).toBeNull();
    const blocked: EditorAction[] = [
      redo,
      insert,
      retitle,
      startMove,
      startClef,
      { type: 'start-accidental-placement', id: 'flat' },
      { type: 'lyrics', action: { type: 'text', text: 'x' }, newId: 'x' },
      { type: 'select', selection: { kind: 'note', noteId: 'bn' } },
      { type: 'arm', tool: { kind: 'place-punctum' } },
    ];
    for (const action of blocked) expect(reduce(p, action)).toBe(p);
    acknowledge({ ...p, focusRequest: { kind: 'lyrics' } });

    const canceled = reduce(p, {
      type: 'resolve-history',
      choice: 'cancel',
      newId: 'x',
    });
    expect(canceled.pendingHistory).toBeNull();
    expect(canceled.lyrics).toBe(p.lyrics);
    expect(canceled.history).toBe(p.history);
    expect(canceled.focusRequest).toEqual({ kind: 'lyrics' });

    const discarded = reduce(p, {
      type: 'resolve-history',
      choice: 'discard',
      newId: 'x',
    });
    expect(discarded.lyrics).toBeNull();
    expect(discarded.pendingHistory).toBeNull();
    expect(discarded.history.present).toBe(p.history.past[0]);

    const saved = reduce(p, {
      type: 'resolve-history',
      choice: 'save',
      newId: 'saved',
    });
    // Save is its own edit, so Undo removes the saved syllable first.
    expect(saved.pendingHistory).toBeNull();
    expect(saved.lyrics).toBeNull();
    expect(saved.history.present).toBe(p.history.present);
    expect(saved.history.future[0].syllables.map((x) => x.id)).toContain(
      'saved',
    );
    expect(reduce(saved, redo).history.present).toBe(saved.history.future[0]);
  });

  it('a lyric draft is saved before arming or inserting, but kept when arming a clef', () => {
    const draft = dirtyDraft();
    const armed = reduce(draft, {
      type: 'arm',
      tool: { kind: 'place-punctum' },
      lyricCommitId: 'committed',
    });
    expect(armed.lyrics).toBeNull();
    expect(armed.activeTool).toEqual({ kind: 'place-punctum' });
    expect(armed.history.past).toHaveLength(draft.history.past.length + 1);
    expect(armed.history.present.syllables.map((s) => s.id)).toContain(
      'committed',
    );
    const clef = reduce(draft, {
      type: 'arm',
      tool: { kind: 'place-clef', clefType: 'c' },
    });
    expect(clef.lyrics).toBe(draft.lyrics);
    expect(clef.history).toBe(draft.history);
    expect(clef.activeTool).toEqual({ kind: 'place-clef', clefType: 'c' });
  });

  it('a passage selection rejects single-target insertion and lyric start before any mode owner', () => {
    const r = reduce(createEditorSession(plain()), {
      type: 'select',
      selection: {
        kind: 'neume-range',
        anchorNeumeId: 'f',
        endpointNeumeId: 'next',
      },
    });
    expect(r.selection.kind).toBe('neume-range');
    const inserted = reduce(r, insert);
    expect(inserted.history).toBe(r.history);
    expect(inserted.announcement.text).toBe(
      'Select one insertion target first.',
    );
    const lyric = reduce(r, startLyrics);
    expect(lyric.lyrics).toBeNull();
    expect(lyric.announcement.text).toBe('Select one lyric target first.');
  });
});

describe('cross-cutting effects after a mode transition', () => {
  it('restores orphaned accidental placements and clears a stale engraving error', () => {
    const s: EditorSession = {
      ...createEditorSession(placedFlat()),
      noteFormError: 'Earlier rejection.',
    };
    const edited = reduce(s, {
      type: 'edit',
      edit: (d) => deleteNeume(d, 'f'),
    });
    expect(edited.history.past).toHaveLength(1);
    expect(edited.history.present.accidentals[0].placement).toBeUndefined();
    expect(edited.announcement.text).toBe(
      '1 accidental placement restored to before the owning neume.',
    );
    expect(edited.noteFormError).toBeNull();
  });

  it('moves focus to the owning note when an edit removes the selected accidental', () => {
    const s = reduce(createEditorSession(placedFlat()), {
      type: 'select',
      selection: { kind: 'accidental', accidentalId: 'flat' },
    });
    const edited = reduce(s, {
      type: 'edit',
      edit: (d) => deleteAccidental(d, 'flat'),
    });
    expect(edited.selection).toEqual({ kind: 'none' });
    expect(edited.focusRequest).toEqual({ kind: 'note', noteId: 'bn' });
  });

  it('returns the exact session for a rejected edit and keeps clipboard feedback until selection moves', () => {
    const s = createEditorSession(plain());
    expect(reduce(s, { type: 'edit', edit: (d) => d })).toBe(s);
    const rejected = reduce(s, { type: 'copy-passage' });
    expect(rejected.clipboardFeedback).toMatch(/^Nothing copied/);
    const hovered = reduce(rejected, { type: 'hover', point: { x: 1, y: 1 } });
    expect(hovered.clipboardFeedback).toBe(rejected.clipboardFeedback);
    const selected = reduce(hovered, {
      type: 'select',
      selection: { kind: 'note', noteId: 'bn' },
    });
    expect(selected.clipboardFeedback).toBeNull();
  });
});
