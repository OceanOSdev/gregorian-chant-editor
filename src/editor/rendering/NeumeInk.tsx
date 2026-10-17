import type { InkShape } from '../layout/neume-geometry';

export function InkShapeView({
  shape,
  className,
}: {
  shape: InkShape;
  className?: string;
}) {
  if (shape.kind === 'path') {
    return <path d={shape.d} className={className} />;
  }
  return <rect {...shape.bounds} rx={shape.radius} className={className} />;
}

/** Shared by committed notation and previews; no engraving calculations here. */
export function NeumeInk({ ink }: { ink: readonly InkShape[] }) {
  return (
    <g className="score__ink" pointerEvents="none" aria-hidden="true">
      {ink.map((shape, index) => (
        <InkShapeView key={index} shape={shape} />
      ))}
    </g>
  );
}
