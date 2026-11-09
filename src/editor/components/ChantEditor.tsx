import { DocumentControls } from './DocumentControls';
import { usePersistedSession } from '../persistence/use-persisted-session';
import { isDirtyLyricEntry } from '../state/lyric-entry';
import {
  resolveGraphicalClefPlacement,
  resolveKeyboardClefPlacement,
  layoutClefDraftPreview,
} from '../interaction/resolve-graphical-clef-placement';
import { ClefChangeControls } from './ClefChangeControls';
import { isValidClef } from '../domain/clef';
import { isPlacementTool } from '../state/editor-tool';
import { buildDivisionGeometry } from '../layout/division-geometry';
import { resolveScoreSlot } from '../interaction/resolve-score-slot';
import { isDivisionKind } from '../domain/divisions';
import type { DivisionKind } from '../domain/chant-document';
import { useLyricMeasurement } from '../rendering/use-lyric-measurement';
import {
  updateLyricLanguage,
  updateLyricAlignment,
} from '../commands/update-lyric-alignment';
import { lyricLanguage } from '../domain/lyric-alignment';
import { isLyricEntryShortcut } from '../interaction/lyric-entry-keyboard';
import type { LyricAction } from '../state/lyric-entry';
import { findNeume, findNote } from '../domain/neume';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { deleteNeume } from '../commands/delete-neume';
import { deleteNote } from '../commands/delete-note';
import { moveNeumeVertically } from '../commands/move-neume';
import { moveNoteVertically } from '../commands/move-note';
import { SyllableControls } from './SyllableControls';
import { type ChantDocument } from '../domain/chant-document';
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import type { InsertionIds } from '../interaction/insert-editor-neume';
import {
  getNotationShortcut,
  nextPaletteTool,
  paletteTools,
  type PaletteTool,
} from '../interaction/palette-navigation';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import {
  layoutChant,
  staffLineSpacing,
  type GraphicalNeumeKind,
} from '../layout/layout-chant';
import { ScoreSvg, type SvgPoint } from '../rendering/ScoreSvg';
import { focusAndReveal } from '../rendering/focus-visibility';
import { neumeName, lyricMoveTargets } from '../state/editor-session';
import {
  placeClimacusTool,
  placeClivisTool,
  placePodatusTool,
  placePorrectusTool,
  placePunctumTool,
  placeScandicusTool,
  placeTorculusTool,
} from '../state/editor-tool';
import { clearSelection, selectNeume, selectNote } from '../state/selection';

interface ChantEditorProps {
  document: ChantDocument;
}

const neumeTools = [
  { kind: 'punctum', tool: placePunctumTool },
  { kind: 'podatus', tool: placePodatusTool },
  { kind: 'clivis', tool: placeClivisTool },
  { kind: 'scandicus', tool: placeScandicusTool },
  { kind: 'torculus', tool: placeTorculusTool },
  { kind: 'climacus', tool: placeClimacusTool },
  { kind: 'porrectus', tool: placePorrectusTool },
] as const;

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function getFocusedScoreNoteId() {
  const focused = globalThis.document.activeElement;
  return focused instanceof Element
    ? (focused.closest<SVGGElement>('[data-note-id]')?.dataset.noteId ?? null)
    : null;
}

function allocateInsertionIds(): InsertionIds {
  return {
    neumeId: crypto.randomUUID(),
    noteIds: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  };
}

