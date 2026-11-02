import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { deleteNeume } from '../commands/delete-neume';
import { reassignLyricSyllable } from '../commands/reassign-lyric-syllable';
import {
  createEditorSession,
  lyricMoveTargets,
  reduceEditorSession,
  type EditorSession,
  type LyricMoveAction,
} from './editor-session';
import type { LyricAction } from './lyric-entry';

function fixture(): ChantDocument {
  return {
    title: 'Move',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: 9 }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: staffPosition(2) }],
    })),
    syllables: [1, 4, 7].map((n, i) => ({
      id: `s${i}`,
      text: ['Ky', 'ri', 'e'][i],
      startsAtNeumeId: `n${n}`,
      boundaryBefore: i === 0 ? 'word' : 'continuation',
    })),
  };
}
const move = (state: EditorSession, action: LyricMoveAction) =>
  reduceEditorSession(state, { type: 'lyric-move', action });
const start = (state = createEditorSession(fixture()), syllableId = 's1') =>
  move(state, { type: 'start', syllableId, newId: 'new' });
const lyric = (state: EditorSession, action: LyricAction) =>
  reduceEditorSession(state, { type: 'lyrics', action, newId: 'new' });
const history = (state: EditorSession, direction: 'undo' | 'redo') =>
  reduceEditorSession(state, {
    type: 'history',
    direction,
    focusedNoteId: null,
  });

