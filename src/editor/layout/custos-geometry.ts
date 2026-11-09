import type { LayoutBounds } from './neume-geometry';
import { staffStep } from './staff-metrics';

/** A regular run, kept compact even for exceptionally distant safe pitches. */
export interface CustosLedgerLines {
  x1: number;
  x2: number;
  topY: number;
  bottomY: number;
  count: number;
}
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
export const custosLedgerOverhang = 3;
export const custosLedgerThickness = 1.5;
export const custosLedgerSpacing = staffStep * 2;

function ledgerCount(position: number): number {
  return position >= 8
    ? Math.floor((position - 6) / 2)
    : position <= -2
      ? Math.floor(-position / 2)
      : 0;
}
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
  const ledgerLines = count
    ? {
        x1: x,
        x2: x + width,
        topY: bottomY - (position > 6 ? 6 + count * 2 : -2) * staffStep,
        bottomY: bottomY - (position > 6 ? 8 : -count * 2) * staffStep,
        count,
      }
    : null;
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
