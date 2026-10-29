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

it('keeps replacement typing distinct from selecting original text', () => {
  const doc = anchored();
  const editing = act(createEditorSession(doc), {
    type: 'edit',
    syllableId: 'existing',
  });
  expect(editing.focusRequest).toEqual({ kind: 'lyrics', selectText: true });
  const selected = act(editing, { type: 'save' });
  const replaced = act(selected, {
    type: 'edit',
    syllableId: 'existing',
    replacement: 'l',
  });
  expect(replaced.focusRequest).toEqual({ kind: 'lyrics', selectText: false });
  expect(replaced.lyrics).toMatchObject({ kind: 'draft', text: 'l' });
  expect(replaced.history.present).toBe(doc);
});
