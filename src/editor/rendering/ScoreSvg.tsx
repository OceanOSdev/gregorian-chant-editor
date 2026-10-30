import { getSyllableKeyAction } from '../interaction/lyric-entry-keyboard';
import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { StaffPositionDelta } from '../commands/move-note';
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import {
  type ChantLayout,
  type ChantSystemLayout,
  type GraphicalPlacementPreviewLayout,
  type GraphicalNeumeKind,
} from '../layout/layout-chant';
import { isPlacementTool, type EditorTool } from '../state/editor-tool';
import type { EditorSelection } from '../state/selection';
import type { EditorFocusRequest } from '../state/editor-session';
import { focusAndReveal } from './focus-visibility';
import {
  getNoteAccessibleLabel,
  getSelectedNeumeDescription,
  wholeNeumeSelectionInstruction,
} from './note-accessible-label';
import { getScoreAccessibleDescription } from './score-accessible-description';
import { InkShapeView, NeumeInk } from './NeumeInk';

export interface SvgPoint {
  x: number;
  y: number;
}

interface ScoreSvgProps {
  layout: ChantLayout;
  placementPreview: GraphicalPlacementPreviewLayout | null;
  selection: EditorSelection;
  activeTool: EditorTool;
  placementDescription: string;
  focusRequest: EditorFocusRequest | null;
  onFocusHandled: (request: EditorFocusRequest) => void;
  onSelectNote: (noteId: string) => void;
  onSelectNeumeForNote: (noteId: string) => void;
  onPlacementPointerMove: (point: SvgPoint) => void;
  onPlacementPointerLeave: () => void;
  onPlaceNeume: (kind: GraphicalNeumeKind, point: SvgPoint) => void;
  onMoveNote: (noteId: string, delta: StaffPositionDelta) => void;
  onMoveNeume: (
    neumeId: string,
    delta: StaffPositionDelta,
    invokingNoteId: string,
  ) => void;
  onDeleteNote: (noteId: string) => void;
  onDeleteNeume: (neumeId: string) => void;
  onClearSelection: () => void;
  onSelectSyllable: (id: string) => void;
  onEditSyllable: (id: string, replacement?: string) => void;
  onAdvanceLyric: (key: '-' | ' ' | '_') => void;
  onDeleteSyllable: (syllableId: string) => void;
}

