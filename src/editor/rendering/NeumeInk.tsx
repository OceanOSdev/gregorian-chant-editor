import { useId } from 'react';
import {
  ledgerSpacing,
  ledgerThickness,
  visibleLedgerRun,
  type LedgerRun,
} from '../layout/ledger-lines';
import type { InkShape } from '../layout/neume-geometry';
import type { RenderBand } from './render-band';

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
export function NeumeLedgers({
  ledgers,
  band,
}: {
  ledgers: readonly LedgerRun[];
  /** Paint only strokes inside this window (distant pitches; see RenderBand). */
  band?: RenderBand;
}) {
  const id = useId();
  return (
    <g className="score__ledgers" pointerEvents="none" aria-hidden="true">
      {ledgers.map((derived, index) => {
        const run = band
          ? visibleLedgerRun(derived, band.top, band.bottom)
          : derived;
        if (!run) return null;
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
              data-ledger-count={derived.count}
              data-painted-ledger-count={
                run.count === derived.count ? undefined : run.count
              }
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
  band,
}: {
  ink: readonly InkShape[];
  /** Omitted by staffless icons; ledger ink is never part of `ink`. */
  ledgers?: readonly LedgerRun[];
  band?: RenderBand;
}) {
  return (
    <>
      {ledgers?.length ? <NeumeLedgers ledgers={ledgers} band={band} /> : null}
      <g className="score__ink" pointerEvents="none" aria-hidden="true">
        {ink.map((shape, index) => (
          <InkShapeView key={index} shape={shape} />
        ))}
      </g>
    </>
  );
}
