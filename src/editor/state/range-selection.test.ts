import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import {
  extendSelection,
  stepSelection,
  resolveNeumeRange,
  reconcileSelection,
  resolveSelectionSyllableId,
  type EditorSelection,
} from './selection';
import {
  createEditorSession,
  reduceEditorSession,
  type EditorAction,
  type EditorSession,
} from './editor-session';
import { type LyricAction } from './lyric-entry';
import { resolveToolbarNeumeInsertion } from '../commands/resolve-toolbar-neume-insertion';
import { resolveEditorToolbarInsertion } from '../interaction/insert-editor-neume';
import { createLyricSyllable } from '../commands/create-lyric-syllable';

const document: ChantDocument = {
  title: 'Range',
  lyricLanguage: 'la',
  clef: { type: 'c', staffLine: 3 },
  accidentals: [],
  divisions: [],
  clefChanges: [],
  syllables: [],
  neumes: Array.from({ length: 5 }, (_, i) => ({
    id: `n${i}`,
    kind: 'podatus',
    notes: [
      { id: `a${i}`, staffPosition: staffPosition(2) },
      { id: `b${i}`, staffPosition: staffPosition(4) },
    ],
  })),
};
const range: EditorSelection = {
  kind: 'neume-range',
  anchorNeumeId: 'n3',
  endpointNeumeId: 'n1',
};
describe('contiguous musical selection', () => {
  it('promotes constituents and extends in canonical order with a directional anchor', () => {
    expect(extendSelection(document, { kind: 'none' }, 'b2')).toEqual({
      kind: 'neume',
      neumeId: 'n2',
    });
    expect(
      extendSelection(document, { kind: 'note', noteId: 'a2' }, 'b2'),
    ).toEqual({ kind: 'neume', neumeId: 'n2' });
    expect(
      extendSelection(document, { kind: 'division', divisionId: 'd' }, 'b2'),
    ).toEqual({ kind: 'neume', neumeId: 'n2' });
    expect([...(resolveNeumeRange(document, range)?.ids ?? [])]).toEqual([
      'n1',
      'n2',
      'n3',
    ]);
    expect(extendSelection(document, range, 'a4')).toEqual({
      ...range,
      endpointNeumeId: 'n4',
    });
    expect(extendSelection(document, range, 'b3')).toEqual({
      kind: 'neume',
      neumeId: 'n3',
    });
    expect(extendSelection(document, range, 'stale')).toBe(range);
    expect(resolveNeumeRange({ ...document, neumes: [] }, range)).toBeNull();
  });
  it('steps, contracts, collapses, reverses and clamps without redundant focus requests', () => {
    let selection: EditorSelection = { kind: 'note', noteId: 'b2' };
    const next = (direction: -1 | 1) => {
      const r = stepSelection(document, selection, 'b2', direction);
      if (r) selection = r.selection;
      return r;
    };
    expect(next(1)?.focusNoteId).toBe('a3');
    expect(next(-1)?.selection).toEqual({ kind: 'neume', neumeId: 'n2' });
    next(-1);
    next(-1);
    expect(resolveNeumeRange(document, selection)?.start).toBe(0);
    expect(next(-1)).toBeNull();
    expect(
      stepSelection(document, { kind: 'note', noteId: 'b4' }, 'b4', 1),
    ).toEqual({
      selection: { kind: 'neume', neumeId: 'n4' },
      focusNoteId: undefined,
    });
  });
  it('reconciles identity, interior changes, equal endpoints and missing endpoints', () => {
    expect(reconcileSelection(document, range)).toBe(range);
    expect(
      reconcileSelection(
        { ...document, neumes: document.neumes.filter((n) => n.id !== 'n2') },
        range,
      ),
    ).toBe(range);
    expect(
      reconcileSelection(
        { ...document, neumes: document.neumes.filter((n) => n.id !== 'n1') },
        range,
      ),
    ).toEqual({ kind: 'none' });
    expect(
      reconcileSelection(document, { ...range, endpointNeumeId: 'n3' }),
    ).toEqual({ kind: 'neume', neumeId: 'n3' });
    expect(resolveSelectionSyllableId(document, range)).toBeNull();
  });
  it('preserves history and redo while selecting and reconciles through history', () => {
    let state = createEditorSession(document);
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (d) => ({ ...d, title: 'Edited' }),
    });
    state = reduceEditorSession(state, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    const history = state.history;
    state = reduceEditorSession(state, {
      type: 'select',
      selection: { kind: 'note', noteId: 'a3' },
    });
    state = reduceEditorSession(state, {
      type: 'extend-selection',
      noteId: 'b1',
    });
    expect(state.history).toBe(history);
    const selection = state.selection;
    state = reduceEditorSession(state, {
      type: 'history',
      direction: 'redo',
      focusedNoteId: 'b1',
    });
    expect(state.selection).toBe(selection);
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (d) => ({ ...d, neumes: d.neumes.filter((n) => n.id !== 'n1') }),
    });
    expect(state.selection.kind).toBe('none');
    state = reduceEditorSession(state, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(state.selection.kind).toBe('none');
  });
  it('rejects ambiguous operations at resolver and reducer boundaries and allows explicit L', () => {
    const state = { ...createEditorSession(document), selection: range };
    expect(
      resolveToolbarNeumeInsertion(document, range, staffPosition(2)),
    ).toBeNull();
    expect(
      resolveEditorToolbarInsertion(document, range, 'punctum'),
    ).toBeNull();
    expect(
      reduceEditorSession(state, {
        type: 'insert',
        ids: {
          neumeId: 'new',
          noteIds: ['new-note', 'new-note-2', 'new-note-3'],
        },
      }).history,
    ).toBe(state.history);
    expect(
      reduceEditorSession(state, {
        type: 'edit',
        musicalSelectionEdit: true,
        edit: (d) => ({ ...d, neumes: [] }),
      }),
    ).toBe(state);
    expect(
      reduceEditorSession(state, {
        type: 'lyrics',
        action: { type: 'start', neumeId: null },
        newId: 's',
      }).selection,
    ).toBe(range);
    expect(
      reduceEditorSession(state, {
        type: 'start-lyrics-at-focus',
        target: { kind: 'note', noteId: 'a2' },
        newId: 's',
      }).selection.kind,
    ).not.toBe('neume-range');
    expect(
      reduceEditorSession(state, {
        type: 'arm',
        tool: { kind: 'place-punctum' },
      }).selection.kind,
    ).toBe('none');
    expect(
      reduceEditorSession(
        {
          ...state,
          lyrics: { kind: 'ready', neumeId: 'n2' },
        },
        { type: 'extend-selection', noteId: 'a4' },
      ).selection,
    ).toBe(range);
  });
  it('includes interior insertion, retains normalized endpoints, and rejects stale range extension', () => {
    const inserted = {
      ...document,
      neumes: [
        ...document.neumes.slice(0, 2),
        { ...document.neumes[0], id: 'inserted' },
        ...document.neumes.slice(2),
      ],
    };
    expect(resolveNeumeRange(inserted, range)?.neumes.map((n) => n.id)).toEqual(
      ['n1', 'inserted', 'n2', 'n3'],
    );
    const normalized: ChantDocument = {
      ...document,
      neumes: document.neumes.map((n) =>
        n.id === 'n1' ? { id: n.id, kind: 'punctum', notes: [n.notes[0]] } : n,
      ),
    };
    expect(reconcileSelection(normalized, range)).toBe(range);
    const stale: EditorSelection = { ...range, endpointNeumeId: 'missing' };
    expect(extendSelection(document, stale, 'a0')).toBe(stale);
    expect(createEditorSession(document).selection.kind).toBe('none');
  });
  it('keeps ranges during direct lyric deletion and leaves them during explicit clef transactions', () => {
    const doc: ChantDocument = {
      ...document,
      syllables: [
        { id: 's', text: 'Ky', startsAtNeumeId: 'n2', boundaryBefore: 'word' },
      ],
      clefChanges: [
        {
          id: 'c',
          clef: { type: 'c', staffLine: 3 },
          beforeNeumeId: 'n2',
          beforeDivisionId: null,
        },
      ],
    };
    const state = { ...createEditorSession(doc), selection: range };
    const deleted = reduceEditorSession(state, {
      type: 'lyrics',
      action: { type: 'delete', syllableId: 's' },
      newId: 'unused',
    });
    expect(deleted.selection).toBe(range);
    expect(deleted.lyrics).toBeNull();
    const transaction = reduceEditorSession(state, {
      type: 'start-clef-change',
      id: 'c',
    });
    expect(transaction.selection.kind).toBe('clef-change');
    expect(
      reduceEditorSession(transaction, {
        type: 'extend-selection',
        noteId: 'a4',
      }),
    ).toBe(transaction);
    expect(
      reduceEditorSession(
        {
          ...state,
          pendingHistory: { direction: 'undo', focusedNoteId: null },
        },
        { type: 'extend-selection', noteId: 'a4' },
      ).selection,
    ).toBe(range);
    expect(
      reduceEditorSession(
        { ...state, accidentalTargetId: 'sign' },
        { type: 'extend-selection', noteId: 'a4' },
      ).selection,
    ).toBe(range);
  });
  it('keeps recovery Shift activation as a single whole-neume Retry target', () => {
    const lyric = (state: EditorSession, action: LyricAction) =>
      reduceEditorSession(state, { type: 'lyrics', action, newId: 'draft' });
    let state = lyric(createEditorSession(document), {
      type: 'start',
      neumeId: 'n0',
    });
    state = lyric(state, { type: 'text', text: 'Ky' });
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (d) =>
        createLyricSyllable(d, {
          id: 'occupier',
          text: 'other',
          startsAtNeumeId: 'n0',
          boundaryBefore: 'word',
        }),
    });
    expect(state.lyrics?.kind).toBe('recovery');
    const history = state.history;
    state = reduceEditorSession(state, {
      type: 'extend-selection',
      noteId: 'b2',
    });
    expect(state.selection).toEqual({ kind: 'neume', neumeId: 'n2' });
    expect(state.focusRequest).toEqual({ kind: 'note', noteId: 'b2' });
    // A second Shift activation replaces the target rather than extending.
    state = reduceEditorSession(state, {
      type: 'extend-selection',
      noteId: 'a3',
    });
    expect(state.selection).toEqual({ kind: 'neume', neumeId: 'n3' });
    expect(
      reduceEditorSession(state, {
        type: 'extend-selection',
        noteId: 'a3',
        direction: 1,
      }),
    ).toBe(state);
    expect(state.history).toBe(history);
    expect(state.lyrics?.kind).toBe('recovery');
    const selected =
      state.selection.kind === 'neume' ? state.selection.neumeId : '';
    state = lyric(state, { type: 'retry', neumeId: selected });
    expect(state.lyrics).toMatchObject({
      kind: 'draft',
      neumeId: 'n3',
      text: 'Ky',
    });
  });
  it('announces passage clearing or resizing caused by history reconciliation', () => {
    const undo: EditorAction = {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    };
    const redo: EditorAction = { ...undo, direction: 'redo' };
    let state = createEditorSession(document);
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (d) => ({
        ...d,
        neumes: [
          ...d.neumes.slice(0, 2),
          {
            id: 'inner',
            kind: 'punctum',
            notes: [{ id: 'i', staffPosition: staffPosition(2) }],
          },
          ...d.neumes.slice(2),
        ],
      }),
    });
    state = reduceEditorSession(state, { type: 'select', selection: range });
    state = reduceEditorSession(state, undo);
    expect(state.selection).toBe(range);
    expect(state.announcement.text).toBe('3 neumes selected.');
    const sequence = state.announcement.sequence;
    state = reduceEditorSession(state, redo);
    expect(state.announcement).toEqual({
      sequence: sequence + 1,
      text: '4 neumes selected.',
    });
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (d) => ({ ...d, title: 'Unrelated' }),
    });
    expect(state.announcement.sequence).toBe(sequence + 1);
    state = reduceEditorSession(state, {
      type: 'edit',
      edit: (d) => ({ ...d, neumes: d.neumes.filter((n) => n.id !== 'n1') }),
    });
    state = reduceEditorSession(state, undo);
    state = reduceEditorSession(state, { type: 'select', selection: range });
    state = reduceEditorSession(state, redo);
    expect(state.selection.kind).toBe('none');
    expect(state.announcement.text).toBe('Passage selection cleared.');
    state = reduceEditorSession(state, undo);
    expect(state.selection.kind).toBe('none');
    state = reduceEditorSession(state, { type: 'select', selection: range });
    expect(
      reduceEditorSession(state, {
        type: 'arm',
        tool: { kind: 'place-division', divisionKind: 'minor' },
      }).announcement.text,
    ).toBe('Placing minor division. Passage selection cleared.');
  });
});
