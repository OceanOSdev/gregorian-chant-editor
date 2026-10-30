import {
  transitionLyrics,
  reconcileLyricEntry,
  lyricTargetId,
  isDirtyLyricEntry,
  type LyricAction,
  type LyricEntry,
} from './lyric-entry';
import type { ChantDocument } from '../domain/chant-document';
import { findNeume, findNote } from '../domain/neume';
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import {
  insertEditorNeume,
  resolveEditorToolbarInsertion,
  type InsertionIds,
} from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { layoutChant, type GraphicalNeumeKind } from '../layout/layout-chant';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
  type DocumentEdit,
  type DocumentHistory,
} from './document-history';
import { selectTool, type EditorTool } from './editor-tool';
import {
  clearSelection,
  reconcileSelection,
  selectNote,
  selectNeume,
  selectSyllable,
  type EditorSelection,
} from './selection';

export type EditorFocusRequest =
  | { kind: 'lyrics' }
  | { kind: 'lyric'; syllableId: string }
  | { kind: 'note'; noteId: string }
  | { kind: 'placement'; noteId: string }
  | { kind: 'palette'; tool: 'select' | GraphicalNeumeKind };

export interface EditorSession {
  history: DocumentHistory;
  lyrics: LyricEntry | null;
  pendingHistory: {
    direction: 'undo' | 'redo';
    focusedNoteId: string | null;
  } | null;
  selection: EditorSelection;
  activeTool: EditorTool;
  rememberedKind: GraphicalNeumeKind;
  hoveredPoint: { x: number; y: number } | null;
  focusRequest: EditorFocusRequest | null;
  announcement: { sequence: number; text: string };
}

export type EditorAction =
  | { type: 'lyrics'; action: LyricAction; newId: string }
  | {
      type: 'resolve-history';
      choice: 'save' | 'discard' | 'cancel';
      newId: string;
    }
  | { type: 'arm'; tool: EditorTool; lyricCommitId?: string }
  | { type: 'focus-palette' }
  | { type: 'hover'; point: { x: number; y: number } | null }
  | {
      type: 'place';
      kind: GraphicalNeumeKind;
      point: { x: number; y: number };
      ids: InsertionIds;
    }
  | { type: 'insert'; ids: InsertionIds; lyricCommitId?: string }
  | { type: 'select-tool' }
  | { type: 'select'; selection: EditorSelection; focusNoteId?: string }
  | {
      type: 'edit';
      edit: DocumentEdit;
      focusNoteId?: string;
      clearSelection?: boolean;
    }
  | {
      type: 'history';
      direction: 'undo' | 'redo';
      focusedNoteId: string | null;
    }
  | { type: 'focus-handled'; request: EditorFocusRequest };

export function createEditorSession(document: ChantDocument): EditorSession {
  return {
    history: createDocumentHistory(document),
    lyrics: null,
    pendingHistory: null,
    selection: clearSelection(),
    activeTool: selectTool(),
    rememberedKind: 'punctum',
    hoveredPoint: null,
    focusRequest: null,
    announcement: { sequence: 0, text: '' },
  };
}

export function neumeName(kind: GraphicalNeumeKind): string {
  return kind[0].toUpperCase() + kind.slice(1);
}

function announce(state: EditorSession, text: string): EditorSession {
  return {
    ...state,
    announcement: { sequence: state.announcement.sequence + 1, text },
  };
}

/** Reconcile semantic targets without losing dirty lyric drafts. */
function reconcile(state: EditorSession): EditorSession {
  const document = state.history.present;
  const selection = reconcileSelection(document, state.selection);
  return {
    ...state,
    selection,
    lyrics: reconcileLyricEntry(document, state.lyrics),
  };
}

export function getSelectFocusRequest(
  state: EditorSession,
): EditorFocusRequest {
  const document = state.history.present;
  const selection = state.selection;
  if (
    selection.kind === 'syllable' &&
    document.syllables.some((s) => s.id === selection.syllableId)
  )
    return { kind: 'lyric', syllableId: selection.syllableId };
  const note =
    state.selection.kind === 'note'
      ? findNote(document, state.selection.noteId)
      : null;
  if (note) return { kind: 'note', noteId: note.note.id };
  const neume =
    state.selection.kind === 'neume'
      ? findNeume(document, state.selection.neumeId)?.neume
      : null;
  return neume
    ? { kind: 'note', noteId: neume.notes[0].id }
    : { kind: 'palette', tool: 'select' };
}

