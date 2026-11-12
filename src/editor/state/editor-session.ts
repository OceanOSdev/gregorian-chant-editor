import type { AccidentalEditResult } from '../domain/accidentals';
import { deleteAccidental } from '../commands/update-accidental';
import { reconcileAccidentals } from '../domain/accidentals';
import {
  eligibleAccidentalAnchors,
  placeAccidental,
} from '../commands/update-accidental';
import { noteFormLabels } from '../domain/note-forms';
import {
  resolveGraphicalClefPlacement,
  resolveKeyboardClefPlacement,
  type ClefPlacementCursor,
} from '../interaction/resolve-graphical-clef-placement';
import type { PaletteTool } from '../interaction/palette-navigation';
import {
  insertClefChangeCandidate,
  updateClefChangeCandidate,
  deleteClefChangeCandidate,
  hasChangedEffectivePitches,
  preserveClefMelodyResult,
  hasValidClefCandidate,
} from '../commands/edit-clef-change';
import { isValidClef } from '../domain/clef';
import {
  deriveScoreOrder,
  scoreBoundaryAt,
  resolveScoreBoundary,
} from '../domain/divisions';
import { updateClef } from '../commands/update-clef';
import {
  insertDivision,
  updateDivisionKind,
  deleteDivision,
} from '../commands/edit-division';
import { resolveScoreSlot } from '../interaction/resolve-score-slot';
import type {
  ChantDocument,
  Clef,
  DivisionKind,
  NoteForm,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { reassignLyricSyllable } from '../commands/reassign-lyric-syllable';
import {
  transitionLyrics,
  reconcileLyricEntry,
  lyricTargetId,
  isDirtyLyricEntry,
  type LyricAction,
  type LyricEntry,
} from './lyric-entry';
import { findNeume, findNote } from '../domain/neume';
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import {
  insertEditorNeume,
  resolveEditorToolbarInsertion,
  resolveDivisionSideBoundary,
  type InsertionIds,
} from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import type { MeasureLyricText } from '../layout/lyric-text-metrics';
import { layoutChant, type GraphicalNeumeKind } from '../layout/layout-chant';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
  type DocumentEdit,
  type DocumentHistory,
} from './document-history';
import {
  toolNoteForm,
  isPlacementTool,
  selectTool,
  type EditorTool,
} from './editor-tool';
import {
  clearSelection,
  reconcileSelection,
  selectNote,
  selectNeume,
  selectSyllable,
  type EditorSelection,
} from './selection';

const noteFormRejection =
  'Edit rejected: preserve the ascending contour and supported context of the authored form. Change Form to default before removing its required partner.';

export type EditorFocusRequest =
  | { kind: 'accidental'; accidentalId: string }
  | { kind: 'clef-placement'; clefChangeId?: string }
  | { kind: 'clef' }
  | { kind: 'clef-change'; clefChangeId: string }
  | { kind: 'division'; divisionId: string }
  | { kind: 'lyrics' }
  | { kind: 'lyric'; syllableId: string }
  | { kind: 'note'; noteId: string }
  | { kind: 'placement'; noteId: string }
  | { kind: 'palette'; tool: PaletteTool };

export interface ClefTransaction {
  accidentalLossCount?: number;
  /** Preflight count for the existing deletion choice, not a loss-confirmation flag. */
  noteheadLossCount?: number;
  noteheadCandidate?: ChantDocument;
  keepScoreFocus?: boolean;
  placementTool?: Extract<EditorTool, { kind: 'place-clef' }>;
  policyError?: string;
  original: ChantDocument;
  previousSelection: EditorSelection;
  id: string;
  boundary: ScoreInsertionBoundary | null;
  clef: Clef;
  candidate: ChantDocument | null;
}

export interface EditorSession {
  accidentalTargetId: string | null;
  noteFormError: string | null;
  clefInsertionPolicy: 'melody' | 'noteheads';
  clefInsertionError: string | null;
  keyboardClefPlacement: ClefPlacementCursor | null;
  clefTransaction: ClefTransaction | null;
  history: DocumentHistory;
  lyricMove: {
    syllableId: string;
    candidateId: string;
    previousLyrics: LyricEntry | null;
    previousSelection: EditorSelection;
  } | null;
  lyrics: LyricEntry | null;
  pendingHistory: {
    direction: 'undo' | 'redo';
    focusedNoteId: string | null;
    focusedDivisionId?: string | null;
  } | null;
  selection: EditorSelection;
  activeTool: EditorTool;
  rememberedKind: GraphicalNeumeKind;
  rememberedForm?: NoteForm;
  quilismaFigure: 'podatus' | 'scandicus';
  hoveredPoint: { x: number; y: number } | null;
  focusRequest: EditorFocusRequest | null;
  announcement: { sequence: number; text: string };
}

export type LyricMoveAction =
  | { type: 'start'; syllableId: string; newId: string }
  | { type: 'browse'; direction: -1 | 1 }
  | { type: 'commit'; neumeId?: string }
  | { type: 'cancel' };

