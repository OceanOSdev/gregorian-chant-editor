import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { deleteNeume } from '../commands/delete-neume';
import { createLyricSyllable } from '../commands/create-lyric-syllable';
import { updateLyricSyllableText } from '../commands/update-lyric-syllable';
import {
  createEditorSession,
  reduceEditorSession,
  type EditorSession,
} from './editor-session';
import { type LyricAction } from './lyric-entry';
import { hasValidLyricAnchors } from '../domain/lyrics';

function fixture(count = 6): ChantDocument {
  return {
    title: 'Lyrics',
    clef: { type: 'c', staffLine: 3 },
    syllables: [],
    neumes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: staffPosition(2) }],
    })),
  };
}
function act(
  state: EditorSession,
  action: LyricAction,
  newId = `s${state.history.present.syllables.length}`,
): EditorSession {
  return reduceEditorSession(state, { type: 'lyrics', action, newId });
}
function start(doc = fixture(), neumeId = 'n0') {
  return act(createEditorSession(doc), { type: 'start', neumeId });
}
function text(state: EditorSession, value: string) {
  return act(state, { type: 'text', text: value });
}
function history(state: EditorSession, direction: 'undo' | 'redo') {
  return reduceEditorSession(state, {
    type: 'history',
    direction,
    focusedNoteId: null,
  });
}
function anchored() {
  const doc = fixture();
  doc.syllables = [
    {
      id: 'existing',
      text: 'le',
      startsAtNeumeId: 'n2',
      boundaryBefore: 'word',
    },
  ];
  return doc;
}

