import type { LayoutBounds } from './neume-geometry';
import {
  ledgerCount,
  ledgerOverhang,
  ledgerSpacing,
  ledgerThickness,
  mergeLedgerRuns,
  type LedgerRun,
} from './ledger-lines';
import { staffStep } from './staff-metrics';

/** A regular run, kept compact even for exceptionally distant safe pitches. */
export type CustosLedgerLines = LedgerRun;
export interface CustosGeometry {
  path: string;
  bounds: LayoutBounds;
  ledgerLines: CustosLedgerLines | null;
  staffPosition: number;
  nextNeumeIndex: number;
  outgoing: boolean;
}
export const custosWidth = 10;
export const custosGap = 10;
export const custosLedgerOverhang = ledgerOverhang;
export const custosLedgerThickness = ledgerThickness;
export const custosLedgerSpacing = ledgerSpacing;
export function measureCustosWidth(position: number): number {
  return custosWidth + (ledgerCount(position) ? custosLedgerOverhang * 2 : 0);
}

/** Small rising guide with a right-hand shaft, after Liber Usualis p. xviii. */
export function buildCustosGeometry(
  position: number,
  x: number,
  bottomY: number,
  nextNeumeIndex: number,
  outgoing: boolean,
): CustosGeometry {
  const y = bottomY - position * staffStep;
  const count = ledgerCount(position);
  const width = measureCustosWidth(position);
  const glyphX = x + (count ? custosLedgerOverhang : 0);
  // The shared derivation; the custos column is its glyph width.
  const ledgerLines =
    mergeLedgerRuns(
      [
        {
          position,
          left: x + custosLedgerOverhang,
          right: x + width - custosLedgerOverhang,
        },
      ],
      bottomY,
    )[0] ?? null;
  const top = Math.min(
    y - 11,
    (ledgerLines?.topY ?? y) - custosLedgerThickness / 2,
  );
  const bottom = Math.max(
    y + 5,
    (ledgerLines?.bottomY ?? y) + custosLedgerThickness / 2,
  );
  return {
    path: `M${glyphX},${y + 2} l7,-5 v-8 h1.5 v11 l-7,5 Z`,
    bounds: { x, y: top, width, height: bottom - top },
    ledgerLines,
    staffPosition: position,
    nextNeumeIndex,
    outgoing,
  };
}
