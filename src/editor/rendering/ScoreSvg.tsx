import type { ChantLayout } from '../layout/layout-chant'

interface ScoreSvgProps {
  layout: ChantLayout
}

export function ScoreSvg({ layout }: ScoreSvgProps) {
  const noteLabel = layout.notes.length === 1 ? 'note' : 'notes'
  const lyricLabel =
    layout.lyrics.length === 1 ? 'lyric syllable' : 'lyric syllables'

  return (
    <svg
      className="score"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-labelledby="score-title score-description"
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

      {layout.notes.map((note) => (
        <rect
          className="score__punctum"
          key={note.noteId}
          data-note-id={note.noteId}
          x={note.x}
          y={note.y}
          width={note.width}
          height={note.height}
          rx="1"
        />
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
