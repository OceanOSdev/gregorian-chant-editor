import type { ChantDocument, LyricSyllable } from '../domain/chant-document';
import { findNeume, findNote } from '../domain/neume';
import { createLyricSyllable } from '../commands/create-lyric-syllable';
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
  resolveSelectionSyllableId,
  selectNote,
  selectNeume,
  type EditorSelection,
} from './selection';

export type EditorFocusRequest =
  | { kind: 'note'; noteId: string }
  | { kind: 'placement'; noteId: string }
  | { kind: 'palette'; tool: 'select' | GraphicalNeumeKind };

export interface EditorSession {
  history: DocumentHistory;
  selection: EditorSelection;
  activeSyllableId: string | null;
  activeTool: EditorTool;
  rememberedKind: GraphicalNeumeKind;
  hoveredPoint: { x: number; y: number } | null;
  focusRequest: EditorFocusRequest | null;
  announcement: { sequence: number; text: string };
}

export type EditorAction =
  | { type: 'arm'; tool: EditorTool }
  | { type: 'focus-palette' }
  | { type: 'hover'; point: { x: number; y: number } | null }
  | {
      type: 'place';
      kind: GraphicalNeumeKind;
      point: { x: number; y: number };
      ids: InsertionIds;
    }
  | { type: 'insert'; ids: InsertionIds }
  | { type: 'select-tool' }
  | { type: 'select'; selection: EditorSelection; focusNoteId?: string }
  | { type: 'syllable'; id: string }
  | { type: 'add-syllable'; syllable: LyricSyllable }
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
    selection: clearSelection(),
    activeSyllableId: document.syllables[0]?.id ?? null,
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

/** One reconciliation policy, including history removal of the active syllable. */
function reconcile(state: EditorSession): EditorSession {
  const document = state.history.present;
  const selection = reconcileSelection(document, state.selection);
  const activeSyllableId =
    resolveSelectionSyllableId(document, selection) ??
    (document.syllables.some((s) => s.id === state.activeSyllableId)
      ? state.activeSyllableId
      : (document.syllables.at(-1)?.id ?? null));
  return {
    ...state,
    selection,
    activeSyllableId,
  };
}

export function getSelectFocusRequest(
  state: EditorSession,
): EditorFocusRequest {
  const document = state.history.present;
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
export function reduceEditorSession(
  state: EditorSession,
  action: EditorAction,
): EditorSession {
  const placing = getGraphicalNeumeKind(state.activeTool);
  switch (action.type) {
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
      const id = resolveSelectionSyllableId(
        state.history.present,
        action.selection,
      );
      return {
        ...state,
        selection: action.selection,
        activeSyllableId: id ?? state.activeSyllableId,
        focusRequest: action.focusNoteId
          ? { kind: 'note', noteId: action.focusNoteId }
          : null,
      };
    }
    case 'syllable': {
      const syllable = state.history.present.syllables.find(
        (s) => s.id === action.id,
      );
      if (!syllable) return state;
      const next = {
        ...state,
        activeSyllableId: action.id,
        selection: selectNeume(syllable.startsAtNeumeId),
        hoveredPoint: null,
        focusRequest: null,
      };
      return next;
    }
    case 'add-syllable': {
      const history = applyDocumentEdit(state.history, (document) =>
        createLyricSyllable(document, action.syllable),
      );
      if (history === state.history) return state;
      const next = {
        ...state,
        history,
        activeSyllableId: action.syllable.id,
        selection: clearSelection(),
        hoveredPoint: null,
        focusRequest: null,
      };
      return next;
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
      return announce(next, `${neumeName(kind)} added.`);
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
