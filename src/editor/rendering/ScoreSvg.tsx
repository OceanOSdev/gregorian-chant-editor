import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { StaffPositionDelta } from '../commands/move-note'
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
import { getNoteAccessibleLabel } from './note-accessible-label'

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
  onPlacementPointerMove: (point: SvgPoint) => void
  onPlacementPointerLeave: () => void
  onPlaceNeume: (kind: GraphicalNeumeKind, point: SvgPoint) => void
  onMoveNote: (noteId: string, delta: StaffPositionDelta) => void
  onDeleteNote: (noteId: string) => void
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
  onPlacementPointerMove,
  onPlacementPointerLeave,
  onPlaceNeume,
  onMoveNote,
  onDeleteNote,
  onClearSelection,
}: ScoreSvgProps) {
  const noteElements = useRef(new Map<string, SVGGElement>())
  const noteCount = layout.neumes.reduce(
    (count, neume) => count + neume.notes.length,
    0,
  )
  const noteLabel = noteCount === 1 ? 'note' : 'notes'
  const lyricLabel =
    layout.lyrics.length === 1 ? 'lyric syllable' : 'lyric syllables'
  const placementActive = isPlacementTool(activeTool)

  useEffect(() => {
    if (!pendingFocusNoteId) {
      return
    }

    const noteElement = noteElements.current.get(pendingFocusNoteId)

    if (!noteElement) {
      return
    }

    noteElement.focus()
    onNoteFocusHandled(pendingFocusNoteId)
  }, [onNoteFocusHandled, pendingFocusNoteId])

  function handleNoteClick(
    event: MouseEvent<SVGGElement>,
    noteId: string,
  ) {
    event.stopPropagation()
    onSelectNote(noteId)
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

    onPlaceNeume(placementKind(activeTool), localPoint)
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
    isSelected: boolean,
  ) {
    if (isPlacementTool(activeTool)) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      onSelectNote(noteId)
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()

      if (isSelected) {
        onDeleteNote(noteId)
      }

      return
    }

    if (!isSelected || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onMoveNote(noteId, event.key === 'ArrowUp' ? 1 : -1)
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
        A four-line Gregorian chant staff with a C clef, {noteCount}{' '}
        {noteLabel}, and {layout.lyrics.length} {lyricLabel}.
      </desc>

      {layout.staffLines.map((line) => (
        <line
          className="score__staff-line"
          key={line.y}
          x1={line.x1}
          x2={line.x2}
          y1={line.y}
          y2={line.y}
        />
      ))}

      <text
        className="score__clef"
        x={layout.clef.x}
        y={layout.clef.y}
        fontSize={layout.clef.fontSize}
        textAnchor="middle"
        dominantBaseline="central"
        aria-hidden="true"
      >
        C
      </text>

      {placementPreview ? (
        <g
          className="score__placement-preview"
          pointerEvents="none"
          aria-hidden="true"
        >
          {placementPreview.connector ? (
            <line
              className="score__placement-preview-connector"
              x1={placementPreview.connector.x}
              x2={placementPreview.connector.x}
              y1={placementPreview.connector.y1}
              y2={placementPreview.connector.y2}
            />
          ) : null}
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

      {layout.neumes.map((neume) => (
        <g key={neume.neumeId} data-neume-id={neume.neumeId}>
          {neume.connector ? (
            <line
              className="score__neume-connector"
              x1={neume.connector.x}
              x2={neume.connector.x}
              y1={neume.connector.y1}
              y2={neume.connector.y2}
              pointerEvents="none"
              aria-hidden="true"
            />
          ) : null}
          {neume.notes.map((note, noteIndex) => {
            const isSelected =
              selection.kind === 'note' && selection.noteId === note.noteId
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
                aria-pressed={isSelected}
                aria-disabled={placementActive}
                onClick={(event) => handleNoteClick(event, note.noteId)}
                onKeyDown={(event) =>
                  handleNoteKeyDown(event, note.noteId, isSelected)
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
                  className={`score__punctum${isSelected ? ' score__punctum--selected' : ''}`}
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
      ))}

      {layout.lyrics.map((lyric) => (
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
    </svg>
  )
}

function placementKind(activeTool: EditorTool): GraphicalNeumeKind {
  if (activeTool.kind === 'place-punctum') {
    return 'punctum'
  }

  if (activeTool.kind === 'place-podatus') {
    return 'podatus'
  }

  return 'clivis'
}

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
