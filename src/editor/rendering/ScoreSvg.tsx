import type { KeyboardEvent, MouseEvent } from 'react'
import type { StaffPositionDelta } from '../commands/move-note'
import type { ChantLayout } from '../layout/layout-chant'
import type { EditorSelection } from '../state/selection'

interface ScoreSvgProps {
  layout: ChantLayout
  selection: EditorSelection
  onSelectNote: (noteId: string) => void
  onMoveNote: (noteId: string, delta: StaffPositionDelta) => void
  onClearSelection: () => void
}

export function ScoreSvg({
  layout,
  selection,
  onSelectNote,
  onMoveNote,
  onClearSelection,
}: ScoreSvgProps) {
  const noteLabel = layout.notes.length === 1 ? 'note' : 'notes'
  const lyricLabel =
    layout.lyrics.length === 1 ? 'lyric syllable' : 'lyric syllables'

  function handleNoteClick(
    event: MouseEvent<SVGGElement>,
    noteId: string,
  ) {
    event.stopPropagation()
    onSelectNote(noteId)
  }

  function handleNoteKeyDown(
    event: KeyboardEvent<SVGGElement>,
    noteId: string,
    isSelected: boolean,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      onSelectNote(noteId)
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
      className="score"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-labelledby="score-title score-description"
      onClick={onClearSelection}
    >
      <title id="score-title">{layout.title}</title>
      <desc id="score-description">
        A four-line Gregorian chant staff with a C clef, {layout.notes.length}{' '}
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

      {layout.notes.map((note) => {
        const isSelected =
          selection.kind === 'note' && selection.noteId === note.noteId

        return (
          <g
            className="score__note"
            key={note.noteId}
            data-note-id={note.noteId}
            role="button"
            tabIndex={0}
            aria-label={`Select punctum ${note.noteId}`}
            aria-pressed={isSelected}
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