export function ChantEditor({ document: initialDocument }: ChantEditorProps) {
  const persistence = usePersistedSession(initialDocument);
  const { session, dispatch } = persistence;
  const { history, selection, activeTool, rememberedKind } = session;
  const paletteButtons = useRef(new Map<PaletteTool, HTMLButtonElement>());
  const [rovingTool, setRovingTool] = useState<PaletteTool>('select');
  // Presentation-only browser focus; never dispatch a semantic selection on Tab.
  const [divisionKind, setDivisionKind] = useState<DivisionKind>('minima');
  const [focusedDivisionId, setFocusedDivisionId] = useState<string | null>(
    null,
  );
  const [focusedLyricId, setFocusedLyricId] = useState<string | null>(null);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const measureLyrics = useLyricMeasurement([
    '-',
    ...history.present.syllables.map((s) => s.text),
  ]);
  const layout = layoutChant(history.present, measureLyrics);
  const selectedSyllable =
    selection.kind === 'syllable'
      ? history.present.syllables.find((s) => s.id === selection.syllableId)
      : null;
  const selectedNeume =
    selection.kind === 'note'
      ? findNote(history.present, selection.noteId)?.neume
      : selection.kind === 'neume'
        ? findNeume(history.present, selection.neumeId)?.neume
        : selectedSyllable
          ? findNeume(history.present, selectedSyllable.startsAtNeumeId)?.neume
          : null;
  const selectedDivision =
    selection.kind === 'division'
      ? history.present.divisions.find((d) => d.id === selection.divisionId)
      : null;
  const divisionTarget =
    history.present.divisions.find((d) => d.id === focusedDivisionId) ??
    selectedDivision;
  const placing = isPlacementTool(activeTool);
  const divisionSlot =
    activeTool.kind === 'place-division' && session.hoveredPoint
      ? resolveScoreSlot(layout, session.hoveredPoint)
      : null;
  const divisionPreview =
    divisionSlot && activeTool.kind === 'place-division'
      ? {
          division: buildDivisionGeometry(
            {
              id: 'preview',
              kind: activeTool.divisionKind,
              beforeNeumeId: null,
            },
            divisionSlot.slot.x,
            divisionSlot.bottom - 12,
            staffLineSpacing,
          ),
          caret: {
            x: divisionSlot.slot.x,
            top: divisionSlot.top,
            bottom: divisionSlot.bottom,
          },
        }
      : null;
  const placementKind = getGraphicalNeumeKind(activeTool);
  const placementPreview =
    placementKind && session.hoveredPoint
      ? (resolveGraphicalNeumePlacement(
          layout,
          placementKind,
          session.hoveredPoint,
        )?.preview ?? null)
      : null;
  const clefPlacement =
    activeTool.kind === 'place-clef' && !session.clefTransaction
      ? session.hoveredPoint
        ? resolveGraphicalClefPlacement(
            layout,
            activeTool.clefType,
            session.hoveredPoint,
          )
        : session.keyboardClefPlacement
          ? resolveKeyboardClefPlacement(
              layout,
              activeTool.clefType,
              session.keyboardClefPlacement,
            )
          : null
      : null;
  const draftTransaction = session.clefTransaction;
  const clefDraftPreview =
    draftTransaction &&
    !draftTransaction.boundary &&
    !draftTransaction.candidate
      ? layoutClefDraftPreview(
          layout,
          draftTransaction.id,
          draftTransaction.clef,
        )
      : null;
  const placementDescription = placementKind
    ? `${neumeName(placementKind)}. Escape selects the editing tool.`
    : activeTool.kind === 'place-division'
      ? `${activeTool.divisionKind} division. Click a caret slot to insert. Escape selects the editing tool.`
      : activeTool.kind === 'place-clef'
        ? `${activeTool.clefType.toUpperCase()} clef. ${session.clefInsertionPolicy === 'melody' ? 'Keep pitches (move existing notes)' : 'Keep note positions (change pitches)'}. Hover and click a score slot; height snaps to a staff line. For keyboard placement, Left/Right chooses a slot, Up/Down a line, Enter inserts. Escape returns to Select.`
        : '';
  // Some background Firefox sessions expose activeElement changes without
  // focus events. Reconcile presentation after our focus requests and keyup too.
  function syncNotationFocus() {
    const target = globalThis.document.activeElement;
    if (target instanceof Element && target.closest('.score'))
      setFocusedDivisionId(
        target
          .closest('[data-division-id]')
          ?.getAttribute('data-division-id') ?? null,
      );
  }

  const lyricAction = useCallback(
    (action: LyricAction) => {
      dispatch({ type: 'lyrics', action, newId: crypto.randomUUID() });
    },
    [dispatch],
  );

  const navigateHistory = useCallback(
    (direction: 'undo' | 'redo') => {
      dispatch({
        type: 'history',
        direction,
        focusedNoteId: getFocusedScoreNoteId(),
        focusedDivisionId:
          globalThis.document.activeElement?.getAttribute('data-division-id') ??
          focusedDivisionId,
      });
    },
    [focusedDivisionId, dispatch],
  );

  function handlePlaceNeume(kind: GraphicalNeumeKind, point: SvgPoint) {
    // Invalid pointer intent allocates no IDs. The reducer resolves again against
    // its latest document to serialize even several clicks in the same React batch.
    if (!resolveGraphicalNeumePlacement(layout, kind, point)) return;
    dispatch({
      type: 'place',
      kind,
      point,
      measureLyrics,
      ids: allocateInsertionIds(),
    });
  }

  useLayoutEffect(() => {
    const request = session.focusRequest;
    if (request?.kind !== 'palette') return;
    const button = paletteButtons.current.get(request.tool);
    if (button) focusAndReveal(button);
    dispatch({ type: 'focus-handled', request });
  }, [session.focusRequest, dispatch]);

  function insertRememberedNeume(divisionSide?: {
    divisionId: string;
    side: 'before' | 'after';
  }) {
    dispatch({
      type: 'insert',
      divisionSide,
      ids: allocateInsertionIds(),
      lyricCommitId: crypto.randomUUID(),
    });
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (isEditableTarget(event.target)) return;
      const notationFocused =
        event.target instanceof Element &&
        !!event.target.closest('[data-notation-shortcuts], .score');
      if (
        isLyricEntryShortcut(
          event,
          event.target instanceof Element &&
            Boolean(event.target.closest('.score')),
          placing,
        )
      ) {
        event.preventDefault();
        const target = event.target instanceof Element ? event.target : null;
        const noteId =
          target?.closest<SVGGElement>('[data-note-id]')?.dataset.noteId;
        const syllableId = target?.closest<SVGTextElement>(
          '.score__lyric[data-syllable-id]',
        )?.dataset.syllableId;
        if (noteId) {
          dispatch({
            type: 'start-lyrics-at-focus',
            target: { kind: 'note', noteId },
            newId: crypto.randomUUID(),
          });
        } else if (syllableId) {
          dispatch({
            type: 'start-lyrics-at-focus',
            target: { kind: 'syllable', syllableId },
            newId: crypto.randomUUID(),
          });
        } else {
          lyricAction({ type: 'start', neumeId: selectedNeume?.id ?? null });
        }
        return;
      }
      const shortcut = getNotationShortcut(event, notationFocused);
      if (shortcut) {
        event.preventDefault();
        if (shortcut === 'insert') {
          const target = event.target instanceof Element ? event.target : null;
          const divisionId = target
            ?.closest('[data-division-id]')
            ?.getAttribute('data-division-id');
          const clefChangeId = target
            ?.closest('[data-clef-change-id]')
            ?.getAttribute('data-clef-change-id');
          if (divisionId || clefChangeId)
            dispatch({
              type: 'select',
              selection: clefChangeId
                ? { kind: 'clef-change', clefChangeId }
                : { kind: 'division', divisionId: divisionId ?? '' },
            });
          dispatch({
            type: 'insert',
            ids: allocateInsertionIds(),
            lyricCommitId: crypto.randomUUID(),
          });
        } else dispatch({ type: 'focus-palette' });
        return;
      }
      if (
        event.key === 'Escape' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (activeTool.kind === 'place-clef') {
          dispatch({ type: 'select-tool' });
          return;
        }
        if (session.lyrics) {
          lyricAction({ type: 'cancel' });
          return;
        }
        dispatch(
          placing
            ? { type: 'select-tool' }
            : { type: 'select', selection: clearSelection() },
        );
        return;
      }
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (command && key === 'z' && !event.shiftKey && canUndo) {
        event.preventDefault();
        navigateHistory('undo');
      } else if (
        ((command && key === 'z' && event.shiftKey) ||
          (event.ctrlKey && key === 'y')) &&
        canRedo
      ) {
        event.preventDefault();
        navigateHistory('redo');
      }
    }
    // Pending clef cancellation owns Escape before native lyric/input handlers.
    function cancelClefOnEscape(event: KeyboardEvent) {
      if (
        session.clefTransaction &&
        event.key === 'Escape' &&
        !event.isComposing &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        dispatch({ type: 'cancel-clef-change' });
      }
    }
    document.addEventListener('keydown', cancelClefOnEscape, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', cancelClefOnEscape, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [
    dispatch,
    lyricAction,
    placementKind,
    activeTool.kind,
    navigateHistory,
    placing,
    canUndo,
    canRedo,
    session.lyrics,
    session.clefTransaction,
    history.present,
    selectedNeume,
  ]);

  return (
    <main
      className="chant-editor"
      onKeyUpCapture={syncNotationFocus}
      onKeyDownCapture={(event) => {
        if (
          !session.lyricMove ||
          event.nativeEvent.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        const key = event.key;
        const scoreFocused =
          event.target instanceof Element &&
          Boolean(event.target.closest('.score'));
        if (
          key === 'Escape' ||
          key === 'ArrowLeft' ||
          key === 'ArrowRight' ||
          (key === 'Enter' && scoreFocused)
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat)
            dispatch({
              type: 'lyric-move',
              action:
                key === 'Escape'
                  ? { type: 'cancel' }
                  : key === 'Enter'
                    ? { type: 'commit' }
                    : {
                        type: 'browse',
                        direction: key === 'ArrowLeft' ? -1 : 1,
                      },
            });
        }
      }}
      onFocusCapture={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('.score'))
          setFocusedDivisionId(target.getAttribute('data-division-id'));
        setFocusedLyricId(
          target instanceof Element && target.matches('.score__lyric')
            ? target.getAttribute('data-syllable-id')
            : null,
        );
      }}
      onBlurCapture={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setFocusedLyricId(null);
      }}
    >
      <h1>{layout.title}</h1>
      <label>
        Lyric language{' '}
        <select
          aria-label="Lyric language"
          value={lyricLanguage(history.present.lyricLanguage)}
          disabled={
            Boolean(session.lyricMove) || Boolean(session.pendingHistory)
          }
          onChange={(event) => {
            const language = lyricLanguage(event.currentTarget.value);
            dispatch({
              type: 'engraving-edit',
              edit: (doc) => updateLyricLanguage(doc, language),
            });
          }}
        >
          <option value="la">Latin</option>
          <option value="en">English</option>
          <option value="el">Greek</option>
          <option value="und">Unspecified</option>
        </select>
      </label>
      <p>
        Alignment follows the lyric language. Manual segments take precedence.
        Lyrics provide minimum spacing between neumes. Oversized syllables can
        be viewed by scrolling the score.
      </p>
      <div
        className="neume-palette"
        role="toolbar"
        aria-label="Notation tools"
        aria-describedby="palette-instructions"
        data-notation-shortcuts
        onKeyDown={(event) => {
          if (
            event.nativeEvent.isComposing ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          const focusedTool =
            event.target instanceof Element
              ? event.target.closest<HTMLButtonElement>('button')?.dataset.tool
              : undefined;
          const current = paletteTools.find((tool) => tool === focusedTool);
          const next = current && nextPaletteTool(current, event.key);
          if (!next) return;
          event.preventDefault();
          const button = paletteButtons.current.get(next);
          if (button) focusAndReveal(button);
        }}
      >
        {paletteTools.map((tool) => (
          <button
            key={tool}
            type="button"
            data-tool={tool}
            disabled={Boolean(
              session.lyricMove ||
              session.pendingHistory ||
              session.clefTransaction,
            )}
            ref={(button) => {
              if (button) paletteButtons.current.set(tool, button);
              else paletteButtons.current.delete(tool);
            }}
            tabIndex={rovingTool === tool ? 0 : -1}
            aria-pressed={
              tool === 'select'
                ? !placing
                : tool === 'c-clef' || tool === 'f-clef'
                  ? activeTool.kind === 'place-clef' &&
                    activeTool.clefType === tool[0]
                  : placementKind === tool
            }
            onFocus={() => setRovingTool(tool)}
            onClick={() => {
              if (tool === 'select') dispatch({ type: 'select-tool' });
              else if (tool === 'c-clef' || tool === 'f-clef')
                dispatch({
                  type: 'arm',
                  tool: {
                    kind: 'place-clef',
                    clefType: tool === 'c-clef' ? 'c' : 'f',
                  },
                });
              else {
                const choice = neumeTools.find(
                  (choice) => choice.kind === tool,
                );
                if (choice)
                  dispatch({
                    type: 'arm',
                    tool: choice.tool(),
                    lyricCommitId: crypto.randomUUID(),
                  });
              }
            }}
          >
            {tool === 'select'
              ? 'Select'
              : tool === 'c-clef'
                ? 'C clef'
                : tool === 'f-clef'
                  ? 'F clef'
                  : neumeName(tool)}
          </button>
        ))}
      </div>
      {activeTool.kind === 'place-clef' ||
      session.selection.kind === 'clef-change' ||
      session.clefTransaction ? (
        <fieldset
          className="clef-insertion-behavior"
          disabled={Boolean(
            session.clefTransaction?.candidate ||
            session.pendingHistory ||
            session.lyricMove,
          )}
          aria-describedby="clef-insertion-description"
        >
          <legend>Pitch handling</legend>
          <label>
            <input
              type="radio"
              name="clef-insertion-policy"
              value="melody"
              checked={session.clefInsertionPolicy === 'melody'}
              onChange={() =>
                dispatch({ type: 'clef-insertion-policy', preserve: 'melody' })
              }
            />
            Keep pitches (move existing notes)
          </label>
          <label>
            <input
              type="radio"
              name="clef-insertion-policy"
              value="noteheads"
              checked={session.clefInsertionPolicy === 'noteheads'}
              onChange={() =>
                dispatch({
                  type: 'clef-insertion-policy',
                  preserve: 'noteheads',
                })
              }
            />
            Keep note positions (change pitches)
          </label>
          <p id="clef-insertion-description">
            Keep pitches shifts existing noteheads to preserve their pitches.
            Keep note positions leaves noteheads in place and changes their
            interpreted pitches. Used for insertion and Apply when editing a
            clef.
          </p>
          {session.clefInsertionError ? (
            <p role="status">{session.clefInsertionError}</p>
          ) : null}
        </fieldset>
      ) : null}
      <p id="palette-instructions" className="editor-sr-only">
        Arrow keys browse tools; Enter or Space activates. I inserts the
        remembered neume. T focuses its palette button.
      </p>
      <fieldset
        disabled={Boolean(
          session.clefTransaction ||
          session.pendingHistory ||
          session.lyricMove,
        )}
      >
        <legend>Initial clef</legend>
        <label>
          Clef type{' '}
          <select
            aria-label="Initial clef type"
            value={history.present.clef.type}
            onChange={(event) => {
              const clef = {
                ...history.present.clef,
                type: event.target.value,
              };
              if (isValidClef(clef)) dispatch({ type: 'change-clef', clef });
            }}
          >
            <option value="c">C (do)</option>
            <option value="f">F (fa)</option>
          </select>
        </label>{' '}
        <label>
          Staff line (bottom to top){' '}
          <select
            aria-label="Initial clef staff line"
            value={history.present.clef.staffLine}
            onChange={(event) => {
              const clef = {
                ...history.present.clef,
                staffLine: Number(event.target.value),
              };
              if (isValidClef(clef)) dispatch({ type: 'change-clef', clef });
            }}
          >
            {[1, 2, 3, 4].map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </label>
        <p>
          Initial clef changes preserve the melody in the initial passage. In
          Select mode, focus the first clef and use ↑/↓ to change its line.
          Later systems repeat the effective clef at their semantic start.
        </p>
      </fieldset>
      <fieldset
        className="division-controls"
        disabled={Boolean(
          session.lyricMove ||
          session.pendingHistory ||
          session.clefTransaction,
        )}
      >
        <legend>Divisions</legend>
        <label>
          Placement kind{' '}
          <select
            aria-label="Division placement kind"
            value={divisionKind}
            onChange={(event) => {
              const kind = event.currentTarget.value;
              if (!isDivisionKind(kind)) return;
              setDivisionKind(kind);
              if (activeTool.kind === 'place-division')
                dispatch({
                  type: 'arm',
                  tool: { kind: 'place-division', divisionKind: kind },
                  lyricCommitId: crypto.randomUUID(),
                });
            }}
          >
            {(['minima', 'minor', 'maior', 'finalis'] as const).map((kind) => (
              <option key={kind} value={kind}>
                {neumeName(kind)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={activeTool.kind === 'place-division'}
          onClick={() =>
            dispatch({
              type: 'arm',
              tool: { kind: 'place-division', divisionKind },
              lyricCommitId: crypto.randomUUID(),
            })
          }
        >
          Place division
        </button>
        {divisionTarget ? (
          <div data-notation-shortcuts>
            <p>
              Division target: {divisionTarget.kind}.{' '}
              {focusedDivisionId === divisionTarget.id
                ? 'Last focused division'
                : 'Selected'}
              .
            </p>
            <label>
              Change division kind{' '}
              <select
                aria-label="Change division kind"
                value={divisionTarget.kind}
                disabled={placing}
                onChange={(event) => {
                  const kind = event.currentTarget.value;
                  if (isDivisionKind(kind))
                    dispatch({
                      type: 'change-division',
                      id: divisionTarget.id,
                      kind,
                    });
                }}
              >
                {(['minima', 'minor', 'maior', 'finalis'] as const).map(
                  (kind) => (
                    <option key={kind} value={kind}>
                      {neumeName(kind)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button
              type="button"
              disabled={placing}
              onClick={() =>
                insertRememberedNeume({
                  divisionId: divisionTarget.id,
                  side: 'before',
                })
              }
            >
              Insert {neumeName(rememberedKind)} before division
            </button>
            <button
              type="button"
              disabled={placing}
              onClick={() =>
                insertRememberedNeume({
                  divisionId: divisionTarget.id,
                  side: 'after',
                })
              }
            >
              Insert {neumeName(rememberedKind)} after division
            </button>
            <button
              type="button"
              disabled={placing}
              onClick={() =>
                dispatch({ type: 'delete-division', id: divisionTarget.id })
              }
            >
              Delete division
            </button>
          </div>
        ) : null}
      </fieldset>
      <div className="editor-actions">
        <button
          type="button"
          aria-pressed={Boolean(session.lyrics)}
          disabled={Boolean(
            session.lyricMove ||
            session.pendingHistory ||
            session.clefTransaction,
          )}
          aria-keyshortcuts="L"
          onClick={() =>
            lyricAction({ type: 'start', neumeId: selectedNeume?.id ?? null })
          }
        >
          Lyrics <kbd aria-hidden="true">L</kbd>
        </button>
        <button
          disabled={Boolean(
            session.lyricMove ||
            session.pendingHistory ||
            session.clefTransaction,
          )}
          className="editor-insert"
          type="button"
          data-notation-shortcuts
          aria-keyshortcuts="I"
          onClick={() => insertRememberedNeume()}
        >
          Insert {neumeName(rememberedKind)} <kbd aria-hidden="true">I</kbd>
        </button>
        <button
          type="button"
          aria-label="Undo last edit"
          aria-keyshortcuts="Control+Z Meta+Z"
          disabled={!canUndo || Boolean(session.lyricMove)}
          onClick={() => navigateHistory('undo')}
        >
          Undo
        </button>
        <button
          type="button"
          aria-label="Redo last undone edit"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          disabled={!canRedo || Boolean(session.lyricMove)}
          onClick={() => navigateHistory('redo')}
        >
          Redo
        </button>
      </div>
      <details className="editor-help">
        <summary>Keyboard help</summary>
        <p>
          <kbd>L</kbd> Lyrics · <kbd>I</kbd> insert · <kbd>T</kbd> tools ·{' '}
          <kbd>Esc</kbd> Select. In the palette, arrows browse and Enter/Space
          activates. In Select, Enter/Space selects a focused note, ↑/↓ changes
          pitch, and Shift+Enter/Space selects its neume. I/T apply only in
          notation controls. On the initial clef, Enter/Space selects and ↑/↓
          moves one staff line while preserving melody. On an authored clef, ↑/↓
          moves its draft one staff line per press, starting the draft on the
          first press and keeping focus in the score. Tab/Shift+Tab reaches the
          shared pitch mode and Apply/Cancel; Apply commits once, Escape
          cancels. Left/Right never move an existing clef.
        </p>
      </details>
      <DocumentControls
        document={history.present}
        blocked={Boolean(
          isDirtyLyricEntry(session.lyrics) ||
          session.clefTransaction ||
          session.lyricMove ||
          session.pendingHistory,
        )}
        status={persistence.status}
        needsRecovery={persistence.needsRecovery}
        replace={(document) => {
          persistence.replace(document);
          setRovingTool('select');
          setDivisionKind('minima');
          setFocusedDivisionId(null);
          setFocusedLyricId(null);
        }}
        reload={() => {
          if (persistence.reload()) {
            setRovingTool('select');
            setDivisionKind('minima');
            setFocusedDivisionId(null);
            setFocusedLyricId(null);
          }
        }}
        replaceCache={persistence.replaceCache}
      />
      <ClefChangeControls session={session} dispatch={dispatch} />
      {activeTool.kind === 'place-clef' ? (
        <div className="clef-placement-help">
          <span>{placementDescription}</span>{' '}
          <button
            type="button"
            disabled={!!session.clefTransaction}
            onClick={() =>
              dispatch({ type: 'clef-keyboard', command: 'start' })
            }
          >
            Place clef with keyboard
          </button>
        </div>
      ) : null}
      <div className="score-workspace">
        <div
          className="score-viewport"
          tabIndex={layout.width > 720 ? 0 : undefined}
          role={layout.width > 720 ? 'region' : undefined}
          aria-label={layout.width > 720 ? 'Scrollable score' : undefined}
        >
          <ScoreSvg
            clefPreview={clefPlacement?.preview ?? null}
            clefDraftPreview={clefDraftPreview}
            onPlaceClef={(point) => {
              if (
                activeTool.kind !== 'place-clef' ||
                (point &&
                  !resolveGraphicalClefPlacement(
                    layout,
                    activeTool.clefType,
                    point,
                  ))
              )
                return;
              dispatch({
                type: 'place-clef',
                clefType: activeTool.clefType,
                id: crypto.randomUUID(),
                point,
                measureLyrics,
              });
            }}
            onClefKeyboard={(command) =>
              dispatch({ type: 'clef-keyboard', command })
            }
            transactionBlocked={Boolean(session.clefTransaction)}
            onSelectClefChange={(clefChangeId) =>
              dispatch({
                type: 'select',
                selection: { kind: 'clef-change', clefChangeId },
              })
            }
            clefEdit={
              draftTransaction &&
              !draftTransaction.boundary &&
              !draftTransaction.candidate
                ? { id: draftTransaction.id, clef: draftTransaction.clef }
                : null
            }
            onStepClefChange={(id, direction) =>
              dispatch({ type: 'step-clef-change', id, direction })
            }
            onDeleteClefChange={(id) => {
              dispatch({ type: 'start-clef-change', id });
              dispatch({ type: 'apply-clef-change', remove: true });
            }}
            onSelectClef={() =>
              dispatch({ type: 'select', selection: { kind: 'clef' } })
            }
            onChangeClef={(clef) => dispatch({ type: 'change-clef', clef })}
            layout={layout}
            divisionPreview={divisionPreview}
            onSelectDivision={(divisionId) => {
              setFocusedDivisionId(divisionId);
              dispatch({
                type: 'select',
                selection: { kind: 'division', divisionId },
              });
            }}
            onDeleteDivision={(id) => dispatch({ type: 'delete-division', id })}
            onPlaceDivision={(point) => {
              if (
                activeTool.kind !== 'place-division' ||
                !resolveScoreSlot(layout, point)
              )
                return;
              dispatch({
                type: 'place-division',
                kind: activeTool.divisionKind,
                point,
                id: crypto.randomUUID(),
                measureLyrics,
              });
            }}
            lyricMove={
              session.lyricMove
                ? {
                    ...session.lyricMove,
                    anchorId:
                      history.present.syllables.find(
                        (s) => s.id === session.lyricMove?.syllableId,
                      )?.startsAtNeumeId ?? '',
                    legalIds: lyricMoveTargets(
                      history.present,
                      session.lyricMove.syllableId,
                    ),
                  }
                : null
            }
            onMoveDestination={(neumeId) =>
              dispatch({
                type: 'lyric-move',
                action: { type: 'commit', neumeId },
              })
            }
            onSelectSyllable={(syllableId) =>
              lyricAction({ type: 'select', syllableId })
            }
            onEditSyllable={(syllableId, replacement) =>
              lyricAction({ type: 'edit', syllableId, replacement })
            }
            onAdvanceLyric={(key) => lyricAction({ type: 'advance', key })}
            onDeleteSyllable={(syllableId) =>
              lyricAction({ type: 'delete', syllableId })
            }
            placementPreview={placementPreview}
            selection={selection}
            activeTool={activeTool}
            placementDescription={placementDescription}
            focusRequest={session.focusRequest}
            onFocusHandled={(request) => {
              syncNotationFocus();
              dispatch({ type: 'focus-handled', request });
            }}
            onSelectNote={(noteId) => {
              const note = findNote(history.present, noteId);
              if (session.lyrics && session.lyrics.kind !== 'recovery' && note)
                lyricAction({ type: 'navigate', neumeId: note.neume.id });
              else dispatch({ type: 'select', selection: selectNote(noteId) });
            }}
            onSelectNeumeForNote={(noteId) => {
              const note = findNote(history.present, noteId);
              if (
                note &&
                session.lyrics &&
                session.lyrics.kind !== 'recovery'
              ) {
                lyricAction({ type: 'navigate', neumeId: note.neume.id });
                return;
              }
              if (note)
                dispatch({
                  type: 'select',
                  selection: selectNeume(note.neume.id),
                  focusNoteId: noteId,
                });
            }}
            onPlacementPointerMove={(point) =>
              dispatch({ type: 'hover', point })
            }
            onPlacementPointerLeave={() =>
              dispatch({ type: 'hover', point: null })
            }
            onPlaceNeume={handlePlaceNeume}
            onMoveNote={(noteId, delta) =>
              dispatch({
                type: 'edit',
                edit: (document) => moveNoteVertically(document, noteId, delta),
                focusNoteId: noteId,
              })
            }
            onMoveNeume={(neumeId, delta, invokingNoteId) =>
              dispatch({
                type: 'edit',
                edit: (document) =>
                  moveNeumeVertically(document, neumeId, delta),
                focusNoteId: invokingNoteId,
              })
            }
            onDeleteNote={(noteId) =>
              dispatch({
                type: 'edit',
                edit: (document) => deleteNote(document, noteId),
                clearSelection: true,
              })
            }
            onDeleteNeume={(neumeId) =>
              dispatch({
                type: 'edit',
                edit: (document) => deleteNeume(document, neumeId),
                clearSelection: true,
              })
            }
            onClearSelection={() =>
              !session.lyrics &&
              dispatch({ type: 'select', selection: clearSelection() })
            }
          />
        </div>
        <SyllableControls
          onAlignment={(syllableId, range) =>
            dispatch({
              type: 'engraving-edit',
              edit: (doc) => updateLyricAlignment(doc, syllableId, range),
            })
          }
          document={history.present}
          layout={layout}
          entry={session.lyrics}
          lyricMove={session.lyricMove}
          onMove={(action) => dispatch({ type: 'lyric-move', action })}
          selectedSyllableId={
            selection.kind === 'syllable' ? selection.syllableId : null
          }
          selectedNeumeId={selectedNeume?.id ?? null}
          focusedSyllableId={focusedLyricId}
          focusRequest={session.focusRequest}
          pendingHistory={Boolean(session.pendingHistory)}
          onAction={lyricAction}
          onHistoryChoice={(choice) =>
            dispatch({
              type: 'resolve-history',
              choice,
              newId: crypto.randomUUID(),
            })
          }
          onFocusHandled={(request) =>
            dispatch({ type: 'focus-handled', request })
          }
        />
      </div>
      <div
        className="editor-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {session.announcement.sequence > 0 ? (
          <span key={session.announcement.sequence}>
            {session.announcement.text}
          </span>
        ) : null}
      </div>
    </main>
  );
}