/** Derive the open interval between neighboring anchors without trial edits. */
export function lyricMoveTargets(
  document: ChantDocument,
  syllableId: string,
): string[] {
  const index = document.syllables.findIndex((s) => s.id === syllableId);
  if (index < 0) return [];
  const syllable = document.syllables[index];
  const previous = document.syllables[index - 1];
  const following = document.syllables[index + 1];
  const lower = previous
    ? document.neumes.findIndex((n) => n.id === previous.startsAtNeumeId)
    : -1;
  const upper = following
    ? document.neumes.findIndex((n) => n.id === following.startsAtNeumeId)
    : document.neumes.length;
  if ((previous && lower < 0) || upper < 0) return [];
  const occupied = new Set(document.syllables.map((s) => s.startsAtNeumeId));
  return document.neumes
    .filter(
      (n, i) =>
        i > lower &&
        i < upper &&
        n.id !== syllable.startsAtNeumeId &&
        !occupied.has(n.id),
    )
    .map((n) => n.id);
}

export type ClefKeyboardCommand =
  'start' | 'previous' | 'next' | 'up' | 'down' | 'first' | 'last';

export type EditorAction =
  | { type: 'delete-accidental'; id: string }
  | { type: 'start-accidental-placement'; id: string }
  | { type: 'cancel-accidental-placement' }
  | { type: 'commit-accidental-placement'; noteId: string }
  | { type: 'clef-insertion-policy'; preserve: 'melody' | 'noteheads' }
  | { type: 'clef-keyboard'; command: ClefKeyboardCommand }
  | {
      type: 'place-clef';
      clefType: Clef['type'];
      id: string;
      point?: { x: number; y: number };
      measureLyrics?: MeasureLyricText;
    }
  | { type: 'step-clef-change'; id: string; direction: 1 | -1 }
  | {
      type: 'start-clef-change';
      id: string;
      boundary?: ScoreInsertionBoundary;
      keepScoreFocus?: boolean;
    }
  | { type: 'draft-clef-change'; clef: Clef }
  | { type: 'apply-clef-change'; remove?: boolean }
  | { type: 'cancel-clef-change' }
  | { type: 'confirm-clef-change'; preserve: 'melody' | 'noteheads' }
  | { type: 'change-clef'; clef: Clef }
  | {
      type: 'place-division';
      point: { x: number; y: number };
      kind: DivisionKind;
      id: string;
      measureLyrics?: MeasureLyricText;
    }
  | { type: 'change-division'; id: string; kind: DivisionKind }
  | { type: 'delete-division'; id: string }
  | { type: 'engraving-edit'; edit: DocumentEdit }
  | { type: 'lyric-move'; action: LyricMoveAction }
  | {
      type: 'start-lyrics-at-focus';
      target: Extract<EditorSelection, { kind: 'note' | 'syllable' }>;
      newId: string;
    }
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
      /** Immutable displayed font snapshot; never stored in semantic history. */
      measureLyrics?: MeasureLyricText;
      kind: GraphicalNeumeKind;
      point: { x: number; y: number };
      ids: InsertionIds;
    }
  | {
      type: 'insert';
      ids: InsertionIds;
      lyricCommitId?: string;
      boundary?: ScoreInsertionBoundary;
      divisionSide?: { divisionId: string; side: 'before' | 'after' };
    }
  | { type: 'select-tool' }
  | { type: 'select'; selection: EditorSelection; focusNoteId?: string }
  | {
      type: 'edit';
      formDeletionNoteId?: string;
      edit: (document: ChantDocument) => ChantDocument | AccidentalEditResult;
      focusNoteId?: string;
      clearSelection?: boolean;
    }
  | {
      type: 'history';
      direction: 'undo' | 'redo';
      focusedNoteId: string | null;
      focusedDivisionId?: string | null;
    }
  | { type: 'focus-handled'; request: EditorFocusRequest };

export function createEditorSession(document: ChantDocument): EditorSession {
  return {
    accidentalTargetId: null,
    noteFormError: null,
    clefInsertionPolicy: 'melody',
    clefInsertionError: null,
    keyboardClefPlacement: null,
    clefTransaction: null,
    history: createDocumentHistory(document),
    lyricMove: null,
    lyrics: null,
    pendingHistory: null,
    selection: clearSelection(),
    activeTool: selectTool(),
    rememberedKind: 'punctum',
    quilismaFigure: 'podatus',
    hoveredPoint: null,
    focusRequest: null,
    announcement: { sequence: 0, text: '' },
  };
}

export function neumeName(kind: GraphicalNeumeKind | DivisionKind): string {
  return kind[0].toUpperCase() + kind.slice(1);
}

