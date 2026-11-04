import { describe, expect, it } from 'vitest';
import { exampleDocument } from '../domain/example-document';
import {
  createEditorSession,
  getSelectFocusRequest,
  reduceEditorSession,
  type EditorSession,
} from './editor-session';
import { reconcileSelection } from './selection';

describe('clef editing session', () => {
  it('selects the singleton without an ID and preserves it through history', () => {
    const initial = createEditorSession(exampleDocument);
    const selected = reduceEditorSession(initial, {
      type: 'select',
      selection: { kind: 'clef' },
    });
    expect(getSelectFocusRequest(selected)).toEqual({ kind: 'clef' });
    expect(reconcileSelection(exampleDocument, selected.selection)).toBe(
      selected.selection,
    );
    const changed = reduceEditorSession(selected, {
      type: 'change-clef',
      clef: { type: 'f', staffLine: 3 },
    });
    expect(changed.selection).toBe(selected.selection);
    expect(changed.history.past).toHaveLength(1);
    const undo = reduceEditorSession(changed, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(undo.history.present).toBe(exampleDocument);
    expect(undo.selection).toBe(selected.selection);
    expect(
      reduceEditorSession(undo, {
        type: 'history',
        direction: 'redo',
        focusedNoteId: null,
      }).history.present,
    ).toBe(changed.history.present);
  });
  it('preserves dirty lyric drafts, selection, active tools and remembered kinds', () => {
    const initial = createEditorSession(exampleDocument);
    const armed = reduceEditorSession(initial, {
      type: 'arm',
      tool: { kind: 'place-porrectus' },
    });
    const division = reduceEditorSession(armed, {
      type: 'arm',
      tool: { kind: 'place-division', divisionKind: 'minor' },
    });
    const draft: EditorSession = {
      ...division,
      lyrics: {
        kind: 'draft',
        neumeId: 'neume-torculus-1',
        text: 'Ky',
        boundaryBefore: 'word',
        original: null,
      },
    };
    const next = reduceEditorSession(draft, {
      type: 'change-clef',
      clef: { type: 'c', staffLine: 4 },
    });
    expect(next.lyrics).toBe(draft.lyrics);
    expect(next.activeTool).toBe(draft.activeTool);
    expect(next.rememberedKind).toBe('porrectus');
    expect(next.selection).toBe(draft.selection);
    expect(next.history.past).toHaveLength(1);
    expect(next.announcement.text).toContain('Melody preserved');
    expect(
      reduceEditorSession(next, {
        type: 'change-clef',
        clef: next.history.present.clef,
      }),
    ).toBe(next);
  });
  it('ignores selection on clefs during placement and clears selection normally', () => {
    const state = reduceEditorSession(createEditorSession(exampleDocument), {
      type: 'arm',
      tool: { kind: 'place-punctum' },
    });
    expect(
      reduceEditorSession(state, {
        type: 'select',
        selection: { kind: 'clef' },
      }),
    ).toBe(state);
    const selected = reduceEditorSession(createEditorSession(exampleDocument), {
      type: 'select',
      selection: { kind: 'clef' },
    });
    expect(
      reduceEditorSession(selected, {
        type: 'select',
        selection: { kind: 'none' },
      }).selection.kind,
    ).toBe('none');
  });
  it('blocks clef changes during pending history and lyric reassignment', () => {
    const base = createEditorSession(exampleDocument);
    const pending: EditorSession = {
      ...base,
      pendingHistory: { direction: 'undo', focusedNoteId: null },
    };
    const moving: EditorSession = {
      ...base,
      lyricMove: {
        syllableId: 'syllable-alle',
        candidateId: 'neume-torculus-1',
        previousLyrics: null,
        previousSelection: base.selection,
      },
    };
    for (const state of [pending, moving])
      expect(
        reduceEditorSession(state, {
          type: 'change-clef',
          clef: { type: 'f', staffLine: 3 },
        }),
      ).toBe(state);
  });
});
