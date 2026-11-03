import type { StaffPosition } from '../../domain/chant-document';

export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type InkShape =
  | { kind: 'rect'; bounds: LayoutBounds; radius: number }
  | { kind: 'path'; bounds: LayoutBounds; d: string };

export interface NoteGeometry extends LayoutBounds {
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
  notes: readonly NoteGeometry[];
  ink: readonly InkShape[];
  bounds: LayoutBounds;
  lyricAnchorX: number;
  /** Distance from this glyph's left ink edge to the following glyph's left edge. */
  advanceX: number;
}

export const engravingStaffStep = 12;
export const interNeumeInkGap = 33;

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
