import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import type { MusicalClipboard } from '../commands/musical-passage-clipboard';
import { pasteIdCount } from '../commands/musical-passage-clipboard';
import {
  allocatePasteIds,
  getClipboardShortcut,
} from '../interaction/clipboard-shortcuts';
import { encodeDocument } from '../persistence/native-document';
import {
  clipboardBlocked,
  createEditorSession,
  reduceEditorSession,
  type EditorAction,
  type EditorSession,
} from './editor-session';
import { placePunctumTool } from './editor-tool';

const document: ChantDocument = {
  title: 'Session clipboard',
  lyricLanguage: 'la',
  clef: { type: 'c', staffLine: 3 },
  accidentals: [],
  divisions: [],
  clefChanges: [],
  syllables: [
    { id: 's0', text: 'Ky', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    {
      id: 's2',
      text: 'ri',
      startsAtNeumeId: 'n2',
      boundaryBefore: 'continuation',
    },
  ],
  neumes: Array.from({ length: 4 }, (_, i): Neume => ({
    id: `n${i}`,
    kind: 'clivis',
    notes: [
      { id: `a${i}`, staffPosition: staffPosition(6) },
      { id: `b${i}`, staffPosition: staffPosition(4) },
    ],
  })),
};

let serial = 0;
const ids = () => () => `id-${++serial}`;
function required(clipboard: MusicalClipboard | null): MusicalClipboard {
  if (!clipboard) throw Error('Expected a clipboard');
  return clipboard;
}
const run = (state: EditorSession, ...actions: EditorAction[]) =>
  actions.reduce(reduceEditorSession, state);
const paste = (state: EditorSession): EditorAction => ({
  type: 'paste-passage',
  ids: allocatePasteIds(state.clipboard, ids()),
});
const selectRange = (anchor: string, endpoint: string): EditorAction => ({
  type: 'select',
  selection: {
    kind: 'neume-range',
    anchorNeumeId: anchor,
    endpointNeumeId: endpoint,
  },
});

function copied(selection = selectRange('n2', 'n1')) {
  return run(createEditorSession(document), selection, {
    type: 'copy-passage',
  });
}

describe('session clipboard', () => {
  it('copy changes only the clipboard and announcement', () => {
    const start = run(createEditorSession(document), selectRange('n2', 'n1'));
    const next = reduceEditorSession(start, { type: 'copy-passage' });
    expect(next.clipboard?.neumeCount).toBe(2);
    expect(next.history).toBe(start.history);
    expect(next.selection).toBe(start.selection);
    expect(next.focusRequest).toBe(start.focusRequest);
    expect(next.announcement.text).toBe('Copied 2 neumes.');
    expect(encodeDocument(next.history.present)).toBe(encodeDocument(document));
  });

  it('a rejected copy keeps the previous clipboard; a new copy replaces it', () => {
    const state = copied();
    const clip = state.clipboard;
    for (const selection of [
      { kind: 'note', noteId: 'a0' },
      { kind: 'none' },
      { kind: 'syllable', syllableId: 's0' },
    ] as const) {
      const next = run(
        state,
        { type: 'select', selection },
        {
          type: 'copy-passage',
        },
      );
      expect(next.clipboard).toBe(clip);
      expect(next.announcement.text).toMatch(/^Nothing copied/);
    }
    const replaced = run(
      state,
      { type: 'select', selection: { kind: 'neume', neumeId: 'n3' } },
      { type: 'copy-passage' },
    );
    expect(replaced.clipboard?.neumeCount).toBe(1);
  });

  it('pastes atomically after the range end, selects and focuses the pasted passage, and repeats', () => {
    const state = copied();
    const once = reduceEditorSession(state, paste(state));
    expect(once.history.past).toHaveLength(1);
    expect(once.history.past[0]).toBe(document);
    const neumes = once.history.present.neumes.map((n) => n.id);
    expect(neumes.slice(0, 3)).toEqual(['n0', 'n1', 'n2']);
    expect(neumes.at(-1)).toBe('n3');
    const [first, last] = neumes.slice(3, 5);
    expect(once.selection).toEqual({
      kind: 'neume-range',
      anchorNeumeId: first,
      endpointNeumeId: last,
    });
    expect(once.focusRequest).toEqual({
      kind: 'note',
      noteId: once.history.present.neumes[4].notes[0].id,
    });
    expect(once.announcement.text).toBe('Pasted 2 neumes.');
    expect(once.clipboard).toBe(state.clipboard);
    // Lyric anchors and text unchanged in the actual encoded bytes.
    expect(
      JSON.parse(encodeDocument(once.history.present)).document.syllables,
    ).toEqual(JSON.parse(encodeDocument(document)).document.syllables);

    const twice = reduceEditorSession(once, paste(once));
    const after = twice.history.present.neumes.map((n) => n.id);
    expect(after.slice(0, 5)).toEqual(neumes.slice(0, 5));
    expect(after).toHaveLength(8);
    expect(new Set(after).size).toBe(8);
    expect(twice.history.past).toHaveLength(2);

    // Undo removes the whole insertion; missing endpoints clear selection.
    const undone = reduceEditorSession(twice, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(undone.history.present).toBe(once.history.present);
    expect(undone.selection).toEqual({ kind: 'none' });
    const redone = reduceEditorSession(undone, {
      type: 'history',
      direction: 'redo',
      focusedNoteId: null,
    });
    expect(redone.history.present).toBe(twice.history.present);
    expect(redone.selection).toEqual({ kind: 'none' });
    expect(redone.clipboard).toBe(state.clipboard);
  });

  it('pastes a single neume as a whole-neume selection, after a note or at the end', () => {
    const state = copied({
      type: 'select',
      selection: { kind: 'neume', neumeId: 'n1' },
    });
    const afterNote = run(
      state,
      { type: 'select', selection: { kind: 'note', noteId: 'b0' } },
      paste(state),
    );
    const id = afterNote.history.present.neumes[1].id;
    expect(afterNote.selection).toEqual({ kind: 'neume', neumeId: id });
    const atEnd = run(
      state,
      { type: 'select', selection: { kind: 'none' } },
      paste(state),
    );
    expect(atEnd.history.present.neumes.at(-1)?.id).toBe(
      atEnd.selection.kind === 'neume' ? atEnd.selection.neumeId : null,
    );
    expect(atEnd.announcement.text).toBe('Pasted 1 neume.');
  });

  it('a rejected paste leaves document, history, redo, selection, focus and clipboard intact', () => {
    const base = run(copied(), {
      type: 'select',
      selection: { kind: 'neume', neumeId: 'n0' },
    });
    // Build a redo branch first.
    const edited = reduceEditorSession(base, paste(base));
    const undone = reduceEditorSession(edited, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    const invalid = run(undone, {
      type: 'select',
      selection: { kind: 'syllable', syllableId: 's0' },
    });
    for (const action of [
      paste(invalid),
      { type: 'paste-passage', ids: [] } as EditorAction,
      {
        type: 'paste-passage',
        ids: Array.from(
          { length: pasteIdCount(required(invalid.clipboard)) },
          () => 'n0',
        ),
      } as EditorAction,
    ]) {
      const next = reduceEditorSession(invalid, action);
      expect(next.history).toBe(invalid.history);
      expect(next.history.future).toHaveLength(1);
      expect(next.selection).toBe(invalid.selection);
      expect(next.focusRequest).toBe(invalid.focusRequest);
      expect(next.clipboard).toBe(invalid.clipboard);
      expect(next.announcement.text).toMatch(/^Cannot paste/);
    }
    const empty = reduceEditorSession(createEditorSession(document), {
      type: 'paste-passage',
      ids: [],
    });
    expect(empty.announcement.text).toBe(
      'Nothing to paste. Copy a whole neume or passage first.',
    );
  });

  it('survives document replacement as a new session but is never persisted', () => {
    const state = copied();
    const replaced = createEditorSession(
      { ...document, neumes: [], syllables: [], title: 'Other' },
      state.clipboard,
    );
    expect(replaced.clipboard).toBe(state.clipboard);
    const pasted = reduceEditorSession(replaced, paste(replaced));
    expect(pasted.history.present.neumes).toHaveLength(2);
    expect(encodeDocument(pasted.history.present)).not.toMatch(/clipboard/i);
    expect(createEditorSession(document).clipboard).toBeNull();
  });

  it('is blocked in every exclusive mode without changing mode, selection or clipboard', () => {
    const state = run(copied(), {
      type: 'select',
      selection: { kind: 'neume', neumeId: 'n0' },
    });
    const modes: EditorSession[] = [
      run(state, { type: 'arm', tool: placePunctumTool() }),
      { ...state, lyrics: { kind: 'ready', neumeId: 'n0' } },
      {
        ...state,
        lyricMove: {
          syllableId: 's2',
          candidateId: 'n3',
          previousLyrics: null,
          previousSelection: state.selection,
        },
      },
      {
        ...state,
        pendingHistory: { direction: 'undo', focusedNoteId: null },
      },
      {
        ...state,
        clefTransaction: {
          original: document,
          previousSelection: state.selection,
          id: 'c',
          boundary: null,
          clef: { type: 'c', staffLine: 3 },
          candidate: null,
        },
      },
      { ...state, accidentalTargetId: 'x' },
    ];
    for (const mode of modes) {
      expect(clipboardBlocked(mode)).toBe(true);
      for (const action of [{ type: 'copy-passage' }, paste(mode)] as const) {
        const next = reduceEditorSession(mode, action);
        expect(next.history).toBe(mode.history);
        expect(next.selection).toBe(mode.selection);
        expect(next.clipboard).toBe(mode.clipboard);
        expect(next.lyrics).toBe(mode.lyrics);
        expect(next.lyricMove).toBe(mode.lyricMove);
        expect(next.activeTool).toBe(mode.activeTool);
        expect(next.clefTransaction).toBe(mode.clefTransaction);
        expect(next.accidentalTargetId).toBe(mode.accidentalTargetId);
      }
    }
    expect(clipboardBlocked(state)).toBe(false);
  });
});

describe('clipboard shortcuts', () => {
  const key = (k: string, extra = {}) => ({
    key: k,
    ctrlKey: true,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    defaultPrevented: false,
    ...extra,
  });
  it('claims only plain Ctrl/Cmd+C/V in notation scope without a text selection', () => {
    expect(getClipboardShortcut(key('c'), true, false)).toBe('copy');
    expect(getClipboardShortcut(key('V'), true, false)).toBe('paste');
    expect(
      getClipboardShortcut(
        key('v', { ctrlKey: false, metaKey: true }),
        true,
        false,
      ),
    ).toBe('paste');
    expect(getClipboardShortcut(key('c'), true, true)).toBeNull();
    expect(getClipboardShortcut(key('v'), true, true)).toBe('paste');
    for (const extra of [
      { ctrlKey: false },
      { altKey: true },
      { shiftKey: true },
      { isComposing: true },
      { defaultPrevented: true },
    ])
      expect(getClipboardShortcut(key('c', extra), true, false)).toBeNull();
    expect(getClipboardShortcut(key('c'), false, false)).toBeNull();
    expect(getClipboardShortcut(key('x'), true, false)).toBeNull();
  });
  it('allocates exactly the IDs a paste consumes', () => {
    const state = copied();
    expect(allocatePasteIds(state.clipboard, ids())).toHaveLength(
      pasteIdCount(required(state.clipboard)),
    );
    expect(allocatePasteIds(null)).toEqual([]);
  });
});