describe('temporary lyric anchor correction', () => {
  it.each(['n2', 'n3', 'n5', 'n6'])(
    'moves a middle anchor to %s with one exact undo/redo step',
    (neumeId) => {
      const doc = fixture();
      const state = move(start(createEditorSession(doc)), {
        type: 'commit',
        neumeId,
      });
      expect(state.history.past).toEqual([doc]);
      expect(state.history.present.neumes).toBe(doc.neumes);
      expect(state.history.present.syllables[0]).toBe(doc.syllables[0]);
      expect(state.history.present.syllables[2]).toBe(doc.syllables[2]);
      expect(state.history.present.syllables[1]).toEqual({
        ...doc.syllables[1],
        startsAtNeumeId: neumeId,
      });
      expect(state.selection).toEqual({ kind: 'syllable', syllableId: 's1' });
      expect(state.focusRequest).toEqual({ kind: 'lyric', syllableId: 's1' });
      expect(state.lyricMove).toBeNull();
      const undone = history(state, 'undo');
      expect(undone.history.present).toBe(doc);
      expect(history(undone, 'redo').history.present).toBe(
        state.history.present,
      );
    },
  );
  it.each([
    ['s0', 'n0'],
    ['s2', 'n8'],
  ])('permits edge movement for %s', (syllableId, neumeId) => {
    const state = move(start(createEditorSession(fixture()), syllableId), {
      type: 'commit',
      neumeId,
    });
    expect(
      state.history.present.syllables.find((s) => s.id === syllableId)
        ?.startsAtNeumeId,
    ).toBe(neumeId);
  });
  it.each(['n0', 'n1', 'n4', 'n7', 'n8', 'missing'])(
    'rejects %s without history and remains recoverable',
    (neumeId) => {
      const state = start();
      const rejected = move(state, { type: 'commit', neumeId });
      expect(rejected.history).toBe(state.history);
      expect(rejected.lyricMove).toBe(state.lyricMove);
      expect(rejected.announcement.text).toMatch(/Choose|choose/);
      expect(reassignLyricSyllable(state.history.present, 's1', neumeId)).toBe(
        state.history.present,
      );
      expect(
        move(rejected, { type: 'commit', neumeId: 'n3' }).history.past,
      ).toHaveLength(1);
    },
  );
  it('browses legal candidates without selecting or editing and cancels to previous context', () => {
    const initial = lyric(createEditorSession(fixture()), {
      type: 'edit',
      syllableId: 's1',
    });
    const state = start(initial);
    expect(lyricMoveTargets(state.history.present, 's1')).toEqual([
      'n2',
      'n3',
      'n5',
      'n6',
    ]);
    const previous = move(state, { type: 'browse', direction: -1 });
    expect(previous.lyricMove?.candidateId).toBe('n3');
    expect(previous.selection).toBe(state.selection);
    expect(previous.history).toBe(state.history);
    const next = move(previous, { type: 'browse', direction: 1 });
    expect(next.lyricMove?.candidateId).toBe('n5');
    const canceled = move(next, { type: 'cancel' });
    expect(canceled.history).toBe(initial.history);
    expect(canceled.lyrics).toEqual({ kind: 'selected', syllableId: 's1' });
    expect(
      move(previous, { type: 'commit' }).history.present.syllables[1]
        .startsAtNeumeId,
    ).toBe('n3');
  });
  it.each(['ri', '', 'ré'])(
    'resolves existing edit %j before activation',
    (text) => {
      let state = lyric(createEditorSession(fixture()), {
        type: 'edit',
        syllableId: 's1',
      });
      state = lyric(state, { type: 'text', text });
      const moving = start(state);
      expect(moving.lyricMove).not.toBeNull();
      expect(moving.history.past).toHaveLength(text === 'ré' ? 1 : 0);
      expect(moving.history.present.syllables[1].text).toBe(
        text === 'ré' ? 'ré' : 'ri',
      );
      const done = move(moving, { type: 'commit', neumeId: 'n3' });
      expect(done.history.past).toHaveLength(text === 'ré' ? 2 : 1);
    },
  );
  it('commits new text separately, and empty insertion creates no history', () => {
    for (const text of ['', 'new']) {
      let state = lyric(createEditorSession(fixture()), {
        type: 'start',
        neumeId: 'n2',
      });
      state = lyric(state, { type: 'text', text });
      const moving = start(state);
      expect(moving.lyricMove).not.toBeNull();
      expect(moving.history.past).toHaveLength(text ? 1 : 0);
      expect(move(moving, { type: 'cancel' }).history).toBe(moving.history);
    }
  });
  it('blocks invalid, stale and recovery drafts without losing text', () => {
    let state = lyric(createEditorSession(fixture()), {
      type: 'edit',
      syllableId: 's1',
    });
    state = lyric(state, { type: 'text', text: 'two words' });
    expect(start(state).lyricMove).toBeNull();
    expect(start(state).lyrics).toBe(state.lyrics);
    state = lyric(state, { type: 'text', text: 'dirty' });
    // A stale external document is checked even before normal reconciliation.
    const stale = {
      ...state,
      history: {
        ...state.history,
        present: deleteNeume(state.history.present, 'n4'),
      },
    };
    const rejected = start(stale, 's0');
    expect(rejected.lyricMove).toBeNull();
    expect(rejected.lyrics).toMatchObject({
      kind: 'recovery',
      draft: { text: 'dirty' },
    });
    expect(start(rejected, 's0').lyrics).toBe(rejected.lyrics);
    expect(rejected.history).toBe(stale.history);
  });
  it('rejects missing syllable IDs and blocks unrelated edits during movement', () => {
    const initial = createEditorSession(fixture());
    expect(start(initial, 'missing')).toBe(initial);
    expect(
      reassignLyricSyllable(initial.history.present, 'missing', 'n2'),
    ).toBe(initial.history.present);
    const moving = start(initial);
    expect(lyric(moving, { type: 'delete', syllableId: 's0' })).toBe(moving);
    expect(history(moving, 'undo')).toBe(moving);
  });
  it.each(['commit', 'cancel'] as const)(
    'keeps selection actions distinct from the resolved Lyrics target after %s',
    (type) => {
      let state = lyric(createEditorSession(fixture()), {
        type: 'select',
        syllableId: 's1',
      });
      state = reduceEditorSession(state, {
        type: 'start-lyrics-at-focus',
        target: { kind: 'syllable', syllableId: 's0' },
        newId: 'new',
      });
      expect(state.selection).toEqual({ kind: 'syllable', syllableId: 's1' });
      expect(state.lyrics).toMatchObject({
        kind: 'draft',
        original: { id: 's0' },
      });
      const precedingSelection = state.selection;
      const moving = start(state);
      const done = move(
        moving,
        type === 'commit' ? { type, neumeId: 'n3' } : { type },
      );
      expect(done.lyrics).toEqual({ kind: 'selected', syllableId: 's0' });
      expect(done.selection).toEqual(precedingSelection);
      expect(done.history.past).toHaveLength(type === 'commit' ? 1 : 0);
      const deleted = lyric(done, { type: 'delete', syllableId: 's1' });
      expect(deleted.history.present.syllables.map((s) => s.id)).toEqual([
        's0',
        's2',
      ]);
      expect(deleted.history.present.syllables[0].text).toBe('Ky');
      expect(deleted.history.present.neumes).toBe(state.history.present.neumes);
      // Focus-based deletion still uses its explicit focused ID, independently.
      expect(
        lyric(done, {
          type: 'delete',
          syllableId: 's2',
        }).history.present.syllables.map((s) => s.id),
      ).toEqual(['s0', 's1']);
      expect(
        lyric(done, { type: 'edit', syllableId: 's1' }).lyrics,
      ).toMatchObject({ kind: 'draft', original: { id: 's1' } });
    },
  );
  it.each([
    { kind: 'none' } as const,
    { kind: 'note', noteId: 'note6' } as const,
    { kind: 'neume', neumeId: 'n6' } as const,
    { kind: 'syllable', syllableId: 's2' } as const,
  ])('restores preceding semantic selection $kind on cancel', (selection) => {
    let state = lyric(createEditorSession(fixture()), {
      type: 'edit',
      syllableId: 's0',
    });
    state = reduceEditorSession(state, { type: 'select', selection });
    const canceled = move(start(state, 's0'), { type: 'cancel' });
    expect(canceled.selection).toBe(selection);
    expect(canceled.lyrics).toEqual({ kind: 'selected', syllableId: 's0' });
    expect(canceled.history).toBe(state.history);
    expect(
      move(start(state, 's0'), { type: 'commit', neumeId: 'n0' }).selection,
    ).toEqual({ kind: 'syllable', syllableId: 's0' });
  });
  it.each([[], [0], [4], [8], [0, 1], [1, 2, 3], [0, 4, 8], [1, 4, 7]])(
    'derived targets agree with authoritative command for anchors %j',
    (...anchors) => {
      const doc = fixture();
      doc.syllables = anchors.map((n, i) => ({
        id: `s${i}`,
        text: 'test',
        startsAtNeumeId: `n${n}`,
        boundaryBefore: i === 0 ? 'word' : 'continuation',
      }));
      for (const id of [...doc.syllables.map((s) => s.id), 'missing']) {
        const before = doc.syllables;
        expect(lyricMoveTargets(doc, id)).toEqual(
          doc.neumes
            .filter((n) => reassignLyricSyllable(doc, id, n.id) !== doc)
            .map((n) => n.id),
        );
        expect(doc.syllables).toBe(before);
      }
    },
  );
});