describe('continuous lyric entry', () => {
  it('enters several syllables with word boundaries and underscore skipping atomically', () => {
    const doc = fixture();
    let state = start(doc);
    state = act(text(state, 'Al'), { type: 'advance', key: '-' });
    expect(state.lyrics).toMatchObject({
      kind: 'draft',
      neumeId: 'n1',
      boundaryBefore: 'continuation',
    });
    const past = state.history.past;
    state = act(state, { type: 'advance', key: '_' });
    expect(state.history.past).toBe(past);
    expect(state.lyrics).toMatchObject({
      kind: 'draft',
      neumeId: 'n2',
      boundaryBefore: 'continuation',
    });
    state = act(text(state, 'le'), { type: 'advance', key: ' ' });
    state = act(text(state, 'lu'), { type: 'save' });
    expect(
      state.history.present.syllables.map((s) => [
        s.text,
        s.startsAtNeumeId,
        s.boundaryBefore,
      ]),
    ).toEqual([
      ['Al', 'n0', 'word'],
      ['le', 'n2', 'continuation'],
      ['lu', 'n3', 'word'],
    ]);
    expect(state.history.past).toHaveLength(3);
    expect(state.history.present.neumes).toBe(doc.neumes);
    expect(state.lyrics?.kind).toBe('selected');
    expect(hasValidLyricAnchors(state.history.present)).toBe(true);
  });
  it('commits and skips the following neume with underscore after text', () => {
    const state = act(text(start(), 'Al'), { type: 'advance', key: '_' });
    expect(state.lyrics).toMatchObject({
      kind: 'draft',
      neumeId: 'n2',
      boundaryBefore: 'continuation',
    });
    expect(state.history.present.syllables[0].startsAtNeumeId).toBe('n0');
  });
  it('commits valid navigation and resets arbitrary targets to a word start', () => {
    let state = act(text(start(), 'Al'), { type: 'navigate', neumeId: 'n4' });
    expect(state.history.past).toHaveLength(1);
    expect(state.lyrics).toMatchObject({
      neumeId: 'n4',
      boundaryBefore: 'word',
    });
    const before = state;
    state = act(state, { type: 'navigate', neumeId: 'n4' });
    expect(state.history).toBe(before.history);
    state = act(state, { type: 'navigate', neumeId: 'n3' });
    expect(state.history).toBe(before.history);
  });
  it.each(['two words', 'Al-', '_', ' '])(
    'blocks invalid navigation without losing %j',
    (value) => {
      const state = text(start(), value);
      const next = act(state, { type: 'navigate', neumeId: 'n2' });
      expect(next.history).toBe(state.history);
      expect(next.lyrics).toBe(state.lyrics);
      expect(next.announcement.text).toContain('one syllable');
      expect(act(state, { type: 'done' }).lyrics).toBe(state.lyrics);
      expect(act(state, { type: 'advance', key: '_' }).history).toBe(
        state.history,
      );
    },
  );
  it('keeps text transient until committed, and Escape preserves earlier commits', () => {
    let state = act(text(start(), 'Al'), { type: 'advance', key: '-' });
    const committed = state.history;
    state = text(state, 'draft');
    expect(state.history).toBe(committed);
    expect(act(state, { type: 'cancel' }).history).toBe(committed);
    expect(act(state, { type: 'cancel' }).lyrics).toBeNull();
  });
  it('changes pending boundaries without placeholders or navigation on empty delimiters', () => {
    let state = start();
    for (const key of ['-', '-', ' ', ' '] as const)
      state = act(state, { type: 'advance', key });
    expect(state.history.past).toHaveLength(0);
    expect(state.lyrics).toMatchObject({
      neumeId: 'n0',
      text: '',
      boundaryBefore: 'word',
    });
    expect(act(state, { type: 'save' }).history).toBe(state.history);
    expect(act(state, { type: 'done' }).lyrics).toBeNull();
  });
  it('pauses at occupied anchors and never implicitly replaces them', () => {
    const doc = anchored();
    let state = act(text(start(doc, 'n1'), 'Al'), {
      type: 'advance',
      key: '-',
    });
    expect(state.lyrics).toEqual({ kind: 'occupied', syllableId: 'existing' });
    const committed = state.history;
    for (const action of [
      { type: 'text', text: 'overwrite' },
      { type: 'advance', key: '-' },
      { type: 'advance', key: ' ' },
    ] as const) {
      const next = act(state, action);
      expect(next.history).toBe(committed);
      expect(next.history.present.syllables[1]).toBe(doc.syllables[0]);
    }
    state = act(state, { type: 'advance', key: '_' });
    expect(state.lyrics).toMatchObject({
      neumeId: 'n3',
      boundaryBefore: 'word',
    });
    expect(state.history).toBe(committed);
  });
  it('edits only on explicit intent and preserves identity and unchanged history', () => {
    const doc = anchored();
    let state = act(createEditorSession(doc), {
      type: 'edit',
      syllableId: 'existing',
    });
    expect(state.lyrics).toMatchObject({
      kind: 'draft',
      text: 'le',
      original: doc.syllables[0],
    });
    expect(act(state, { type: 'save' }).history).toBe(state.history);
    state = act(text(state, 'lé'), {
      type: 'boundary',
      boundaryBefore: 'word',
    });
    state = act(state, { type: 'save' });
    expect(state.history.present.syllables[0]).toEqual({
      ...doc.syllables[0],
      text: 'lé',
    });
    expect(state.history.past).toHaveLength(1);
    expect(state.selection).toEqual({
      kind: 'syllable',
      syllableId: 'existing',
    });
    state = act(state, { type: 'advance', key: '-' });
    expect(state.lyrics).toMatchObject({
      neumeId: 'n3',
      boundaryBefore: 'continuation',
    });
  });
  it('preserves cleared existing lyrics on deliberate navigation with an announcement', () => {
    const doc = anchored();
    let state = act(createEditorSession(doc), {
      type: 'edit',
      syllableId: 'existing',
    });
    state = act(text(state, ''), { type: 'navigate', neumeId: 'n4' });
    expect(state.history.present).toBe(doc);
    expect(state.lyrics).toMatchObject({ neumeId: 'n4' });
    expect(state.announcement.text).toContain(
      'original syllable was preserved',
    );
  });
  it('rechecks stale insertion targets and preserves dirty text for recovery', () => {
    const state = text(start(), 'draft');
    const next = reduceEditorSession(state, {
      type: 'edit',
      edit: (doc) =>
        createLyricSyllable(doc, {
          id: 'occupied',
          text: 'other',
          startsAtNeumeId: 'n0',
          boundaryBefore: 'word',
        }),
    });
    expect(next.lyrics).toMatchObject({
      kind: 'recovery',
      draft: { text: 'draft' },
    });
    expect(act(next, { type: 'save' }).history).toBe(next.history);
    expect(act(next, { type: 'retry', neumeId: 'n0' }).lyrics?.kind).toBe(
      'recovery',
    );
    const recovered = act(next, { type: 'retry', neumeId: 'n3' });
    expect(recovered.lyrics).toMatchObject({
      kind: 'draft',
      original: null,
      text: 'draft',
      neumeId: 'n3',
    });
    expect(
      act(
        recovered,
        { type: 'save' },
        'recovered',
      ).history.present.syllables.map((s) => s.text),
    ).toEqual(['other', 'draft']);
  });
  it('retains a dirty draft after target deletion or external text changes', () => {
    let state = text(start(), 'draft');
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (doc) => deleteNeume(doc, 'n0'),
    });
    expect(state.lyrics).toMatchObject({
      kind: 'recovery',
      draft: { text: 'draft' },
    });
    expect(act(state, { type: 'discard' }).lyrics).toBeNull();
    state = act(createEditorSession(anchored()), {
      type: 'edit',
      syllableId: 'existing',
    });
    state = text(state, 'new');
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (doc) => updateLyricSyllableText(doc, 'existing', 'changed'),
    });
    expect(state.lyrics).toMatchObject({
      kind: 'recovery',
      draft: { text: 'new' },
    });
  });
  it('waits at the end and resumes at appended music with the pending boundary', () => {
    let state = act(text(start(fixture(1)), 'Al'), {
      type: 'advance',
      key: '-',
    });
    expect(state.lyrics).toMatchObject({
      kind: 'end',
      boundaryBefore: 'continuation',
    });
    state = reduceEditorSession(state, {
      type: 'insert',
      ids: { neumeId: 'appended', noteIds: ['a', 'b', 'c'] },
    });
    expect(state.lyrics).toMatchObject({
      kind: 'draft',
      neumeId: 'appended',
      boundaryBefore: 'continuation',
    });
    expect(state.focusRequest).toEqual({ kind: 'lyrics' });
    expect(state.history.present.syllables).toHaveLength(1);
  });
  it('preserves a requested skip beyond the end until enough music exists', () => {
    let state = act(text(start(fixture(1)), 'Al'), {
      type: 'advance',
      key: '_',
    });
    state = reduceEditorSession(state, {
      type: 'insert',
      ids: { neumeId: 'skip', noteIds: ['a', 'b', 'c'] },
    });
    expect(state.lyrics?.kind).toBe('end');
    state = reduceEditorSession(state, {
      type: 'insert',
      ids: { neumeId: 'target', noteIds: ['d', 'e', 'f'] },
    });
    expect(state.lyrics).toMatchObject({
      neumeId: 'target',
      boundaryBefore: 'continuation',
    });
  });
  it('commits a valid draft before changing tools and blocks invalid ones', () => {
    const action = {
      type: 'arm',
      tool: { kind: 'place-podatus' },
      lyricCommitId: 'tool-commit',
    } as const;
    const state = reduceEditorSession(text(start(), 'Al'), action);
    expect(state.lyrics).toBeNull();
    expect(state.history.present.syllables[0].id).toBe('tool-commit');
    expect(state.activeTool.kind).toBe('place-podatus');
    expect(
      reduceEditorSession(text(start(), 'two words'), action).activeTool.kind,
    ).toBe('select');
  });
  it('deletes selected lyrics without deleting music', () => {
    const doc = anchored();
    let state = act(start(doc, 'n2'), { type: 'delete' });
    expect(state.history.present.syllables).toEqual([]);
    expect(state.history.present.neumes).toBe(doc.neumes);
    state = history(state, 'undo');
    expect(state.history.present).toBe(doc);
  });
});

