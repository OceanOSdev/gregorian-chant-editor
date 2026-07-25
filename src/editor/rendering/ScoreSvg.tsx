import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import type { StaffPositionDelta } from '../commands/move-note'
import type { ChantLayout } from '../layout/layout-chant'
import type { EditorTool } from '../state/editor-tool'
import type { EditorSelection } from '../state/selection'

export interface SvgPoint {
  x: number
  y: number
}

interface ScoreSvgProps {
  layout: ChantLayout
  selection: EditorSelection
  activeTool: EditorTool
  pendingFocusNoteId: string | null
  onNoteFocusHandled: (noteId: string) => void
  onSelectNote: (noteId: string) => void
  onPlacePunctum: (point: SvgPoint) => void
  onMoveNote: (noteId: string, delta: StaffPositionDelta) => void
  onDeleteNote: (noteId: string) => void
  onClearSelection: () => void
}

export function ScoreSvg({
  layout,
  selection,
  activeTool,
  pendingFocusNoteId,
  onNoteFocusHandled,
  onSelectNote,
  onPlacePunctum,
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
    if (activeTool.kind !== 'place-punctum') {
      onClearSelection()
      return
    }

    const screenTransform = event.currentTarget.getScreenCTM()

    if (!screenTransform) {
      return
    }

    const localPoint = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      screenTransform.inverse(),
    )

    onPlacePunctum({ x: localPoint.x, y: localPoint.y })
  }

  function handleNoteKeyDown(
    event: KeyboardEvent<SVGGElement>,
    noteId: string,
    isSelected: boolean,
  ) {
    if (activeTool.kind !== 'select') {
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
      className={`score${activeTool.kind === 'place-punctum' ? ' score--placing' : ''}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-labelledby="score-title score-description"
      onClick={handleScoreClick}
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
            const accessibleLabel =
              neume.kind === 'podatus'
                ? noteIndex === 0
                  ? 'Select lower note of podatus'
                  : 'Select upper note of podatus'
                : 'Select punctum'

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
                tabIndex={activeTool.kind === 'select' ? 0 : -1}
                pointerEvents={
                  activeTool.kind === 'select' ? 'all' : 'none'
                }
                aria-label={accessibleLabel}
                aria-pressed={isSelected}
                aria-disabled={activeTool.kind !== 'select'}
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