/** One visual entry name for controls and live-region messages. */
export function entryName(kind: GraphicalNeumeKind, form?: NoteForm): string {
  return form
    ? noteFormLabels[form] + (form === 'quilisma' ? ' ' + neumeName(kind) : '')
    : neumeName(kind);
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
    selection.kind === 'accidental' &&
    document.accidentals.some((a) => a.id === selection.accidentalId)
  )
    return { kind: 'accidental', accidentalId: selection.accidentalId };
  if (selection.kind === 'clef-change')
    return { kind: 'clef-change', clefChangeId: selection.clefChangeId };
  if (selection.kind === 'clef') return { kind: 'clef' };
  if (
    selection.kind === 'syllable' &&
    document.syllables.some((s) => s.id === selection.syllableId)
  )
    return { kind: 'lyric', syllableId: selection.syllableId };
  if (
    selection.kind === 'division' &&
    document.divisions.some((d) => d.id === selection.divisionId)
  )
    return { kind: 'division', divisionId: selection.divisionId };
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
  const placing = isPlacementTool(state.activeTool);
  const neumePlacing = getGraphicalNeumeKind(state.activeTool);
  switch (action.type) {
    case 'delete-accidental':
    case 'start-accidental-placement':
    case 'cancel-accidental-placement':
    case 'commit-accidental-placement':
    case 'clef-insertion-policy':
    case 'place-clef':
    case 'clef-keyboard':
    case 'step-clef-change':
    case 'start-clef-change':
    case 'draft-clef-change':
    case 'apply-clef-change':
    case 'cancel-clef-change':
    case 'confirm-clef-change':
    case 'lyric-move':
    case 'start-lyrics-at-focus':
    case 'lyrics':
    case 'resolve-history':
      return state;
    case 'arm': {
      const kind = getGraphicalNeumeKind(action.tool);
      if (
        action.tool.kind === 'select' ||
        (action.tool.kind === state.activeTool.kind &&
          toolNoteForm(action.tool) === toolNoteForm(state.activeTool) &&
          (action.tool.kind !== 'place-division' ||
            (state.activeTool.kind === 'place-division' &&
              action.tool.divisionKind === state.activeTool.divisionKind)) &&
          (action.tool.kind !== 'place-clef' ||
            (state.activeTool.kind === 'place-clef' &&
              action.tool.clefType === state.activeTool.clefType)))
      )
        return state;
      return announce(
        {
          ...state,
          noteFormError: null,
          activeTool: action.tool,
          keyboardClefPlacement: null,
          rememberedKind: kind ?? state.rememberedKind,
          rememberedForm: kind
            ? toolNoteForm(action.tool)
            : state.rememberedForm,
          quilismaFigure:
            kind &&
            toolNoteForm(action.tool) === 'quilisma' &&
            (kind === 'podatus' || kind === 'scandicus')
              ? kind
              : state.quilismaFigure,
          hoveredPoint: null,
          focusRequest: null,
        },
        `Placing ${kind ? entryName(kind, toolNoteForm(action.tool)) : action.tool.kind === 'place-division' ? action.tool.divisionKind + ' division' : action.tool.kind === 'place-clef' ? action.tool.clefType.toUpperCase() + ' clef' : ''}.`,
      );
    }
    case 'focus-palette':
      return {
        ...state,
        focusRequest: {
          kind: 'palette',
          tool:
            state.rememberedForm === 'quilisma'
              ? 'quilisma'
              : state.rememberedForm === 'virga' ||
                  state.rememberedForm === 'inclinatum'
                ? state.rememberedForm
                : state.rememberedKind,
        },
      };
    case 'hover':
      return {
        ...state,
        keyboardClefPlacement: action.point
          ? null
          : state.keyboardClefPlacement,
        hoveredPoint: placing ? action.point : null,
      };
    case 'select-tool':
      return !placing
        ? state
        : announce(
            {
              ...state,
              activeTool: selectTool(),
              keyboardClefPlacement: null,
              hoveredPoint: null,
              focusRequest: getSelectFocusRequest(state),
            },
            'Select tool.',
          );
    case 'select': {
      if (placing) return state;
      return {
        ...state,
        noteFormError: null,
        selection: action.selection,
        focusRequest: action.focusNoteId
          ? { kind: 'note', noteId: action.focusNoteId }
          : null,
      };
    }
    case 'insert':
    case 'place': {
      if (action.type === 'place' && neumePlacing !== action.kind) return state;
      const kind = action.type === 'place' ? action.kind : state.rememberedKind;
      const document = state.history.present;
      const sideBoundary =
        action.type === 'insert' && action.divisionSide
          ? resolveDivisionSideBoundary(
              document,
              action.divisionSide.divisionId,
              action.divisionSide.side,
            )
          : null;
      if (action.type === 'insert' && action.divisionSide && !sideBoundary)
        return state;
      // Latest semantic state plus the displayed font snapshot serializes rapid clicks.
      const insertion =
        action.type === 'place'
          ? resolveGraphicalNeumePlacement(
              layoutChant(document, action.measureLyrics),
              kind,
              action.point,
            )
          : resolveEditorToolbarInsertion(
              document,
              state.selection,
              kind,
              sideBoundary ?? action.boundary,
            );
      if (
        !insertion &&
        action.type === 'insert' &&
        (state.selection.kind === 'division' ||
          state.selection.kind === 'clef-change')
      )
        return announce(
          state,
          state.selection.kind === 'clef-change'
            ? 'Choose Insert before clef or Insert after clef in the selected clef controls.'
            : 'Choose Insert before division or Insert after division.',
        );
      if (!insertion)
        return state.hoveredPoint ? { ...state, hoveredPoint: null } : state;
      const nextDocument = insertEditorNeume(
        document,
        insertion,
        action.ids,
        action.type === 'place'
          ? toolNoteForm(state.activeTool)
          : state.rememberedForm,
      );
      if (nextDocument === document) return state;
      const graphical = action.type === 'place';
      const noteId = action.ids.noteIds[0];
      const next: EditorSession = {
        ...state,
        history: applyDocumentEdit(state.history, () => nextDocument),
        selection: selectNote(noteId),
        activeTool: graphical ? state.activeTool : selectTool(),
        keyboardClefPlacement: null,
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
        `${entryName(kind, action.type === 'place' ? toolNoteForm(state.activeTool) : state.rememberedForm)} added.`,
      );
    }
    case 'place-division': {
      if (
        state.activeTool.kind !== 'place-division' ||
        state.activeTool.divisionKind !== action.kind
      )
        return state;
      const document = state.history.present;
      const resolved = resolveScoreSlot(
        layoutChant(document, action.measureLyrics),
        action.point,
      );
      if (!resolved) return state;
      const boundary = resolved.slot.boundary;
      const next = insertDivision(
        document,
        {
          id: action.id,
          kind: action.kind,
          beforeNeumeId: boundary.beforeNeumeId,
        },
        boundary,
      );
      if (next === document) return state;
      return announce(
        {
          ...state,
          history: applyDocumentEdit(state.history, () => next),
          selection: { kind: 'division', divisionId: action.id },
          hoveredPoint: null,
          focusRequest: {
            kind: 'division',
            divisionId: action.id,
          },
        },
        `${neumeName(action.kind)} division added.`,
      );
    }
    case 'change-division':
    case 'delete-division': {
      if (placing) return state;
      const history = applyDocumentEdit(state.history, (doc) =>
        action.type === 'change-division'
          ? updateDivisionKind(doc, action.id, action.kind)
          : deleteDivision(doc, action.id),
      );
      if (history === state.history) return state;
      return reconcile({
        ...state,
        history,
        hoveredPoint: null,
        focusRequest:
          action.type === 'change-division'
            ? { kind: 'division', divisionId: action.id }
            : { kind: 'palette', tool: 'select' },
      });
    }
    case 'change-clef': {
      if (state.pendingHistory || state.lyricMove) return state;
      const history = applyDocumentEdit(state.history, (doc) =>
        updateClef(doc, action.clef),
      );
      return history === state.history
        ? state
        : announce(
            { ...state, history, hoveredPoint: null },
            `Initial ${action.clef.type.toUpperCase()} clef, line ${action.clef.staffLine}. Melody preserved.`,
          );
    }
    case 'engraving-edit': {
      if (state.pendingHistory || state.lyricMove) return state;
      const history = applyDocumentEdit(state.history, action.edit);
      return history === state.history ? state : { ...state, history };
    }
    case 'edit': {
      const edited = action.edit(state.history.present);
      const result =
        'document' in edited ? edited : { document: edited, rejection: null };
      const history = applyDocumentEdit(state.history, () => result.document);
      if (history === state.history)
        return action.formDeletionNoteId &&
          findNote(
            state.history.present,
            action.formDeletionNoteId,
          )?.neume.notes.some((n) => n.form)
          ? announce(
              {
                ...state,
                noteFormError: noteFormRejection,
              },
              noteFormRejection,
            )
          : result.rejection === 'ownership-conflict'
            ? announce(
                state,
                'Edit rejected: written accidentals would share the same B register in one neume. Remove a conflicting accidental before retrying.',
              )
            : state;
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
      if (
        !placing &&
        action.focusedDivisionId &&
        history.present.divisions.some((d) => d.id === action.focusedDivisionId)
      )
        return {
          ...next,
          focusRequest: {
            kind: 'division',
            divisionId: action.focusedDivisionId,
          },
        };
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
  if (action.type === 'delete-accidental') {
    // Like note and division edits, this leaves any lyric entry and its draft
    // intact; it cannot change the syllables or neumes that the entry targets.
    if (
      state.accidentalTargetId ||
      state.clefTransaction ||
      state.lyricMove ||
      state.pendingHistory
    )
      return state;
    const sign = state.history.present.accidentals.find(
      (a) => a.id === action.id,
    );
    if (!sign) return state;
    const document = deleteAccidental(state.history.present, action.id);
    return announce(
      {
        ...state,
        history: applyDocumentEdit(state.history, () => document),
        selection: reconcileSelection(document, state.selection),
        focusRequest: { kind: 'note', noteId: sign.ownerNoteId },
      },
      'Accidental deleted.',
    );
  }
  if (action.type === 'start-accidental-placement') {
    if (
      state.accidentalTargetId ||
      state.clefTransaction ||
      state.lyricMove ||
      state.pendingHistory ||
      state.lyrics ||
      state.activeTool.kind !== 'select'
    )
      return state;
    const ids = eligibleAccidentalAnchors(state.history.present, action.id);
    return ids.length
      ? announce(
          {
            ...state,
            accidentalTargetId: action.id,
            focusRequest: { kind: 'note', noteId: ids[0] },
          },
          'Choose an eligible earlier note. Enter places the accidental; Escape cancels.',
        )
      : announce(state, 'No eligible earlier note.');
  }
  if (action.type === 'cancel-accidental-placement')
    return state.accidentalTargetId
      ? announce(
          {
            ...state,
            accidentalTargetId: null,
            focusRequest: {
              kind: 'accidental',
              accidentalId: state.accidentalTargetId,
            },
          },
          'Accidental placement canceled.',
        )
      : state;
  if (action.type === 'commit-accidental-placement') {
    if (!state.accidentalTargetId) return state;
    const id = state.accidentalTargetId;
    const candidate = placeAccidental(state.history.present, id, action.noteId);
    if (candidate === state.history.present) {
      if (
        state.history.present.accidentals.some(
          (a) => a.id === id && a.placement?.noteId === action.noteId,
        )
      )
        return announce(
          {
            ...state,
            accidentalTargetId: null,
            focusRequest: { kind: 'accidental', accidentalId: id },
          },
          'Accidental placement unchanged.',
        );
      return announce(state, 'That note is not an eligible placement target.');
    }
    return announce(
      {
        ...state,
        accidentalTargetId: null,
        history: applyDocumentEdit(state.history, () => candidate),
        focusRequest: { kind: 'accidental', accidentalId: id },
      },
      'Accidental placement updated.',
    );
  }
  if (state.accidentalTargetId && action.type !== 'focus-handled') return state;
  let next = transitionEditorSession(state, action);
  if (next.history.present !== state.history.present) {
    const before = state.history.present,
      after = next.history.present;
    const restored = before.accidentals.filter(
      (a) =>
        a.placement &&
        after.accidentals.some((b) => b.id === a.id && !b.placement),
    ).length;
    if (restored)
      next = announce(
        next,
        `${restored} accidental placement${restored === 1 ? '' : 's'} restored to before the owning neume.`,
      );
    if (state.selection.kind === 'accidental') {
      const id = state.selection.accidentalId;
      if (!after.accidentals.some((a) => a.id === id)) {
        const owner = before.accidentals.find((a) => a.id === id)?.ownerNoteId;
        next = {
          ...next,
          selection: reconcileSelection(after, next.selection),
          focusRequest:
            owner && findNote(after, owner)
              ? { kind: 'note', noteId: owner }
              : getSelectFocusRequest({ ...next, selection: clearSelection() }),
        };
      }
    }
  }
  return next.history.present !== state.history.present &&
    next.noteFormError !== null
    ? { ...next, noteFormError: null }
    : next;
}

function transitionEditorSession(
  state: EditorSession,
  action: EditorAction,
): EditorSession {
  const transaction = state.clefTransaction;
  if (action.type === 'step-clef-change') {
    if (
      (action.direction !== 1 && action.direction !== -1) ||
      isPlacementTool(state.activeTool) ||
      state.pendingHistory ||
      state.lyricMove ||
      (transaction &&
        (transaction.id !== action.id ||
          transaction.boundary ||
          transaction.candidate ||
          transaction.original !== state.history.present))
    )
      return state;
    const clef =
      transaction?.clef ??
      state.history.present.clefChanges.find((c) => c.id === action.id)?.clef;
    if (!clef) return state;
    const staffLine = clef.staffLine + action.direction;
    if (
      staffLine !== 1 &&
      staffLine !== 2 &&
      staffLine !== 3 &&
      staffLine !== 4
    )
      return state;
    const pending = transaction
      ? state
      : reduceEditorSession(state, {
          type: 'start-clef-change',
          id: action.id,
          keepScoreFocus: true,
        });
    return announce(
      reduceEditorSession(pending, {
        type: 'draft-clef-change',
        clef: { ...clef, staffLine },
      }),
      `Draft ${clef.type.toUpperCase()} clef, staff line ${staffLine}. Apply commits; Escape cancels.`,
    );
  }
  if (action.type === 'clef-insertion-policy') {
    if (
      transaction?.candidate ||
      state.pendingHistory ||
      state.lyricMove ||
      (action.preserve !== 'melody' && action.preserve !== 'noteheads')
    )
      return state;
    return {
      ...state,
      clefInsertionPolicy: action.preserve,
      clefInsertionError: null,
      clefTransaction: transaction
        ? { ...transaction, policyError: undefined }
        : null,
    };
  }
  if (action.type === 'start-clef-change') {
    if (
      transaction ||
      state.pendingHistory ||
      state.lyricMove ||
      isPlacementTool(state.activeTool)
    )
      return state;
    const document = state.history.present;
    const existing = document.clefChanges.find((c) => c.id === action.id);
    if (
      action.boundary
        ? !resolveScoreBoundary(document, action.boundary)
        : !existing
    )
      return state;
    // Preserve the exact lyric draft; the transaction owns all editing until resolved.
    return {
      ...state,
      activeTool: selectTool(),
      hoveredPoint: null,
      focusRequest: null,
      clefTransaction: {
        keepScoreFocus: action.keepScoreFocus,
        original: document,
        previousSelection: state.selection,
        id: action.id,
        boundary: action.boundary ?? null,
        clef: existing?.clef ?? { type: 'c', staffLine: 3 },
        candidate: null,
      },
    };
  }
  if (transaction) {
    if (action.type === 'focus-handled')
      return reduceSessionAction(state, action);
    const restore = (): EditorSession => {
      const selection = reconcileSelection(
        state.history.present,
        transaction.previousSelection,
      );
      return {
        ...state,
        clefTransaction: null,
        selection,
        focusRequest: transaction.placementTool
          ? { kind: 'clef-placement' }
          : !transaction.boundary &&
              state.history.present.clefChanges.some(
                (c) => c.id === transaction.id,
              )
            ? { kind: 'clef-change', clefChangeId: transaction.id }
            : getSelectFocusRequest({ ...state, selection }),
      };
    };
    if (action.type === 'cancel-clef-change') return restore();
    if (transaction.original !== state.history.present) return restore();
    if (
      action.type === 'draft-clef-change' &&
      !transaction.candidate &&
      isValidClef(action.clef)
    )
      return {
        ...state,
        clefTransaction: {
          ...transaction,
          clef: { ...action.clef },
          policyError: undefined,
        },
      };
    let candidate: ChantDocument | null = null;
    let finalized = false;
    let preservationFailure: ReturnType<
      typeof preserveClefMelodyResult
    >['reason'] = null;
    if (action.type === 'apply-clef-change' && !transaction.candidate) {
      candidate = action.remove
        ? deleteClefChangeCandidate(transaction.original, transaction.id)
        : transaction.boundary
          ? insertClefChangeCandidate(
              transaction.original,
              {
                id: transaction.id,
                clef: transaction.clef,
                beforeNeumeId: transaction.boundary.beforeNeumeId,
                beforeDivisionId: transaction.boundary.beforeDivisionId,
              },
              transaction.boundary,
            )
          : updateClefChangeCandidate(
              transaction.original,
              transaction.id,
              transaction.clef,
            );
      if (candidate === transaction.original) return restore();
      if (!hasValidClefCandidate(candidate) && transaction.placementTool) {
        const message =
          'Cannot insert clef: existing note positions are unsafe. Correct the score and retry.';
        return announce({ ...restore(), clefInsertionError: message }, message);
      }
      if (!hasValidClefCandidate(candidate)) {
        const message =
          'Clef change rejected: unsafe note positions. Cancel or revise the draft.';
        return announce(
          {
            ...state,
            clefTransaction: { ...transaction, policyError: message },
          },
          message,
        );
      }
      if (
        transaction.placementTool ||
        (!action.remove && !transaction.boundary)
      ) {
        const preservation =
          state.clefInsertionPolicy === 'melody'
            ? preserveClefMelodyResult(transaction.original, candidate)
            : { document: candidate, reason: null };
        const selected = preservation.document;
        preservationFailure = preservation.reason;
        if (!selected || !hasValidClefCandidate(selected)) {
          const message = transaction.placementTool
            ? `Cannot insert with Keep pitches: ${preservationFailure === 'overflow' ? 'note positions would overflow' : 'pitches or written accidentals cannot be preserved safely'}. Choose Keep note positions or a different clef and retry.`
            : `Cannot apply Keep pitches: ${preservationFailure === 'overflow' ? 'note positions would overflow' : 'pitches or written accidentals cannot be preserved safely'}. Choose Keep note positions or revise the draft and retry Apply.`;
          return announce(
            transaction.placementTool
              ? { ...restore(), clefInsertionError: message }
              : {
                  ...state,
                  clefTransaction: { ...transaction, policyError: message },
                },
            message,
          );
        }
        candidate = selected;
        finalized = state.clefInsertionPolicy === 'melody';
      } else if (hasChangedEffectivePitches(transaction.original, candidate)) {
        const repaired = reconcileAccidentals(transaction.original, candidate);
        return {
          ...state,
          clefTransaction: {
            ...transaction,
            candidate,
            noteheadCandidate: repaired ?? undefined,
            noteheadLossCount: repaired
              ? transaction.original.accidentals.length -
                repaired.accidentals.length
              : 0,
          },
        };
      }
    } else if (action.type === 'confirm-clef-change' && transaction.candidate) {
      if (transaction.accidentalLossCount && action.preserve !== 'noteheads')
        return state;
      if (action.preserve === 'melody') {
        const preservation = preserveClefMelodyResult(
          transaction.original,
          transaction.candidate,
        );
        candidate = preservation.document;
        preservationFailure = preservation.reason;
      } else if (action.preserve === 'noteheads') {
        candidate = transaction.noteheadCandidate ?? transaction.candidate;
        finalized = !!transaction.noteheadCandidate;
      }
    }
    finalized ||=
      action.type === 'confirm-clef-change' && action.preserve === 'melody';
    if (!candidate) {
      if (
        action.type !== 'confirm-clef-change' ||
        !transaction.candidate ||
        action.preserve !== 'melody'
      )
        return state;
      const policyError = `Cannot preserve melody: ${preservationFailure === 'overflow' ? 'note positions would overflow' : 'pitches or written accidentals cannot be preserved safely'}. Choose Preserve noteheads or cancel.`;
      return announce(
        { ...state, clefTransaction: { ...transaction, policyError } },
        policyError,
      );
    }
    if (!hasValidClefCandidate(candidate)) return state;
    const repaired = finalized
      ? candidate
      : reconcileAccidentals(transaction.original, candidate);
    if (!repaired)
      return announce(
        state,
        'Clef change rejected: relative pitch arithmetic is unsafe or distinct written accidentals would merge. Revise the clef or remove a conflicting sign.',
      );
    const lost =
      transaction.original.accidentals.length - repaired.accidentals.length;
    if (lost > 0 && action.type !== 'confirm-clef-change')
      return {
        ...state,
        clefTransaction: {
          ...transaction,
          candidate: repaired,
          accidentalLossCount: lost,
          noteheadCandidate: repaired,
        },
      };
    candidate = repaired;
    const surviving = candidate.clefChanges.some(
      (c) => c.id === transaction.id,
    );
    const committedOrder = deriveScoreOrder(candidate) ?? [];
    const nextKeyboardBoundary = scoreBoundaryAt(
      committedOrder,
      committedOrder.findIndex((i) => i.entity.id === transaction.id) + 1,
    );
    return announce(
      reconcile({
        ...state,
        clefTransaction: null,
        clefInsertionError: null,
        history: applyDocumentEdit(state.history, () => candidate),
        keyboardClefPlacement:
          transaction.placementTool && state.keyboardClefPlacement
            ? { ...state.keyboardClefPlacement, boundary: nextKeyboardBoundary }
            : state.keyboardClefPlacement,
        selection: surviving
          ? { kind: 'clef-change', clefChangeId: transaction.id }
          : clearSelection(),
        focusRequest: transaction.placementTool
          ? { kind: 'clef-placement', clefChangeId: transaction.id }
          : surviving
            ? { kind: 'clef-change', clefChangeId: transaction.id }
            : { kind: 'palette', tool: 'select' },
      }),
      surviving ? 'Clef change applied.' : 'Clef change removed.',
    );
  }
  if (
    action.type === 'draft-clef-change' ||
    action.type === 'apply-clef-change' ||
    action.type === 'confirm-clef-change' ||
    action.type === 'cancel-clef-change'
  )
    return state;
  if (action.type === 'clef-keyboard') {
    if (
      state.activeTool.kind !== 'place-clef' ||
      state.pendingHistory ||
      state.lyricMove
    )
      return state;
    const order = deriveScoreOrder(state.history.present);
    if (!order) return state;
    const cursor = state.keyboardClefPlacement ?? {
      boundary: scoreBoundaryAt(order, 0),
      staffLine: 3 as const,
    };
    const resolved = resolveScoreBoundary(
      state.history.present,
      cursor.boundary,
    );
    if (!resolved)
      return announce(
        { ...state, keyboardClefPlacement: null },
        'Placement target changed. Start keyboard placement again.',
      );
    let index = resolved.scoreIndex;
    if (action.command === 'previous') index = Math.max(0, index - 1);
    if (action.command === 'next') index = Math.min(order.length, index + 1);
    if (action.command === 'first') index = 0;
    if (action.command === 'last') index = order.length;
    const line =
      cursor.staffLine +
      (action.command === 'up' ? 1 : action.command === 'down' ? -1 : 0);
    const staffLine =
      line === 1 || line === 2 || line === 3 || line === 4
        ? line
        : cursor.staffLine;
    return announce(
      {
        ...state,
        keyboardClefPlacement: {
          boundary: scoreBoundaryAt(order, index),
          staffLine,
        },
        hoveredPoint: null,
        focusRequest: { kind: 'clef-placement' },
      },
      `${state.activeTool.clefType.toUpperCase()} clef, line ${staffLine}. ${index === order.length ? 'End of score' : 'Before ' + (order[index].type === 'clef' ? 'an authored clef' : 'a ' + order[index].type)}. Left/Right chooses a slot; Up/Down chooses a line; Enter inserts.`,
    );
  }
  if (action.type === 'place-clef') {
    if (
      state.activeTool.kind !== 'place-clef' ||
      state.activeTool.clefType !== action.clefType ||
      state.pendingHistory ||
      state.lyricMove
    )
      return state;
    const layout = layoutChant(state.history.present, action.measureLyrics);
    const placement = action.point
      ? resolveGraphicalClefPlacement(layout, action.clefType, action.point)
      : state.keyboardClefPlacement
        ? resolveKeyboardClefPlacement(
            layout,
            action.clefType,
            state.keyboardClefPlacement,
          )
        : null;
    if (
      !placement ||
      insertClefChangeCandidate(
        state.history.present,
        {
          id: action.id,
          clef: placement.clef,
          beforeNeumeId: placement.boundary.beforeNeumeId,
          beforeDivisionId: placement.boundary.beforeDivisionId,
        },
        placement.boundary,
      ) === state.history.present
    )
      return state;
    const pending: EditorSession = {
      ...state,
      hoveredPoint: null,
      clefTransaction: {
        original: state.history.present,
        previousSelection: state.selection,
        id: action.id,
        boundary: placement.boundary,
        clef: placement.clef,
        candidate: null,
        placementTool: state.activeTool,
      },
    };
    return reduceEditorSession(pending, { type: 'apply-clef-change' });
  }
  if (action.type === 'lyric-move') {
    const move = state.lyricMove;
    const intent = action.action;
    if (state.pendingHistory) return state;
    if (intent.type === 'start') {
      if (
        move ||
        !state.history.present.syllables.some((s) => s.id === intent.syllableId)
      )
        return state;
      // Done uses the established commit-on-navigation policy, including stale recovery.
      const resolved = state.lyrics
        ? applyLyrics(state, { type: 'done' }, intent.newId)
        : state;
      if (resolved.lyrics) return resolved;
      const syllable = resolved.history.present.syllables.find(
        (s) => s.id === intent.syllableId,
      );
      if (!syllable) return state;
      const previousLyrics = state.lyrics
        ? reconcileLyricEntry(
            resolved.history.present,
            state.lyrics.kind === 'draft'
              ? state.lyrics.original || state.lyrics.text !== ''
                ? {
                    kind: 'selected',
                    syllableId: state.lyrics.original?.id ?? intent.newId,
                  }
                : state.lyrics
              : state.lyrics,
          )
        : null;
      const anchorNote = findNeume(
        resolved.history.present,
        syllable.startsAtNeumeId,
      )?.neume.notes[0];
      return announce(
        {
          ...resolved,
          lyrics: previousLyrics,
          lyricMove: {
            syllableId: syllable.id,
            candidateId: syllable.startsAtNeumeId,
            previousLyrics,
            previousSelection: state.selection,
          },
          selection: selectSyllable(syllable.id),
          activeTool: selectTool(),
          hoveredPoint: null,
          focusRequest: anchorNote
            ? { kind: 'note', noteId: anchorNote.id }
            : null,
        },
        `${resolved.announcement !== state.announcement ? resolved.announcement.text + ' ' : ''}Moving ${syllable.text} from neume ${resolved.history.present.neumes.findIndex((n) => n.id === syllable.startsAtNeumeId) + 1}. Click a highlighted destination to move immediately, or use Previous/Next or Left/Right then Enter. Escape cancels.`,
      );
    }
    if (!move) return state;
    const document = state.history.present;
    const syllable = document.syllables.find((s) => s.id === move.syllableId);
    if (intent.type === 'cancel')
      return announce(
        {
          ...state,
          lyricMove: null,
          lyrics: reconcileLyricEntry(document, move.previousLyrics),
          selection: reconcileSelection(document, move.previousSelection),
          focusRequest: getSelectFocusRequest({
            ...state,
            selection: reconcileSelection(document, move.previousSelection),
          }),
        },
        'Move canceled. Anchor unchanged.',
      );
    if (intent.type === 'browse') {
      const targets = lyricMoveTargets(document, move.syllableId);
      const current = document.neumes.findIndex(
        (n) => n.id === move.candidateId,
      );
      const ordered = intent.direction === 1 ? targets : [...targets].reverse();
      const candidateId = ordered.find(
        (id) =>
          (document.neumes.findIndex((n) => n.id === id) - current) *
            intent.direction >
          0,
      );
      if (!candidateId)
        return announce(
          state,
          'No further legal destination in this direction.',
        );
      const note = findNeume(document, candidateId)?.neume.notes[0];
      return announce(
        {
          ...state,
          lyricMove: { ...move, candidateId },
          focusRequest: note ? { kind: 'note', noteId: note.id } : null,
        },
        `Destination neume ${document.neumes.findIndex((n) => n.id === candidateId) + 1}. Enter moves ${syllable?.text ?? 'syllable'} here.`,
      );
    }
    const neumeId = intent.neumeId ?? move.candidateId;
    const next = reassignLyricSyllable(document, move.syllableId, neumeId);
    if (next === document) {
      const reason = !findNeume(document, neumeId)
        ? 'Destination no longer exists.'
        : syllable?.startsAtNeumeId === neumeId
          ? 'This is the current anchor; choose another destination.'
          : document.syllables.some((s) => s.startsAtNeumeId === neumeId)
            ? 'Destination already starts another syllable.'
            : 'Destination would cross a neighboring syllable anchor.';
      return announce(
        state,
        `${reason} Choose a highlighted neume, or Escape to cancel.`,
      );
    }
    return announce(
      {
        ...state,
        history: applyDocumentEdit(state.history, () => next),
        lyricMove: null,
        lyrics: reconcileLyricEntry(next, move.previousLyrics),
        selection: selectSyllable(move.syllableId),
        focusRequest: { kind: 'lyric', syllableId: move.syllableId },
      },
      `Moved ${syllable?.text ?? 'syllable'} to neume ${document.neumes.findIndex((n) => n.id === neumeId) + 1}.`,
    );
  }
  // Temporary reassignment owns editing until explicit commit or cancellation.
  if (state.lyricMove && action.type !== 'focus-handled') return state;
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
  if (action.type === 'start-lyrics-at-focus') {
    const document = state.history.present;
    const target = action.target;
    const neumeId =
      target.kind === 'note'
        ? findNote(document, target.noteId)?.neume.id
        : document.syllables.find((s) => s.id === target.syllableId)
            ?.startsAtNeumeId;
    if (!neumeId || !findNeume(document, neumeId)) return state;
    let next = applyLyrics(
      state,
      { type: state.lyrics ? 'navigate' : 'start', neumeId },
      action.newId,
    );
    // Explicit L expresses editing intent; sequential navigation still pauses.
    if (next.lyrics?.kind === 'occupied')
      next = applyLyrics(
        next,
        { type: 'edit', syllableId: next.lyrics.syllableId },
        action.newId,
      );
    // Mode activation uses focus as context, not as an implicit selection command.
    return {
      ...next,
      selection: reconcileSelection(next.history.present, state.selection),
    };
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
        focusedDivisionId: action.focusedDivisionId,
      },
      focusRequest: null,
    };
  if (
    ((action.type === 'arm' && action.tool.kind !== 'place-clef') ||
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
