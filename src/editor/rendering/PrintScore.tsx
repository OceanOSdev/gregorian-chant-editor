import type { ChantLayout } from '../layout/layout-chant';
import { NeumeInk } from './NeumeInk';
import { SystemStaff } from './ScoreSvg';

/** Separate passive systems allow browsers to paginate between staffs. */
export function PrintScore({ layout }: { layout: ChantLayout }) {
  return (
    <article className="print-score" aria-hidden="true">
      <h1>{layout.title}</h1>
      {layout.systems.map((system) => (
        <svg
          key={system.index}
          viewBox={`0 ${system.y} ${layout.width} ${system.height}`}
        >
          <SystemStaff system={system} />
          {system.neumes.map((neume) => (
            <NeumeInk key={neume.neumeId} ink={neume.ink} />
          ))}
          {system.lyrics.map((lyric) => (
            <text
              key={lyric.syllableId}
              className="score__lyric"
              textAnchor="middle"
              x={lyric.x}
              y={lyric.y}
              fontSize={lyric.fontSize}
            >
              {lyric.text}
            </text>
          ))}
          {system.hyphens?.map((mark, index) => (
            <text
              key={index}
              className="score__hyphen"
              textAnchor="middle"
              x={mark.x}
              y={mark.y}
              fontSize={20}
            >
              -
            </text>
          ))}
        </svg>
      ))}
    </article>
  );
}
