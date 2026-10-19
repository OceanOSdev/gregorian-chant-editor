import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { deleteNeume } from '../commands/delete-neume';
import { deleteNote } from '../commands/delete-note';
import { moveNeumeVertically } from '../commands/move-neume';
import { moveNoteVertically } from '../commands/move-note';
import { updateLyricSyllableText } from '../commands/update-lyric-syllable';
import { type ChantDocument } from '../domain/chant-document';
import { findNote } from '../domain/neume';
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import type { InsertionIds } from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { layoutChant, type GraphicalNeumeKind } from '../layout/layout-chant';
import { ScoreSvg, type SvgPoint } from '../rendering/ScoreSvg';
import { getSelectedLayoutContext } from '../rendering/placement-context';
import {
  createEditorSession,
  neumeName,
  reduceEditorSession,
  syllableDescription,
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
  { kind: 'porrectus', tool: placePorrectusTool },
  { kind: 'climacus', tool: placeClimacusTool },
] as const;

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['TEXTAREA', 'SELECT'].includes(target.tagName) ||
      (target instanceof HTMLInputElement &&
        !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(
          target.type,
        )))
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
  const { history, selection, activeTool, keepPlacing } = session;
  const [lyricDraft, setLyricDraft] = useState('');
  const [draftSyllableId, setDraftSyllableId] = useState<string | null>(null);
  const [committedLyricText, setCommittedLyricText] = useState('');
  const [pendingLyricInputFocus, setPendingLyricInputFocus] = useState(false);
  const skipNextLyricBlurCommit = useRef(false);
  const lyricInput = useRef<HTMLInputElement>(null);
  const contextStrip = useRef<HTMLDivElement>(null);
  const finishControl = useRef<HTMLButtonElement>(null);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const layout = layoutChant(history.present);
  const activeSyllable = history.present.syllables.find(
    (s) => s.id === session.activeSyllableId,
  );
  const placementKind = getGraphicalNeumeKind(activeTool);
  const placementPreview =
    placementKind && session.hoveredPoint
      ? (resolveGraphicalNeumePlacement(
          history.present,
          layout,
          activeSyllable?.id ?? null,
          placementKind,
          session.hoveredPoint,
        )?.preview ?? null)
      : null;
  const context = getSelectedLayoutContext(layout, selection);
  const target = syllableDescription(session);
  const placementDescription = placementKind
    ? `${neumeName(placementKind)}. Target ${target}. Keep placing ${keepPlacing ? 'on' : 'off'}. Escape finishes.`
    : '';
  const displayedLyricDraft =
    activeSyllable?.id === draftSyllableId
      ? lyricDraft
      : (activeSyllable?.text ?? '');

  function navigateHistory(direction: 'undo' | 'redo') {
    dispatch({
      type: 'history',
      direction,
      focusedNoteId: getFocusedScoreNoteId(),
    });
  }

  function commitLyricDraft(text: string) {
    if (!activeSyllable || draftSyllableId !== activeSyllable.id) return;
    dispatch({
      type: 'edit',
      edit: (document) =>
        updateLyricSyllableText(document, activeSyllable.id, text),
    });
    setLyricDraft(text);
    setCommittedLyricText(text);
  }

  function handleLyricKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitLyricDraft(event.currentTarget.value);
      return;
    }
    if (event.key !== 'Escape' || !activeSyllable) return;
    event.preventDefault();
    event.stopPropagation();
    skipNextLyricBlurCommit.current = true;
    setLyricDraft(committedLyricText);
    setDraftSyllableId(activeSyllable.id);
  }

  function handlePlaceNeume(kind: GraphicalNeumeKind, point: SvgPoint) {
    // Invalid pointer intent allocates no IDs. The reducer resolves again against
    // its latest document to serialize even several clicks in the same React batch.
    if (
      !resolveGraphicalNeumePlacement(
        history.present,
        layout,
        session.activeSyllableId,
        kind,
        point,
      )
    )
      return;
    dispatch({ type: 'place', kind, point, ids: allocateInsertionIds() });
  }

  useEffect(() => {
    setLyricDraft(activeSyllable?.text ?? '');
    setDraftSyllableId(activeSyllable?.id ?? null);
    setCommittedLyricText(activeSyllable?.text ?? '');
    skipNextLyricBlurCommit.current = false;
  }, [activeSyllable?.id, activeSyllable?.text]);

  useEffect(() => {
    if (!pendingLyricInputFocus || !activeSyllable) return;
    lyricInput.current?.focus();
    setPendingLyricInputFocus(false);
  }, [activeSyllable, pendingLyricInputFocus]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.isComposing || isEditableTarget(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dispatch(
          placementKind
            ? { type: 'finish' }
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
      <div className="editor-controls" aria-label="Editor controls">
        {neumeTools.map(({ kind }) => (
          <button
            key={`add-${kind}`}
            type="button"
            aria-label={`Add ${kind}`}
            disabled={!activeSyllable}
            onClick={() =>
              dispatch({ type: 'insert', kind, ids: allocateInsertionIds() })
            }
          >
            Add {kind}
          </button>
        ))}
        {neumeTools.map(({ kind, tool }) => (
          <button
            key={`place-${kind}`}
            type="button"
            aria-label={`Place ${kind}`}
            aria-pressed={placementKind === kind}
            disabled={!activeSyllable}
            onClick={() => dispatch({ type: 'arm', tool: tool() })}
          >
            Place {kind}
          </button>
        ))}
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
      <section className="editor-lyrics" aria-labelledby="lyrics-heading">
        <h2 id="lyrics-heading">Lyrics</h2>
        <ol>
          {history.present.syllables.map((syllable, index) => (
            <li key={syllable.id}>
              <button
                type="button"
                aria-label={`Syllable ${index + 1}: ${syllable.text || 'empty'}`}
                aria-pressed={syllable.id === activeSyllable?.id}
                onClick={() => dispatch({ type: 'syllable', id: syllable.id })}
              >
                <span aria-hidden="true">{index + 1}. </span>
                {syllable.text || '(empty)'}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => {
            dispatch({
              type: 'add-syllable',
              syllable: { id: crypto.randomUUID(), text: '' },
            });
            setPendingLyricInputFocus(true);
          }}
        >
          Add syllable
        </button>
      </section>
      <section className="editor-properties" aria-label="Properties">
        <label htmlFor="lyric-syllable">Lyric syllable</label>
        <input
          ref={lyricInput}
          id="lyric-syllable"
          type="text"
          value={displayedLyricDraft}
          disabled={!activeSyllable}
          onChange={(event) => {
            skipNextLyricBlurCommit.current = false;
            setLyricDraft(event.currentTarget.value);
            setDraftSyllableId(activeSyllable?.id ?? null);
          }}
          onKeyDown={handleLyricKeyDown}
          onBlur={(event) => {
            if (skipNextLyricBlurCommit.current) {
              skipNextLyricBlurCommit.current = false;
              return;
            }
            commitLyricDraft(event.currentTarget.value);
          }}
        />
      </section>
      <div className="editor-score-workspace">
        <div
          className="editor-context"
          ref={contextStrip}
          role="group"
          aria-label="Editing context"
        >
          <div className="editor-context__summary">
            <strong>
              Tool:{' '}
              {placementKind
                ? `Placing ${neumeName(placementKind)}`
                : 'Select/Edit'}
            </strong>
            <span>
              {activeSyllable
                ? `${placementKind ? 'Target' : 'Active'} ${target}`
                : 'No target syllable'}
            </span>
            <span>Repetition: {keepPlacing ? 'On' : 'Off'}</span>
            {placementKind ? (
              <span className="editor-context__location">
                {context
                  ? `Placement context: system ${context.systemIndex + 1}`
                  : ''}
              </span>
            ) : null}
          </div>
          <label className="editor-context__repeat">
            <input
              type="checkbox"
              checked={keepPlacing}
              onChange={(event) =>
                dispatch({ type: 'repeat', value: event.currentTarget.checked })
              }
            />
            Keep placing
            <span className="editor-context__small">Graphical entry only</span>
          </label>
          <button
            ref={finishControl}
            type="button"
            onClick={() => dispatch({ type: 'finish' })}
          >
            {placementKind ? 'Finish placing' : 'Select/Edit'}
          </button>
          {placementKind ? (
            <p className="editor-context__help">
              Staff clicks insert into this syllable.{' '}
              {keepPlacing
                ? 'Stays active after each insertion.'
                : 'Returns to Select/Edit after one insertion.'}{' '}
              Finish placing or press Escape to edit notes.
            </p>
          ) : null}
        </div>
        <ScoreSvg
          layout={layout}
          placementPreview={placementPreview}
          selection={selection}
          activeTool={activeTool}
          placementDescription={placementDescription}
          focusRequest={session.focusRequest}
          contextStrip={contextStrip}
          finishControl={finishControl}
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