describe('lyric draft history resolution', () => {
  it('prompts before history and supports cancel, discard and save atomically', () => {
    let state = act(text(start(), 'Al'), { type: 'advance', key: '-' });
    state = text(state, 'le');
    const before = state;
    state = history(state, 'undo');
    expect(state.history).toBe(before.history);
    expect(state.pendingHistory?.direction).toBe('undo');
    const canceled = reduceEditorSession(state, {
      type: 'resolve-history',
      choice: 'cancel',
      newId: 's1',
    });
    expect(canceled.lyrics).toBe(before.lyrics);
    expect(canceled.history).toBe(before.history);
    const discarded = reduceEditorSession(state, {
      type: 'resolve-history',
      choice: 'discard',
      newId: 's1',
    });
    expect(discarded.history.present.syllables).toEqual([]);
    const saved = reduceEditorSession(state, {
      type: 'resolve-history',
      choice: 'save',
      newId: 's1',
    });
    expect(saved.history.present.syllables.map((s) => s.text)).toEqual(['Al']);
    expect(saved.history.future[0].syllables.map((s) => s.text)).toEqual([
      'Al',
      'le',
    ]);
    expect(
      history(saved, 'redo').history.present.syllables.map((s) => s.text),
    ).toEqual(['Al', 'le']);
  });
  it('keeps invalid drafts when Save before history fails', () => {
    const state = history(text(start(), 'two words'), 'undo');
    const next = reduceEditorSession(state, {
      type: 'resolve-history',
      choice: 'save',
      newId: 's',
    });
    expect(next.pendingHistory).not.toBeNull();
    expect(next.lyrics).toBe(state.lyrics);
    expect(next.history).toBe(state.history);
  });
});

