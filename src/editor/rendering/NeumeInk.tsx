import { useId } from 'react';
import {
  ledgerSpacing,
  ledgerThickness,
  type LedgerRun,
} from '../layout/ledger-lines';
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
  return (
    <rect
      {...shape.bounds}
      rx={shape.radius}
      className={
        [
          className,
          shape.rasterization === 'vertical-episema'
            ? 'score__vertical-episema'
            : undefined,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
    />
  );
}

/**
 * Derived ledger runs, painted behind the neume body. One element per run
 * (a tiled pattern for several levels), never one per ledger level, so
 * distant pitches stay bounded. Decorative: no target, no accessible name.
 */
export function NeumeLedgers({ ledgers }: { ledgers: readonly LedgerRun[] }) {
  const id = useId();
  return (
    <g className="score__ledgers" pointerEvents="none" aria-hidden="true">
      {ledgers.map((run, index) => {
        const width = run.x2 - run.x1;
        const y = run.topY - ledgerThickness / 2;
        const height = run.bottomY - run.topY + ledgerThickness;
        const patternId = `${id}-ledger-${index}`;
        return (
          <g key={index}>
            {run.count > 1 ? (
              <defs>
                {/* The tile's phase starts at the first stroke's top edge. */}
                <pattern
                  id={patternId}
                  patternUnits="userSpaceOnUse"
                  x={run.x1}
                  y={y}
                  width={width}
                  height={ledgerSpacing}
                >
                  <rect
                    width={width}
                    height={ledgerThickness}
                    fill="currentColor"
                  />
                </pattern>
              </defs>
            ) : null}
            <rect
              className="score__ledger-run"
              data-ledger-count={run.count}
              x={run.x1}
              y={y}
              width={width}
              height={height}
              fill={run.count > 1 ? `url(#${patternId})` : 'currentColor'}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Shared by committed notation and previews; no engraving calculations here. */
export function NeumeInk({
  ink,
  ledgers,
}: {
  ink: readonly InkShape[];
  /** Omitted by staffless icons; ledger ink is never part of `ink`. */
  ledgers?: readonly LedgerRun[];
}) {
  return (
    <>
      {ledgers?.length ? <NeumeLedgers ledgers={ledgers} /> : null}
      <g className="score__ink" pointerEvents="none" aria-hidden="true">
        {ink.map((shape, index) => (
          <InkShapeView key={index} shape={shape} />
        ))}
      </g>
    </>
  );
}
