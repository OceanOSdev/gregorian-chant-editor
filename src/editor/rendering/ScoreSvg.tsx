import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { StaffPositionDelta } from '../commands/move-note'
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind'
import {
  type ChantLayout,
  type GraphicalPlacementPreviewLayout,
  type GraphicalNeumeKind,
} from '../layout/layout-chant'
import {
  isPlacementTool,
  type EditorTool,
} from '../state/editor-tool'
import type { EditorSelection } from '../state/selection'
import {
  getNoteAccessibleLabel,
  getSelectedNeumeDescription,
  wholeNeumeSelectionInstruction,
} from './note-accessible-label'
import { getScoreAccessibleDescription } from './score-accessible-description'

export interface SvgPoint {
  x: number
  y: number
}

interface ScoreSvgProps {
  layout: ChantLayout
  placementPreview: GraphicalPlacementPreviewLayout | null
  selection: EditorSelection
  activeTool: EditorTool
  pendingFocusNoteId: string | null
  onNoteFocusHandled: (noteId: string) => void
  onSelectNote: (noteId: string) => void
  onSelectNeumeForNote: (noteId: string) => void
  onPlacementPointerMove: (point: SvgPoint) => void
  onPlacementPointerLeave: () => void
  onPlaceNeume: (kind: GraphicalNeumeKind, point: SvgPoint) => void
  onMoveNote: (noteId: string, delta: StaffPositionDelta) => void
  onMoveNeume: (
    neumeId: string,
    delta: StaffPositionDelta,
    invokingNoteId: string,
  ) => void
  onDeleteNote: (noteId: string) => void
  onDeleteNeume: (neumeId: string) => void
  onClearSelection: () => void
}