it('keeps existing-text editing distinct from replacement typing', () => {
  const doc = anchored();
  const editing = act(createEditorSession(doc), {
    type: 'edit',
    syllableId: 'existing',
  });
  expect(editing.focusRequest).toEqual({ kind: 'lyrics' });
  const selected = act(editing, { type: 'save' });
  const replaced = act(selected, {
    type: 'edit',
    syllableId: 'existing',
    replacement: 'l',
  });
  expect(replaced.focusRequest).toEqual({ kind: 'lyrics' });
  expect(replaced.lyrics).toMatchObject({ kind: 'draft', text: 'l' });
  expect(replaced.history.present).toBe(doc);
});

describe('syllable selection and deletion refinement', () => {
  it.each([false, true])(
    'selects without editing and preserves Lyrics mode=%s',
    (active) => {
      const doc = anchored();
      const initial = active ? start(doc, 'n0') : createEditorSession(doc);
      const selected = act(initial, { type: 'select', syllableId: 'existing' });
      expect(selected.selection).toEqual({
        kind: 'syllable',
        syllableId: 'existing',
      });
      expect(selected.lyrics).toEqual(
        active ? { kind: 'selected', syllableId: 'existing' } : null,
      );
      expect(selected.focusRequest).toEqual({
        kind: 'lyric',
        syllableId: 'existing',
      });
      expect(selected.history).toBe(initial.history);
      const deleted = act(selected, { type: 'delete' });
      expect(deleted.history.present.neumes).toBe(doc.neumes);
      expect(deleted.history.present.syllables).toEqual([]);
      expect(deleted.selection).toEqual({ kind: 'neume', neumeId: 'n2' });
      expect(deleted.focusRequest).toEqual({ kind: 'note', noteId: 'note2' });
      expect(deleted.lyrics).toEqual(
        active ? { kind: 'ready', neumeId: 'n2' } : null,
      );
      expect(deleted.history.past).toHaveLength(1);
      expect(history(deleted, 'undo').history.present).toBe(doc);
      expect(history(history(deleted, 'undo'), 'redo').history.present).toBe(
        deleted.history.present,
      );
      if (active)
        expect(
          act(deleted, { type: 'start', neumeId: 'n2' }).lyrics,
        ).toMatchObject({ kind: 'draft', neumeId: 'n2' });
    },
  );
  it('commits a valid draft before selecting another syllable and blocks invalid selection', () => {
    const doc = anchored();
    const committed = act(text(start(doc), 'Al'), {
      type: 'select',
      syllableId: 'existing',
    });
    expect(committed.history.present.syllables.map((s) => s.text)).toEqual([
      'Al',
      'le',
    ]);
    expect(committed.lyrics).toEqual({
      kind: 'selected',
      syllableId: 'existing',
    });
    const invalid = text(start(doc), 'two words');
    const blocked = act(invalid, { type: 'select', syllableId: 'existing' });
    expect(blocked.history).toBe(invalid.history);
    expect(blocked.lyrics).toBe(invalid.lyrics);
  });
  it('starts editing or replacement from an inactive selected syllable without changing music', () => {
    const selected = act(createEditorSession(anchored()), {
      type: 'select',
      syllableId: 'existing',
    });
    expect(
      act(selected, { type: 'edit', syllableId: 'existing' }).lyrics,
    ).toMatchObject({ kind: 'draft', text: 'le' });
    const replaced = act(selected, {
      type: 'edit',
      syllableId: 'existing',
      replacement: 'N',
    });
    expect(replaced.lyrics).toMatchObject({ kind: 'draft', text: 'N' });
    expect(replaced.history).toBe(selected.history);
  });
});

