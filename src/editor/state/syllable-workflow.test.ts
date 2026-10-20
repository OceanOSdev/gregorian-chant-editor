import { expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { updateLyricSyllableText } from '../commands/update-lyric-syllable';
import { createEditorSession, reduceEditorSession } from './editor-session';
import { selectNote } from './selection';

const document: ChantDocument = {
  title: 'Lyrics',
  clef: { type: 'c', staffLine: 3 },
  syllables: [{ id: 's1', text: 'Ky' }],
  neumes: [
    {
      id: 'n1',
      kind: 'punctum',
      lyricSyllableId: 's1',
      notes: [{ id: 'note1', staffPosition: staffPosition(2) }],
    },
  ],
};
it('adds typed text in one operation without overwriting, targets it, and reconciles undo/redo', () => {
  const initial = createEditorSession(document);
  const added = reduceEditorSession(initial, {
    type: 'add-syllable',
    syllable: { id: 's2', text: 'ri' },
  });
  expect(added.history.present.syllables).toEqual([
    { id: 's1', text: 'Ky' },
    { id: 's2', text: 'ri' },
  ]);
  expect(added.activeSyllableId).toBe('s2');
  expect(added.history.past).toHaveLength(1);
  const undone = reduceEditorSession(added, {
    type: 'history',
    direction: 'undo',
    focusedNoteId: null,
  });
  expect(undone.history.present).toBe(document);
  expect(undone.activeSyllableId).toBe('s1');
  const redone = reduceEditorSession(undone, {
    type: 'history',
    direction: 'redo',
    focusedNoteId: null,
  });
  expect(redone.history.present).toBe(added.history.present);
  // History retains a surviving target rather than forcing the restored addition.
  expect(redone.activeSyllableId).toBe('s1');
});
it('selects and edits by stable ID, preserving notation and selection through history', () => {
  let state = createEditorSession(document);
  state = reduceEditorSession(state, { type: 'syllable', id: 's1' });
  expect(state.activeSyllableId).toBe('s1');
  state = reduceEditorSession(state, {
    type: 'select',
    selection: selectNote('note1'),
  });
  const selection = state.selection;
  state = reduceEditorSession(state, {
    type: 'edit',
    edit: (doc) => updateLyricSyllableText(doc, 's1', 'Kyr'),
  });
  expect(state.history.present.syllables).toEqual([{ id: 's1', text: 'Kyr' }]);
  expect(state.history.present.neumes).toBe(document.neumes);
  expect(state.selection).toBe(selection);
  expect(state.history.past).toHaveLength(1);
  state = reduceEditorSession(state, {
    type: 'history',
    direction: 'undo',
    focusedNoteId: null,
  });
  expect(state.history.present).toBe(document);
  state = reduceEditorSession(state, {
    type: 'history',
    direction: 'redo',
    focusedNoteId: null,
  });
  expect(state.history.present.syllables[0]).toEqual({ id: 's1', text: 'Kyr' });
  expect(state.history.present.neumes).toBe(document.neumes);
  const unchanged = reduceEditorSession(state, {
    type: 'edit',
    edit: (doc) => updateLyricSyllableText(doc, 's1', 'Kyr'),
  });
  expect(unchanged).toBe(state);
});