/** Pure event transitions: no browser work or ID generation in React updaters. */
function reduceSessionAction(
  state: EditorSession,
  action: EditorAction,
): EditorSession {
  const placing = getGraphicalNeumeKind(state.activeTool);
  switch (action.type) {
    case 'lyrics':
    case 'resolve-history':
      return state;
    case 'arm': {
      const kind = getGraphicalNeumeKind(action.tool);
      if (!kind || action.tool.kind === state.activeTool.kind) return state;
      return announce(
        {
          ...state,
          activeTool: action.tool,
          rememberedKind: kind,
          hoveredPoint: null,
          focusRequest: null,
        },
        `Placing ${neumeName(kind)}.`,
      );
    }
    case 'focus-palette':
      return {
        ...state,
        focusRequest: { kind: 'palette', tool: state.rememberedKind },
      };
    case 'hover':
      return { ...state, hoveredPoint: placing ? action.point : null };
    case 'select-tool':
      return !placing
        ? state
        : announce(
            {
              ...state,
              activeTool: selectTool(),
              hoveredPoint: null,
              focusRequest: getSelectFocusRequest(state),
            },
            'Select tool.',
          );
    case 'select': {
      if (placing) return state;
      return {
        ...state,
        selection: action.selection,
        focusRequest: action.focusNoteId
          ? { kind: 'note', noteId: action.focusNoteId }
          : null,
      };
    }
    case 'insert':
    case 'place': {
      if (action.type === 'place' && placing !== action.kind) return state;
      const kind = action.type === 'place' ? action.kind : state.rememberedKind;
      const document = state.history.present;
      // Recompute on the reducer's current document, never the handler's render closure.
      const insertion =
        action.type === 'place'
          ? resolveGraphicalNeumePlacement(
              layoutChant(document),
              kind,
              action.point,
            )
          : resolveEditorToolbarInsertion(document, state.selection, kind);
      if (!insertion)
        return state.hoveredPoint ? { ...state, hoveredPoint: null } : state;
      const nextDocument = insertEditorNeume(document, insertion, action.ids);
      if (nextDocument === document) return state;
      const graphical = action.type === 'place';
      const noteId = action.ids.noteIds[0];
      const next: EditorSession = {
        ...state,
        history: applyDocumentEdit(state.history, () => nextDocument),
        selection: selectNote(noteId),
        activeTool: graphical ? state.activeTool : selectTool(),
        hoveredPoint: null,
        focusRequest: { kind: graphical ? 'placement' : 'note', noteId },
      };
      const reconciled = reconcile(next);
      return announce(
        {
          ...reconciled,
          focusRequest:
            state.lyrics?.kind === 'end' && reconciled.lyrics?.kind !== 'end'
              ? { kind: 'lyrics' }
              : reconciled.focusRequest,
        },
        `${neumeName(kind)} added.`,
      );
    }
    case 'edit': {
      const history = applyDocumentEdit(state.history, action.edit);
      if (history === state.history) return state;
      const next = reconcile({
        ...state,
        history,
        selection: action.clearSelection ? clearSelection() : state.selection,
        hoveredPoint: null,
        focusRequest:
          !placing &&
          action.focusNoteId &&
          findNote(history.present, action.focusNoteId)
            ? { kind: 'note', noteId: action.focusNoteId }
            : null,
      });
      return next;
    }
    case 'history': {
      const history = (
        action.direction === 'undo' ? undoDocumentEdit : redoDocumentEdit
      )(state.history);
      if (history === state.history) return state;
      const next = reconcile({
        ...state,
        history,
        hoveredPoint: null,
        focusRequest:
          !placing &&
          action.focusedNoteId &&
          findNote(history.present, action.focusedNoteId)
            ? { kind: 'note', noteId: action.focusedNoteId }
            : null,
      });
      if (!placing) return next;
      return announce(next, action.direction === 'undo' ? 'Undo.' : 'Redo.');
    }
    case 'focus-handled':
      return state.focusRequest === action.request
        ? { ...state, focusRequest: null }
        : state;
  }
}