describe('delimiter entry from selection outside Lyrics mode', () => {
  it.each([
    ['-', 'continuation', 'n3'],
    [' ', 'word', 'n3'],
    ['_', 'continuation', 'n4'],
  ] as const)(
    'starts %s entry without editing the selected lyric',
    (key, boundaryBefore, neumeId) => {
      const selected = act(createEditorSession(anchored()), {
        type: 'select',
        syllableId: 'existing',
      });
      expect(selected.lyrics).toBeNull();
      const next = act(selected, { type: 'advance', key });
      expect(next.lyrics).toMatchObject({
        kind: 'draft',
        neumeId,
        boundaryBefore,
        text: '',
        original: null,
      });
      expect(next.history).toBe(selected.history);
      expect(next.history.present.syllables[0].text).toBe('le');
      expect(next.history.present.neumes).toBe(selected.history.present.neumes);
    },
  );
  it('pauses at the next occupied anchor without overwriting its content', () => {
    const doc = anchored();
    doc.syllables.push({
      id: 'next',
      text: 'lu',
      startsAtNeumeId: 'n3',
      boundaryBefore: 'word',
    });
    const selected = act(createEditorSession(doc), {
      type: 'select',
      syllableId: 'existing',
    });
    const next = act(selected, { type: 'advance', key: '-' });
    expect(next.lyrics).toEqual({ kind: 'occupied', syllableId: 'next' });
    expect(next.history).toBe(selected.history);
    expect(act(next, { type: 'text', text: 'overwrite' }).history.present).toBe(
      doc,
    );
  });
  it('keeps Lyrics active at the end rather than changing music', () => {
    const doc = anchored();
    doc.syllables[0] = { ...doc.syllables[0], startsAtNeumeId: 'n5' };
    const selected = act(createEditorSession(doc), {
      type: 'select',
      syllableId: 'existing',
    });
    const next = act(selected, { type: 'advance', key: '-' });
    expect(next.lyrics).toMatchObject({
      kind: 'end',
      boundaryBefore: 'continuation',
    });
    expect(next.history).toBe(selected.history);
  });
});

describe('deletion of a focused engraved syllable', () => {
  it.each([false, true])(
    'deletes without selecting and preserves Lyrics mode=%s',
    (active) => {
      const doc = anchored();
      const initial = active ? start(doc, 'n0') : createEditorSession(doc);
      const deleted = act(initial, { type: 'delete', syllableId: 'existing' });
      expect(deleted.history.present.neumes).toBe(doc.neumes);
      expect(deleted.history.present.syllables).toEqual([]);
      expect(deleted.selection).toEqual({ kind: 'neume', neumeId: 'n2' });
      expect(deleted.focusRequest).toEqual({ kind: 'note', noteId: 'note2' });
      expect(deleted.lyrics).toEqual(
        active ? { kind: 'ready', neumeId: 'n2' } : null,
      );
      expect(history(deleted, 'undo').history.present).toBe(doc);
      expect(history(history(deleted, 'undo'), 'redo').history.present).toBe(
        deleted.history.present,
      );
    },
  );
  it('deletes the focused target rather than a different selected syllable', () => {
    const doc = anchored();
    doc.syllables.push({
      id: 'focused',
      text: 'lu',
      startsAtNeumeId: 'n4',
      boundaryBefore: 'word',
    });
    const selected = act(createEditorSession(doc), {
      type: 'select',
      syllableId: 'existing',
    });
    const deleted = act(selected, { type: 'delete', syllableId: 'focused' });
    expect(deleted.history.present.syllables).toEqual([doc.syllables[0]]);
    expect(deleted.history.present.neumes).toBe(doc.neumes);
    expect(deleted.focusRequest).toEqual({ kind: 'note', noteId: 'note4' });
  });
  it('resolves valid drafts before focused deletion and retains invalid drafts', () => {
    const doc = anchored();
    const committed = act(text(start(doc), 'Al'), {
      type: 'delete',
      syllableId: 'existing',
    });
    expect(committed.history.present.syllables.map((s) => s.text)).toEqual([
      'Al',
    ]);
    expect(committed.history.past).toHaveLength(1);
    expect(history(committed, 'undo').history.present).toBe(doc);
    const invalid = text(start(doc), 'two words');
    const blocked = act(invalid, { type: 'delete', syllableId: 'existing' });
    expect(blocked.history).toBe(invalid.history);
    expect(blocked.lyrics).toBe(invalid.lyrics);
  });
  it('ignores a stale focused ID', () => {
    const state = createEditorSession(anchored());
    expect(act(state, { type: 'delete', syllableId: 'missing' })).toBe(state);
  });
});

