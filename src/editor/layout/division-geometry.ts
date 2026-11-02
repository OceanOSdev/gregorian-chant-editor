import type { ChantDivision, DivisionKind } from '../domain/chant-document';
import type { LayoutBounds } from './neume-geometry';

export interface DivisionLayout {
  divisionId: string;
  kind: DivisionKind;
  bounds: LayoutBounds;
  hitBounds: LayoutBounds;
  lines: readonly { x1: number; x2: number; y1: number; y2: number }[];
}

export const divisionGap = 16;
export const divisionStrokeWidth = 1.5;
const doubleBarSeparation = 6;
export function measureDivisionWidth(kind: DivisionKind): number {
  return divisionStrokeWidth + (kind === 'finalis' ? doubleBarSeparation : 0);
}
/** Thin bars: top-line quarter, centered half, full and double full staff. */
export function buildDivisionGeometry(
  division: ChantDivision,
  left: number,
  bottom: number,
  lineSpacing: number,
): DivisionLayout {
  const top = bottom - 3 * lineSpacing;
  const y1 =
    division.kind === 'minima'
      ? top - lineSpacing / 2
      : division.kind === 'minor'
        ? top + lineSpacing / 2
        : top;
  const y2 =
    division.kind === 'minima'
      ? top + lineSpacing / 2
      : division.kind === 'minor'
        ? bottom - lineSpacing / 2
        : bottom;
  const width = measureDivisionWidth(division.kind);
  const xs =
    division.kind === 'finalis'
      ? [
          left + divisionStrokeWidth / 2,
          left + divisionStrokeWidth / 2 + doubleBarSeparation,
        ]
      : [left + divisionStrokeWidth / 2];
  return {
    divisionId: division.id,
    kind: division.kind,
    bounds: { x: left, y: y1, width, height: y2 - y1 },
    hitBounds: {
      x: left - 7,
      y: Math.min(top - 8, y1 - 7),
      width: width + 14,
      height: bottom + 8 - Math.min(top - 8, y1 - 7),
    },
    lines: xs.map((x) => ({ x1: x, x2: x, y1, y2 })),
  };
}