function applyLyrics(
  state: EditorSession,
  action: LyricAction,
  newId: string,
): EditorSession {
  const document = state.history.present;
  let entry = state.lyrics;
  if (!entry && action.type === 'select') {
    if (!document.syllables.some((s) => s.id === action.syllableId))
      return state;
    entry = { kind: 'selected', syllableId: action.syllableId };
  }
  if (!entry && action.type === 'delete' && action.syllableId) {
    if (!document.syllables.some((s) => s.id === action.syllableId))
      return state;
    entry = { kind: 'selected', syllableId: action.syllableId };
  }
  if (
    !entry &&
    (action.type === 'delete' || action.type === 'advance') &&
    state.selection.kind === 'syllable'
  )
    entry = { kind: 'selected', syllableId: state.selection.syllableId };
  if (!entry && action.type === 'edit') {
    const syllable = document.syllables.find((s) => s.id === action.syllableId);
    if (!syllable) return state;
    entry = transitionLyrics(
      document,
      null,
      { type: 'start', neumeId: syllable.startsAtNeumeId },
      newId,
    ).entry;
  }
  const next = transitionLyrics(document, entry, action, newId);
  const target = lyricTargetId(next.document, next.entry);
  const selection =
    next.entry?.kind === 'selected'
      ? selectSyllable(next.entry.syllableId)
      : target
        ? selectNeume(target)
        : state.selection;
  const updated: EditorSession = {
    ...state,
    history: applyDocumentEdit(state.history, () => next.document),
    lyrics:
      !state.lyrics && (action.type === 'select' || action.type === 'delete')
        ? null
        : next.entry,
    selection,
    activeTool: selectTool(),
    hoveredPoint: null,
    focusRequest: next.focus
      ? next.entry?.kind === 'selected'
        ? { kind: 'lyric', syllableId: next.entry.syllableId }
        : next.entry?.kind === 'ready'
          ? getSelectFocusRequest({ ...state, selection })
          : next.entry
            ? { kind: 'lyrics' }
            : getSelectFocusRequest({ ...state, selection })
      : null,
  };
  return next.message ? announce(updated, next.message) : updated;
}

/** Coordinates semantic history and the single transient lyric draft. */
export function reduceEditorSession(
  state: EditorSession,
  action: EditorAction,
): EditorSession {
  if (state.pendingHistory) {
    if (action.type === 'focus-handled')
      return reduceSessionAction(state, action);
    if (action.type !== 'resolve-history') return state;
    if (action.choice === 'cancel')
      return {
        ...state,
        pendingHistory: null,
        focusRequest: { kind: 'lyrics' },
      };
    const pending = state.pendingHistory;
    const resolved =
      action.choice === 'save'
        ? applyLyrics(state, { type: 'done' }, action.newId)
        : { ...state, lyrics: null };
    if (resolved.lyrics) return resolved;
    return reduceSessionAction(
      { ...resolved, pendingHistory: null },
      { type: 'history', ...pending },
    );
  }
  if (action.type === 'lyrics')
    return applyLyrics(state, action.action, action.newId);
  if (action.type === 'resolve-history') return state;
  if (action.type === 'history' && isDirtyLyricEntry(state.lyrics))
    return {
      ...state,
      pendingHistory: {
        direction: action.direction,
        focusedNoteId: action.focusedNoteId,
      },
      focusRequest: null,
    };
  if (
    (action.type === 'arm' ||
      (action.type === 'insert' && state.lyrics?.kind !== 'end')) &&
    state.lyrics
  ) {
    const resolved = applyLyrics(
      state,
      { type: 'done' },
      action.lyricCommitId ?? '',
    );
    // Fresh lyric IDs, like musical IDs, enter through event handling.
    if (resolved.lyrics) return resolved;
    return reduceSessionAction(resolved, action);
  }
  const next = reduceSessionAction(state, action);
  if (next.lyrics?.kind === 'recovery' && state.lyrics?.kind !== 'recovery')
    return announce(
      { ...next, focusRequest: { kind: 'lyrics' } },
      'Draft target changed. Your text is preserved; retry at a free neume or discard.',
    );
  return next;
}