describe('L activation from focused score elements', () => {
  function twoLyrics(): ChantDocument {
    const doc = fixture();
    doc.syllables = [
      { id: 'al', text: 'Al', startsAtNeumeId: 'n1', boundaryBefore: 'word' },
      {
        id: 'le',
        text: 'le',
        startsAtNeumeId: 'n4',
        boundaryBefore: 'continuation',
      },
    ];
    return doc;
  }
  it.each([null, 'al', 'le'])(
    'targets focused le while preserving selection %s and protecting text',
    (selectedId) => {
      const doc = twoLyrics();
      const initial = selectedId
        ? act(createEditorSession(doc), {
            type: 'select',
            syllableId: selectedId,
          })
        : createEditorSession(doc);
      const next = reduceEditorSession(initial, {
        type: 'start-lyrics-at-focus',
        target: { kind: 'syllable', syllableId: 'le' },
        newId: 'unused',
      });
      expect(next.lyrics).toMatchObject({
        kind: 'draft',
        neumeId: 'n4',
        text: 'le',
        original: { id: 'le' },
      });
      expect(next.selection).toBe(initial.selection);
      expect(next.history).toBe(initial.history);
      expect(next.focusRequest).toEqual({ kind: 'lyrics' });
      expect(act(next, { type: 'text', text: 'overwrite' }).history).toBe(
        initial.history,
      );
    },
  );
  it('opens an anchored focused note for editing without selecting it', () => {
    const initial = createEditorSession(twoLyrics());
    const next = reduceEditorSession(initial, {
      type: 'start-lyrics-at-focus',
      target: { kind: 'note', noteId: 'note4' },
      newId: 'unused',
    });
    expect(next.lyrics).toMatchObject({
      kind: 'draft',
      neumeId: 'n4',
      text: 'le',
      original: { id: 'le' },
    });
    expect(next.selection).toBe(initial.selection);
    expect(next.history).toBe(initial.history);
  });
  it('resolves a focused note rather than a different selection', () => {
    const initial = act(createEditorSession(twoLyrics()), {
      type: 'select',
      syllableId: 'al',
    });
    const next = reduceEditorSession(initial, {
      type: 'start-lyrics-at-focus',
      target: { kind: 'note', noteId: 'note3' },
      newId: 'unused',
    });
    expect(next.lyrics).toMatchObject({
      kind: 'draft',
      neumeId: 'n3',
      original: null,
      text: '',
    });
    expect(next.selection).toBe(initial.selection);
    expect(next.history).toBe(initial.history);
  });
  it('navigates an active workflow using the existing draft policy without implicit selection', () => {
    const initial = text(start(twoLyrics(), 'n0'), 'Ky');
    const next = reduceEditorSession(initial, {
      type: 'start-lyrics-at-focus',
      target: { kind: 'syllable', syllableId: 'le' },
      newId: 'ky',
    });
    expect(next.history.present.syllables.map((s) => s.text)).toEqual([
      'Ky',
      'Al',
      'le',
    ]);
    expect(next.history.past).toHaveLength(1);
    expect(next.lyrics).toMatchObject({
      kind: 'draft',
      neumeId: 'n4',
      text: 'le',
      original: { id: 'le' },
    });
    expect(next.selection).toBe(initial.selection);
    const invalid = text(start(twoLyrics(), 'n0'), 'two words');
    const blocked = reduceEditorSession(invalid, {
      type: 'start-lyrics-at-focus',
      target: { kind: 'syllable', syllableId: 'le' },
      newId: 'unused',
    });
    expect(blocked.lyrics).toBe(invalid.lyrics);
    expect(blocked.history).toBe(invalid.history);
    expect(blocked.selection).toBe(invalid.selection);
  });
  it('rejects missing focused IDs instead of falling back to selection or the first neume', () => {
    const initial = act(createEditorSession(twoLyrics()), {
      type: 'select',
      syllableId: 'al',
    });
    for (const target of [
      { kind: 'syllable', syllableId: 'gone' },
      { kind: 'note', noteId: 'gone' },
    ] as const)
      expect(
        reduceEditorSession(initial, {
          type: 'start-lyrics-at-focus',
          target,
          newId: 'unused',
        }),
      ).toBe(initial);
  });
});
