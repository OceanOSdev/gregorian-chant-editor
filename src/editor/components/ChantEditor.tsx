import { findNeume, findNote } from '../domain/neume';
import { findSyllableAtNeume } from '../domain/lyrics';
import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { deleteNeume } from '../commands/delete-neume';
import { deleteNote } from '../commands/delete-note';
import { moveNeumeVertically } from '../commands/move-neume';
import { moveNoteVertically } from '../commands/move-note';
import { updateLyricSyllableText } from '../commands/update-lyric-syllable';
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
import { layoutChant, type GraphicalNeumeKind } from '../layout/layout-chant';
import { ScoreSvg, type SvgPoint } from '../rendering/ScoreSvg';
import { focusAndReveal } from '../rendering/focus-visibility';
import {
  createEditorSession,
  neumeName,
  reduceEditorSession,
} from '../state/editor-session';
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
  const [session, dispatch] = useReducer(
    reduceEditorSession,
    initialDocument,
    createEditorSession,
  );
  const { history, selection, activeTool, rememberedKind } = session;
  const paletteButtons = useRef(new Map<PaletteTool, HTMLButtonElement>());
  const [rovingTool, setRovingTool] = useState<PaletteTool>('select');
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const layout = layoutChant(history.present);
  const selectedNeume =
    selection.kind === 'note'
      ? findNote(history.present, selection.noteId)?.neume
      : selection.kind === 'neume'
        ? findNeume(history.present, selection.neumeId)?.neume
        : null;
  const lyricTarget =
    selectedNeume && !findSyllableAtNeume(history.present, selectedNeume.id)
      ? selectedNeume
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
  const placementDescription = placementKind
    ? `${neumeName(placementKind)}. Escape selects the editing tool.`
    : '';
  function navigateHistory(direction: 'undo' | 'redo') {
    dispatch({
      type: 'history',
      direction,
      focusedNoteId: getFocusedScoreNoteId(),
    });
  }

  function handlePlaceNeume(kind: GraphicalNeumeKind, point: SvgPoint) {
    // Invalid pointer intent allocates no IDs. The reducer resolves again against
    // its latest document to serialize even several clicks in the same React batch.
    if (!resolveGraphicalNeumePlacement(layout, kind, point)) return;
    dispatch({ type: 'place', kind, point, ids: allocateInsertionIds() });
  }

  useLayoutEffect(() => {
    const request = session.focusRequest;
    if (request?.kind !== 'palette') return;
    const button = paletteButtons.current.get(request.tool);
    if (button) focusAndReveal(button);
    dispatch({ type: 'focus-handled', request });
  }, [session.focusRequest]);

  function insertRememberedNeume() {
    dispatch({ type: 'insert', ids: allocateInsertionIds() });
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        isEditableTarget(event.target)
      )
        return;
      const notationFocused =
        event.target instanceof Element &&
        !!event.target.closest('[data-notation-shortcuts], .score');
      const shortcut = getNotationShortcut(event, notationFocused);
      if (shortcut) {
        event.preventDefault();
        if (shortcut === 'insert') {
          dispatch({ type: 'insert', ids: allocateInsertionIds() });
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
        dispatch(
          placementKind
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
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [placementKind, canUndo, canRedo]);

  return (
    <main className="chant-editor">
      <h1>{layout.title}</h1>
      <div
        className="neume-palette"
        role="toolbar"
        aria-label="Neume tools"
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
            ref={(button) => {
              if (button) paletteButtons.current.set(tool, button);
              else paletteButtons.current.delete(tool);
            }}
            tabIndex={rovingTool === tool ? 0 : -1}
            aria-pressed={
              tool === 'select' ? !placementKind : placementKind === tool
            }
            onFocus={() => setRovingTool(tool)}
            onClick={() => {
              if (tool === 'select') dispatch({ type: 'select-tool' });
              else {
                const choice = neumeTools.find(
                  (choice) => choice.kind === tool,
                );
                if (choice) dispatch({ type: 'arm', tool: choice.tool() });
              }
            }}
          >
            {tool === 'select' ? 'Select' : neumeName(tool)}
          </button>
        ))}
      </div>
      <p id="palette-instructions" className="editor-sr-only">
        Arrow keys browse tools; Enter or Space activates. I inserts the
        remembered neume. T focuses its palette button.
      </p>
      <div className="editor-actions">
        <button
          className="editor-insert"
          type="button"
          data-notation-shortcuts
          aria-keyshortcuts="I"
          onClick={insertRememberedNeume}
        >
          Insert {neumeName(rememberedKind)} <kbd aria-hidden="true">I</kbd>
        </button>
        <button
          type="button"
          aria-label="Undo last edit"
          aria-keyshortcuts="Control+Z Meta+Z"
          disabled={!canUndo}
          onClick={() => navigateHistory('undo')}
        >
          Undo
        </button>
        <button
          type="button"
          aria-label="Redo last undone edit"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          disabled={!canRedo}
          onClick={() => navigateHistory('redo')}
        >
          Redo
        </button>
      </div>
      <SyllableControls
        syllables={history.present.syllables}
        activeId={session.activeSyllableId}
        canAdd={Boolean(lyricTarget)}
        onSelect={(id) => dispatch({ type: 'syllable', id })}
        onAdd={(text) => {
          if (!lyricTarget) return;
          dispatch({
            type: 'add-syllable',
            syllable: {
              id: crypto.randomUUID(),
              text,
              startsAtNeumeId: lyricTarget.id,
              boundaryBefore: 'word',
            },
          });
        }}
        onSave={(id, text) =>
          dispatch({
            type: 'edit',
            edit: (document) => updateLyricSyllableText(document, id, text),
          })
        }
      />
      <details className="editor-help">
        <summary>Keyboard help</summary>
        <p>
          <kbd>I</kbd> insert · <kbd>T</kbd> tools · <kbd>Esc</kbd> Select. In
          the palette, arrows browse and Enter/Space activates. In Select,
          Enter/Space selects a focused note, ↑/↓ changes pitch, and
          Shift+Enter/Space selects its neume. I/T apply only in notation
          controls.
        </p>
      </details>
      <ScoreSvg
        layout={layout}
        placementPreview={placementPreview}
        selection={selection}
        activeTool={activeTool}
        placementDescription={placementDescription}
        focusRequest={session.focusRequest}
        onFocusHandled={(request) =>
          dispatch({ type: 'focus-handled', request })
        }
        onSelectNote={(noteId) =>
          dispatch({ type: 'select', selection: selectNote(noteId) })
        }
        onSelectNeumeForNote={(noteId) => {
          const note = findNote(history.present, noteId);
          if (note)
            dispatch({
              type: 'select',
              selection: selectNeume(note.neume.id),
              focusNoteId: noteId,
            });
        }}
        onPlacementPointerMove={(point) => dispatch({ type: 'hover', point })}
        onPlacementPointerLeave={() => dispatch({ type: 'hover', point: null })}
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
            edit: (document) => moveNeumeVertically(document, neumeId, delta),
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
          dispatch({ type: 'select', selection: clearSelection() })
        }
      />
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
