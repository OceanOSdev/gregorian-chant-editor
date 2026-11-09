import { describe, expect, it } from 'vitest';
import { change, fixture } from '../clef-change.test-cases';
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
    s = reduce(s, { type: 'cancel-clef-change' });
    expect(s.history).toBe(history);
    expect(s.lyrics).toBe(lyrics);
    s = reduce(s, { type: 'start-clef-change', id: 'C' });
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
