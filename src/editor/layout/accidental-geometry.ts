import type { ChantAccidental } from '../domain/chant-document';
import type { InkShape, LayoutBounds, NeumeGeometry } from './neume-geometry';
import {
  getInkBounds,
  interNeumeInkGap,
  engravingStaffStep,
} from './neumes/shared';

export interface AccidentalSpec {
  kind: ChantAccidental['kind'];
  staffPosition: number;
  noteIndex: number | null;
}

export interface AccidentalGeometry {
  kind: ChantAccidental['kind'];
  ink: InkShape;
  hitBounds: LayoutBounds;
}

export interface AccidentalLyricBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const accidentalPrefixAdvance = 20;

/** Original measured square-notation contours, in canonical score units. */
export function buildAccidentalGeometry(
  kind: ChantAccidental['kind'],
  x: number,
  y: number,
): AccidentalGeometry {
  const p = (a: number, b: number) => `${x + a},${y + b}`;
  const d =
    kind === 'flat'
      ? `M${p(0, -16)} Q${p(0, -18)} ${p(1, -18)} Q${p(2, -18)} ${p(2, -16)} V${y} C${p(6, 4)} ${p(9, 5)} ${p(10, 4)} C${p(11, 1)} ${p(8, -1)} ${p(4, -3)} V${y - 7} C${p(9, -7)} ${p(12, -3)} ${p(12, 0)} V${y + 10} C${p(7, 10)} ${p(3, 8)} ${p(0, 4)} Z`
      : `M${p(0, -20)} H${x + 2} V${y - 4} L${p(8, -7)} V${y + 19} H${x + 6} V${y + 4} L${p(0, 7)} Z M${p(2, 0)} V${y + 4} L${p(6, 2)} V${y - 2} Z`;
  const bounds = {
    x,
    y: y + (kind === 'flat' ? -18 : -20),
    width: kind === 'flat' ? 12 : 8,
    height: kind === 'flat' ? 28 : 39,
  };
  return {
    kind,
    ink: { kind: 'path', d, bounds },
    hitBounds: {
      x: x - 5,
      y: bounds.y - 4,
      width: bounds.width + 10,
      height: bounds.height + 8,
    },
  };
}

function overlaps(a: LayoutBounds, b: LayoutBounds): boolean {
  return (
    a.x < b.x + b.width + 3 &&
    a.x + a.width + 3 > b.x &&
    a.y < b.y + b.height + 3 &&
    a.y + a.height + 3 > b.y
  );
}

/** Partition padding at the nearest ink midpoint; preserve every painted point. */
function clearHitBounds(
  g: AccidentalGeometry,
  obstacles: readonly LayoutBounds[],
): AccidentalGeometry {
  const ink = g.ink.bounds;
  let left = g.hitBounds.x,
    right = left + g.hitBounds.width,
    top = g.hitBounds.y,
    bottom = top + g.hitBounds.height;
  for (const b of obstacles) {
    if (top < b.y + b.height + 6 && bottom > b.y - 6) {
      if (ink.x + ink.width <= b.x)
        right = Math.min(right, (ink.x + ink.width + b.x) / 2);
      if (ink.x >= b.x + b.width)
        left = Math.max(left, (ink.x + b.x + b.width) / 2);
    }
    if (left < b.x + b.width + 6 && right > b.x - 6) {
      if (ink.y + ink.height <= b.y)
        bottom = Math.min(bottom, (ink.y + ink.height + b.y) / 2);
      if (ink.y >= b.y + b.height)
        top = Math.max(top, (ink.y + b.y + b.height) / 2);
    }
  }
  return {
    ...g,
    hitBounds: { x: left, y: top, width: right - left, height: bottom - top },
  };
}

export function addAccidentalGeometry(
  base: NeumeGeometry,
  specs: readonly AccidentalSpec[],
  leftX: number,
  bottomY: number,
  lyricBox?: AccidentalLyricBox,
): NeumeGeometry {
  if (!specs.length) return base;
  let prefixIndex = 0;
  const accidentals = specs.map((spec) => {
    const note = spec.noteIndex === null ? null : base.notes[spec.noteIndex];
    let x = note
      ? note.anchorX - 5
      : leftX + prefixIndex++ * accidentalPrefixAdvance;
    const y = bottomY - spec.staffPosition * engravingStaffStep;
    let g = buildAccidentalGeometry(spec.kind, x, y);
    // Align to the target column, clearing occupied ink on its outer side.
    // Later constituents clear to the right so ink cannot imply a prefix
    // before an unaffected earlier note. The semantic anchor never changes.
    if (note || lyricBox) {
      const clearRight = spec.noteIndex !== null && spec.noteIndex > 0;
      const occupied = [
        ...(note ? base.ink.map((shape) => shape.bounds) : []),
        ...(lyricBox
          ? [
              {
                x: base.lyricAnchorX + lyricBox.left,
                y: bottomY + lyricBox.top,
                width: lyricBox.right - lyricBox.left,
                height: lyricBox.bottom - lyricBox.top,
              },
            ]
          : []),
      ];
      for (const ink of occupied.sort((a, b) =>
        clearRight ? a.x - b.x : b.x - a.x,
      )) {
        if (overlaps(g.ink.bounds, ink)) {
          x = clearRight
            ? Math.max(x, ink.x + ink.width + 4)
            : Math.min(x, ink.x - g.ink.bounds.width - 4);
          g = buildAccidentalGeometry(spec.kind, x, y);
        }
      }
    }
    return clearHitBounds(
      g,
      base.ink.map((shape) => shape.bounds),
    );
  });
  const ink = [...base.ink, ...accidentals.map((a) => a.ink)];
  const bounds = getInkBounds(ink);
  return {
    ...base,
    ink,
    bounds,
    accidentals,
    advanceX: bounds.width + interNeumeInkGap,
  };
}
