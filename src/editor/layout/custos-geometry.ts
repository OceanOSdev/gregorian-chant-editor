import type { LayoutBounds } from './neume-geometry';
import { staffStep } from './staff-metrics';

export interface CustosGeometry {
  path: string;
  bounds: LayoutBounds;
  staffPosition: number;
  nextNeumeIndex: number;
  outgoing: boolean;
}
export const custosWidth = 10;
export const custosGap = 10;

/** Small rising guide with a right-hand shaft, after Liber Usualis p. xviii. */
export function buildCustosGeometry(
  position: number,
  x: number,
  bottomY: number,
  nextNeumeIndex: number,
  outgoing: boolean,
): CustosGeometry {
  const y = bottomY - position * staffStep;
  return {
    path: `M${x},${y + 2} l7,-5 v-8 h1.5 v11 l-7,5 Z`,
    bounds: { x, y: y - 11, width: custosWidth, height: 16 },
    staffPosition: position,
    nextNeumeIndex,
    outgoing,
  };
}