export function ScoreSvg({
  layout,
  placementPreview,
  selection,
  activeTool,
  placementDescription,
  focusRequest,
  onFocusHandled,
  onSelectNote,
  onSelectNeumeForNote,
  onPlacementPointerMove,
  onPlacementPointerLeave,
  onPlaceNeume,
  onMoveNote,
  onMoveNeume,
  onDeleteNote,
  onDeleteNeume,
  onClearSelection,
  onSelectSyllable,
  onEditSyllable,
  onAdvanceLyric,
  onDeleteSyllable,
}: ScoreSvgProps) {
  const scoreElement = useRef<SVGSVGElement>(null);
  const lyricElements = useRef(new Map<string, SVGTextElement>());
  const noteElements = useRef(new Map<string, SVGGElement>());
  const placementActive = isPlacementTool(activeTool);
  useLayoutEffect(() => {
    if (
      !focusRequest ||
      focusRequest.kind === 'palette' ||
      focusRequest.kind === 'lyrics'
    )
      return;
    if (focusRequest.kind === 'lyric') {
      const lyric = lyricElements.current.get(focusRequest.syllableId);
      if (lyric && !placementActive) focusAndReveal(lyric);
      onFocusHandled(focusRequest);
      return;
    }
    const note = noteElements.current.get(focusRequest.noteId);
    if (
      focusRequest.kind === 'placement' &&
      placementActive &&
      note &&
      scoreElement.current
    ) {
      focusAndReveal(
        scoreElement.current,
        note.closest('[data-neume-id]') ?? note,
        note,
      );
    } else if (focusRequest.kind === 'note' && !placementActive && note) {
      focusAndReveal(note);
    }
    onFocusHandled(focusRequest);
  }, [focusRequest, onFocusHandled, placementActive]);

  function handleNoteClick(event: MouseEvent<SVGGElement>, noteId: string) {
    event.stopPropagation();
    if (placementActive) return;

    if (event.shiftKey) {
      onSelectNeumeForNote(noteId);
    } else {
      onSelectNote(noteId);
    }
  }

  function handleScoreClick(event: MouseEvent<SVGSVGElement>) {
    if (!isPlacementTool(activeTool)) {
      onClearSelection();
      return;
    }

    const localPoint = getLocalPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );

    if (!localPoint) {
      return;
    }

    const kind = getGraphicalNeumeKind(activeTool);

    if (kind) {
      onPlaceNeume(kind, localPoint);
    }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!isPlacementTool(activeTool)) {
      return;
    }

    const localPoint = getLocalPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );

    if (localPoint) {
      onPlacementPointerMove(localPoint);
    } else {
      onPlacementPointerLeave();
    }
  }

  function handleNoteKeyDown(
    event: KeyboardEvent<SVGGElement>,
    noteId: string,
    neumeId: string,
    isNoteSelected: boolean,
    isNeumeSelected: boolean,
  ) {
    if (isPlacementTool(activeTool) || event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        onSelectNeumeForNote(noteId);
      } else {
        onSelectNote(noteId);
      }

      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;

      if (isNoteSelected) {
        onDeleteNote(noteId);
      } else if (isNeumeSelected) {
        onDeleteNeume(neumeId);
      }

      return;
    }

    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    if (!isNoteSelected && !isNeumeSelected) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (isNoteSelected) {
      onMoveNote(noteId, event.key === 'ArrowUp' ? 1 : -1);
    } else if (isNeumeSelected) {
      onMoveNeume(neumeId, event.key === 'ArrowUp' ? 1 : -1, noteId);
    }
  }

  return (
    <svg
      ref={scoreElement}
      tabIndex={placementActive ? -1 : undefined}
      className={`score${placementActive ? ' score--placing' : ''}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label={placementActive ? 'Score placement' : undefined}
      aria-labelledby={
        placementActive ? undefined : 'score-title score-description'
      }
      aria-describedby={placementActive ? 'placement-description' : undefined}
      onClick={handleScoreClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onPlacementPointerLeave()}
    >
      {placementActive ? (
        <desc id="placement-description">{placementDescription}</desc>
      ) : null}
      <title id="score-title">{layout.title}</title>
      <desc id="score-description">
        {getScoreAccessibleDescription(layout)}
      </desc>
      <desc id="whole-neume-selection-instruction">
        {wholeNeumeSelectionInstruction}
      </desc>

      {layout.systems.map((system) => (
        <g key={system.index} data-system-index={system.index}>
          <SystemStaff system={system} />

          {system.neumes.map((neume) => {
            const isNeumeSelected =
              selection.kind === 'neume' && selection.neumeId === neume.neumeId;
            const selectedDescription = getSelectedNeumeDescription(
              neume.kind,
              isNeumeSelected,
            );
            const selectedDescriptionId = `selected-neume-${neume.neumeId}`;
            const selectionGap = 5;

            return (
              <g
                key={neume.neumeId}
                data-neume-id={neume.neumeId}
                data-neume-kind={neume.kind}
              >
                {selectedDescription ? (
                  <desc id={selectedDescriptionId}>{selectedDescription}</desc>
                ) : null}
                {isNeumeSelected ? (
                  <rect
                    className="score__neume-selection"
                    data-selected-neume-id={neume.neumeId}
                    x={neume.bounds.x - selectionGap}
                    y={neume.bounds.y - selectionGap}
                    width={neume.bounds.width + selectionGap * 2}
                    height={neume.bounds.height + selectionGap * 2}
                    rx="4"
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                ) : null}
                {placementActive &&
                (isNeumeSelected ||
                  (selection.kind === 'note' &&
                    neume.notes.some(
                      (note) => note.noteId === selection.noteId,
                    ))) ? (
                  <rect
                    className="score__placement-context"
                    x={neume.bounds.x - 7}
                    y={neume.bounds.y - 7}
                    width={neume.bounds.width + 14}
                    height={neume.bounds.height + 14}
                    rx="3"
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                ) : null}
                <NeumeInk ink={neume.ink} />
                {neume.notes.map((note, noteIndex) => {
                  const isNoteSelected =
                    selection.kind === 'note' &&
                    selection.noteId === note.noteId;
                  const accessibleLabel = getNoteAccessibleLabel(
                    neume.kind,
                    noteIndex,
                  );

                  return (
                    <g
                      className="score__note"
                      key={note.noteId}
                      ref={(element) => {
                        if (element) {
                          noteElements.current.set(note.noteId, element);
                        } else {
                          noteElements.current.delete(note.noteId);
                        }
                      }}
                      data-note-id={note.noteId}
                      role="button"
                      tabIndex={placementActive ? -1 : 0}
                      pointerEvents={placementActive ? 'none' : 'all'}
                      aria-label={accessibleLabel}
                      aria-describedby={`whole-neume-selection-instruction${isNeumeSelected ? ` ${selectedDescriptionId}` : ''}`}
                      aria-pressed={isNoteSelected}
                      aria-disabled={placementActive}
                      onClick={(event) => handleNoteClick(event, note.noteId)}
                      onKeyDown={(event) =>
                        handleNoteKeyDown(
                          event,
                          note.noteId,
                          neume.neumeId,
                          isNoteSelected,
                          isNeumeSelected,
                        )
                      }
                    >
                      <g
                        aria-hidden="true"
                        pointerEvents={
                          placementActive
                            ? 'none'
                            : neume.kind === 'climacus' ||
                                neume.kind === 'porrectus'
                              ? 'fill'
                              : undefined
                        }
                      >
                        <InkShapeView
                          className="score__note-hit-target"
                          shape={
                            note.hitShape ?? {
                              kind: 'rect',
                              bounds: note.hitBounds,
                              radius: 0,
                            }
                          }
                        />
                      </g>
                      {isNoteSelected ? (
                        <g pointerEvents="none" aria-hidden="true">
                          <InkShapeView
                            shape={note.head}
                            className="score__note-selection"
                          />
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {system.lyrics.map((lyric) => (
            <g key={lyric.syllableId} className="score__lyric-control">
              <g
                className={`score__lyric-group${selection.kind === 'syllable' && selection.syllableId === lyric.syllableId ? ' score__lyric-group--selected' : ''}`}
              >
                <text
                  className="score__lyric"
                  ref={(element) => {
                    if (element)
                      lyricElements.current.set(lyric.syllableId, element);
                    else lyricElements.current.delete(lyric.syllableId);
                  }}
                  role="button"
                  aria-describedby="lyric-focus-help"
                  tabIndex={placementActive ? -1 : 0}
                  aria-label={`Syllable: ${lyric.text}. Click or Space selects; double-click or Enter edits; Delete or Backspace removes focused lyrics; typing replaces; minus continues a word; Space starts a word; underscore skips.`}
                  aria-pressed={
                    selection.kind === 'syllable' &&
                    selection.syllableId === lyric.syllableId
                  }
                  aria-disabled={placementActive}
                  pointerEvents={placementActive ? 'none' : 'all'}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!placementActive) onSelectSyllable(lyric.syllableId);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!placementActive) onEditSyllable(lyric.syllableId);
                  }}
                  onKeyDown={(event) => {
                    const action = getSyllableKeyAction(
                      event.nativeEvent,
                      selection.kind === 'syllable' &&
                        selection.syllableId === lyric.syllableId,
                      placementActive,
                    );
                    if (!action) return;
                    event.preventDefault();
                    event.stopPropagation();
                    switch (action.type) {
                      case 'select':
                        onSelectSyllable(lyric.syllableId);
                        break;
                      case 'edit':
                        onEditSyllable(lyric.syllableId);
                        break;
                      case 'replace':
                        onEditSyllable(lyric.syllableId, action.text);
                        break;
                      case 'delete':
                        onDeleteSyllable(lyric.syllableId);
                        break;
                      case 'advance':
                        onAdvanceLyric(action.key);
                        break;
                    }
                  }}
                  data-syllable-id={lyric.syllableId}
                  x={lyric.x}
                  y={lyric.y}
                  fontSize={lyric.fontSize}
                  textAnchor="middle"
                >
                  {lyric.text}
                </text>
              </g>
              <g
                className="score__lyric-focus-cue"
                aria-hidden="true"
                pointerEvents="none"
              >
                <path
                  d={`M${lyric.x - 5},${lyric.y - lyric.fontSize - 10} h10 l-5,6 Z`}
                />
                <text x={lyric.x} y={lyric.y + 22} textAnchor="middle">
                  Keyboard focus
                </text>
              </g>
            </g>
          ))}
        </g>
      ))}

      {placementPreview ? (
        <g
          className="score__placement-preview"
          pointerEvents="none"
          aria-hidden="true"
        >
          <g className="score__placement-caret">
            <line
              x1={placementPreview.caret.x}
              x2={placementPreview.caret.x}
              y1={placementPreview.caret.top}
              y2={placementPreview.caret.bottom}
            />
            <path
              d={`M${placementPreview.caret.x - 4},${placementPreview.caret.top} h8`}
            />
          </g>
          <g className="score__placement-ghost">
            <NeumeInk ink={placementPreview.ink} />
          </g>
          {placementPreview.caret.systemIndex !==
          placementPreview.pointerSystemIndex ? (
            <text
              className="score__placement-target"
              x="64"
              y={layout.systems[placementPreview.pointerSystemIndex].y + 208}
            >
              Insertion: system {placementPreview.caret.systemIndex + 1}
            </text>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}

/** Shared committed staff and clef rendering. */
function SystemStaff({
  system,
}: {
  system: Pick<ChantSystemLayout, 'index' | 'staffLines' | 'clef'>;
}) {
  return (
    <>
      {system.staffLines.map((line, lineIndex) => (
        <line
          className="score__staff-line"
          key={`system-${system.index}-staff-line-${lineIndex}`}
          x1={line.x1}
          x2={line.x2}
          y1={line.y}
          y2={line.y}
        />
      ))}

      <text
        className="score__clef"
        x={system.clef.x}
        y={system.clef.y}
        fontSize={system.clef.fontSize}
        textAnchor="middle"
        dominantBaseline="central"
        aria-hidden="true"
      >
        C
      </text>
    </>
  );
}

/**
 * Converts browser client coordinates to score-absolute SVG coordinates.
 * A missing or non-invertible screen transform safely cancels interaction.
 */
function getLocalPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): SvgPoint | null {
  const screenTransform = svg.getScreenCTM();

  if (!screenTransform) {
    return null;
  }

  try {
    const localPoint = new DOMPoint(clientX, clientY).matrixTransform(
      screenTransform.inverse(),
    );

    return Number.isFinite(localPoint.x) && Number.isFinite(localPoint.y)
      ? { x: localPoint.x, y: localPoint.y }
      : null;
  } catch {
    return null;
  }
}
