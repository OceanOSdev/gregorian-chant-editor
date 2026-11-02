import {
  divisionStrokeWidth,
  type DivisionLayout,
} from '../layout/division-geometry';

export function DivisionInk({ division }: { division: DivisionLayout }) {
  return (
    <g className="score__division-ink" aria-hidden="true" pointerEvents="none">
      {division.lines.map((line, index) => (
        <line
          key={index}
          {...line}
          stroke="currentColor"
          strokeWidth={divisionStrokeWidth}
        />
      ))}
    </g>
  );
}