export function ScoreSvg({
  layout,
  placementPreview,
  selection,
  activeTool,
  pendingFocusNoteId,
  onNoteFocusHandled,
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
}: ScoreSvgProps) {
  const noteElements = useRef(new Map<string, SVGGElement>())
  const placementActive = isPlacementTool(activeTool)

  useEffect(() => {
    if (!pendingFocusNoteId) {
      return
    }

    const noteElement = noteElements.current.get(pendingFocusNoteId)

    if (!noteElement) {
      return
    }

    // Stable IDs recover the current element after keyed notes move systems.
    noteElement.focus()
    onNoteFocusHandled(pendingFocusNoteId)
  }, [onNoteFocusHandled, pendingFocusNoteId])

  function handleNoteClick(
    event: MouseEvent<SVGGElement>,
    noteId: string,
  ) {
    event.stopPropagation()

    if (event.shiftKey) {
      onSelectNeumeForNote(noteId)
    } else {
      onSelectNote(noteId)
    }
  }

  function handleScoreClick(event: MouseEvent<SVGSVGElement>) {
    if (!isPlacementTool(activeTool)) {
      onClearSelection()
      return
    }

    const localPoint = getLocalPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    )

    if (!localPoint) {
      return
    }

    const kind = getGraphicalNeumeKind(activeTool)

    if (kind) {
      onPlaceNeume(kind, localPoint)
    }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!isPlacementTool(activeTool)) {
      return
    }

    const localPoint = getLocalPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    )

    if (localPoint) {
      onPlacementPointerMove(localPoint)
    } else {
      onPlacementPointerLeave()
    }
  }

  function handleNoteKeyDown(
    event: KeyboardEvent<SVGGElement>,
    noteId: string,
    neumeId: string,
    isNoteSelected: boolean,
    isNeumeSelected: boolean,
  ) {
    if (isPlacementTool(activeTool)) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey) {
        onSelectNeumeForNote(noteId)
      } else {
        onSelectNote(noteId)
      }

      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()

      if (isNoteSelected) {
        onDeleteNote(noteId)
      } else if (isNeumeSelected) {
        onDeleteNeume(neumeId)
      }

      return
    }

    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return
    }

    if (!isNoteSelected && !isNeumeSelected) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (isNoteSelected) {
      onMoveNote(noteId, event.key === 'ArrowUp' ? 1 : -1)
    } else if (isNeumeSelected) {
      onMoveNeume(
        neumeId,
        event.key === 'ArrowUp' ? 1 : -1,
        noteId,
      )
    }
  }

  return (
    <svg
      className={`score${placementActive ? ' score--placing' : ''}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-labelledby="score-title score-description"
      onClick={handleScoreClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onPlacementPointerLeave()}
    >
      <title id="score-title">{layout.title}</title>
      <desc id="score-description">
        {getScoreAccessibleDescription(layout)}
      </desc>
      <desc id="whole-neume-selection-instruction">
        {wholeNeumeSelectionInstruction}
      </desc>

      {layout.systems.map((system) => (
        <g key={system.index} data-system-index={system.index}>
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

          {system.neumes.map((neume) => {
            const isNeumeSelected =
              selection.kind === 'neume' &&
              selection.neumeId === neume.neumeId
            const selectedDescription =
              getSelectedNeumeDescription(neume.kind, isNeumeSelected)
            const selectedDescriptionId = `selected-neume-${neume.neumeId}`
            const selectionGap = 5

            return (
              <g key={neume.neumeId} data-neume-id={neume.neumeId}>
                {selectedDescription ? (
                  <desc id={selectedDescriptionId}>
                    {selectedDescription}
                  </desc>
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
                {neume.connectors.map((connector, index) => (
                  <line
                    key={`${neume.neumeId}-connector-${index}`}
                    className="score__neume-connector"
                    x1={connector.x}
                    x2={connector.x}
                    y1={connector.y1}
                    y2={connector.y2}
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                ))}
                {neume.notes.map((note, noteIndex) => {
                  const isNoteSelected =
                    selection.kind === 'note' &&
                    selection.noteId === note.noteId
                  const accessibleLabel = getNoteAccessibleLabel(
                    neume.kind,
                    noteIndex,
                  )

                  return (
                    <g
                      className="score__note"
                      key={note.noteId}
                      ref={(element) => {
                        if (element) {
                          noteElements.current.set(note.noteId, element)
                        } else {
                          noteElements.current.delete(note.noteId)
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
                      onClick={(event) =>
                        handleNoteClick(event, note.noteId)
                      }
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
                      <rect
                        className="score__note-hit-target"
                        x={note.x - 6}
                        y={note.y - 6}
                        width={note.width + 12}
                        height={note.height + 12}
                        rx="3"
                        aria-hidden="true"
                      />
                      <rect
                        className={`score__punctum${isNoteSelected ? ' score__punctum--selected' : ''}`}
                        x={note.x}
                        y={note.y}
                        width={note.width}
                        height={note.height}
                        rx="1"
                        aria-hidden="true"
                      />
                    </g>
                  )
                })}
              </g>
            )
          })}

          {system.lyrics.map((lyric) => (
            <text
              className="score__lyric"
              key={lyric.syllableId}
              data-syllable-id={lyric.syllableId}
              x={lyric.x}
              y={lyric.y}
              fontSize={lyric.fontSize}
              textAnchor="middle"
            >
              {lyric.text}
            </text>
          ))}
        </g>
      ))}

      {placementPreview ? (
        <g
          className="score__placement-preview"
          pointerEvents="none"
          aria-hidden="true"
        >
          {placementPreview.connectors.map((connector, index) => (
            <line
              key={`preview-connector-${index}`}
              className="score__placement-preview-connector"
              x1={connector.x}
              x2={connector.x}
              y1={connector.y1}
              y2={connector.y2}
              pointerEvents="none"
              aria-hidden="true"
            />
          ))}
          {placementPreview.notes.map((note, index) => (
            <rect
              className="score__placement-preview-note"
              key={index}
              x={note.x}
              y={note.y}
              width={note.width}
              height={note.height}
              rx="1"
            />
          ))}
        </g>
      ) : null}

    </svg>
  )
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
  const screenTransform = svg.getScreenCTM()

  if (!screenTransform) {
    return null
  }

  try {
    const localPoint = new DOMPoint(clientX, clientY).matrixTransform(
      screenTransform.inverse(),
    )

    return Number.isFinite(localPoint.x) && Number.isFinite(localPoint.y)
      ? { x: localPoint.x, y: localPoint.y }
      : null
  } catch {
    return null
  }
}
