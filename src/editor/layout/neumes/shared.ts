import type { AccidentalGeometry } from '../accidental-geometry';
import type { Neume, StaffPosition } from '../../domain/chant-document';

export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type InkShape =
  | {
      kind: 'rect';
      bounds: LayoutBounds;
      radius: number;
      /** Screen hint only; canonical vector bounds remain authoritative. */
      rasterization?: 'vertical-episema';
    }
  | { kind: 'path'; bounds: LayoutBounds; d: string };

export interface NoteGeometry extends LayoutBounds {
  modifierBounds?: LayoutBounds;
  anchorX: number;
  anchorY: number;
  /** Selection contour: a head or a constituent region of shared ribbon ink. */
  head: InkShape;
  hitBounds: LayoutBounds;
  /** Optional pointer/focus contour; absent for rectangular targets. */
  hitShape?: InkShape;
}

/** Discardable, ID-free geometry. Musical anchors are independent of ink bounds. */
export interface NeumeGeometry {
  accidentals?: readonly AccidentalGeometry[];
  notes: readonly NoteGeometry[];
  /** Complete measured ink, including independently rendered signs. */
  ink: readonly InkShape[];
  /** When present, the independently rendered neume body (no accidentals). */
  bodyInk?: readonly InkShape[];
  bounds: LayoutBounds;
  lyricAnchorX: number;
  /** Distance from this glyph's left ink edge to the following glyph's left edge. */
  advanceX: number;
}

export const engravingStaffStep = 12;
export const interNeumeInkGap = 33;

export function firstHeadHalfWidth(kind: Neume['kind']): number {
  switch (kind) {
    case 'bistropha':
    case 'tristropha':
    case 'punctum':
    case 'podatus':
    case 'clivis':
    case 'scandicus':
    case 'torculus':
    case 'climacus':
    case 'porrectus':
      return 6;
  }
}

export function getInkBounds(ink: readonly InkShape[]): LayoutBounds {
  const x = Math.min(...ink.map((part) => part.bounds.x));
  const y = Math.min(...ink.map((part) => part.bounds.y));
  return {
    x,
    y,
    width:
      Math.max(...ink.map((part) => part.bounds.x + part.bounds.width)) - x,
    height:
      Math.max(...ink.map((part) => part.bounds.y + part.bounds.height)) - y,
  };
}

export function note(
  head: InkShape,
  anchorX: number,
  anchorY: number,
): NoteGeometry {
  const { x, y, width, height } = head.bounds;
  return {
    ...head.bounds,
    anchorX,
    anchorY,
    head,
    hitBounds: { x: x - 6, y: y - 6, width: width + 12, height: height + 12 },
  };
}

export function geometryContext(
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
) {
  const first = positions[0];
  if (first === undefined) throw new Error('A neume must have a first pitch');
  const x = leftX;
  const y = bottomStaffY - first * engravingStaffStep;
  // Local commands simplify the recipes; a translated path is still explicit
  // score-absolute geometry, not a DOM transform or renderer calculation.
  const move = (dx: number, dy: number) => `${x + dx},${y + dy}`;
  const shape = (
    d: string,
    dx: number,
    dy: number,
    width: number,
    height: number,
  ): InkShape => ({
    kind: 'path',
    d,
    bounds: { x: x + dx, y: y + dy, width, height },
  });
  return { first, x, y, move, shape };
}

export function finishGeometry(
  notes: readonly NoteGeometry[],
  ink: readonly InkShape[],
  lyricAnchorX: number,
): NeumeGeometry {
  const bounds = getInkBounds(ink);
  return {
    notes,
    ink,
    bounds,
    lyricAnchorX,
    advanceX: bounds.width + interNeumeInkGap,
  };
}

/** Exposed head edges; fitted joining contours stay in their recipes. */
export function headContours(
  move: (dx: number, dy: number) => string,
  y: number,
) {
  const crown = (left: number, top: number) =>
    `M${move(left, top + 2)} C${move(left, top + 0.6)} ${move(left + 3, top)} ${move(left + 6, top)} C${move(left + 9, top)} ${move(left + 12, top + 0.6)} ${move(left + 12, top + 2)}`;
  const underside = (left: number, pitch: number) =>
    `V${y + pitch + 5.6} C${move(left + 12, pitch + 5.9)} ${move(left + 11.85, pitch + 6)} ${move(left + 11.6, pitch + 6)} C${move(left + 9.8, pitch + 6)} ${move(left + 8, pitch + 4.8)} ${move(left + 6, pitch + 4.8)} C${move(left + 4, pitch + 4.8)} ${move(left + 2.2, pitch + 6)} ${move(left + 0.4, pitch + 6)} C${move(left + 0.15, pitch + 6)} ${move(left, pitch + 5.9)} ${move(left, pitch + 5.6)}`;

  return { crown, underside };
}
