import type { Neume, StaffPosition } from '../domain/chant-document';

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
  head: InkShape;
  hitBounds: LayoutBounds;
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
export const legacyNoteWidth = 15;
export const legacyNoteHeight = 11;
export const legacyCompactOffset = 12;

function rectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 0,
): InkShape {
  return { kind: 'rect', bounds: { x, y, width, height }, radius };
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

function note(head: InkShape, anchorX: number, anchorY: number): NoteGeometry {
  const { x, y, width, height } = head.bounds;
  return {
    ...head.bounds,
    anchorX,
    anchorY,
    head,
    hitBounds: { x: x - 6, y: y - 6, width: width + 12, height: height + 12 },
  };
}

export function firstHeadHalfWidth(kind: Neume['kind']): number {
  switch (kind) {
    case 'punctum':
    case 'podatus':
    case 'clivis':
      return 6;
    case 'scandicus':
    case 'torculus':
    case 'climacus':
    case 'porrectus':
      return legacyNoteWidth / 2;
  }
}

/**
 * Approved project contours; see docs/engraving-metrics.md. Every engraved
 * compound uses ONE continuous filled outline, avoiding shared-edge AA seams.
 * Positions are valid semantic input, in musical order; coordinates are absolute.
 */
export function buildNeumeGeometry(
  kind: Neume['kind'],
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
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
  let notes: NoteGeometry[];
  let ink: readonly InkShape[];
  let lyricAnchorX = x + firstHeadHalfWidth(kind);

  if (kind === 'punctum') {
    const head = shape(
      `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)} C${move(9, -6)} ${move(12, -5.4)} ${move(12, -4)} V${y + 5.6} C${move(12, 5.9)} ${move(11.85, 6)} ${move(11.6, 6)} C${move(9.8, 6)} ${move(8, 4.8)} ${move(6, 4.8)} C${move(4, 4.8)} ${move(2.2, 6)} ${move(0.4, 6)} C${move(0.15, 6)} ${move(0, 5.9)} ${move(0, 5.6)} Z`,
      0,
      -6,
      12,
      12,
    );
    notes = [note(head, x + 6, y)];
    ink = [head];
  } else if (kind === 'podatus' || kind === 'clivis') {
    const second = positions[1];
    if (second === undefined)
      throw new Error('A two-note neume must have two pitches');
    const distance = Math.abs(second - first);
    const dy = (first - second) * engravingStaffStep;
    // Exposed edges share a vocabulary, while fitted joining edges stay intact.
    const crown = (top: number) =>
      `M${move(0, top + 2)} C${move(0, top + 0.6)} ${move(3, top)} ${move(6, top)} C${move(9, top)} ${move(12, top + 0.6)} ${move(12, top + 2)}`;
    const underside = (left: number, pitch: number) =>
      `V${y + pitch + 5.6} C${move(left + 12, pitch + 5.9)} ${move(left + 11.85, pitch + 6)} ${move(left + 11.6, pitch + 6)} C${move(left + 9.8, pitch + 6)} ${move(left + 8, pitch + 4.8)} ${move(left + 6, pitch + 4.8)} C${move(left + 4, pitch + 4.8)} ${move(left + 2.2, pitch + 6)} ${move(left + 0.4, pitch + 6)} C${move(left + 0.15, pitch + 6)} ${move(left, pitch + 5.9)} ${move(left, pitch + 5.6)}`;
    if (kind === 'podatus') {
      const adjacent = distance === 1;
      const top = adjacent ? -20 : dy - 6;
      const opening = adjacent
        ? `H${x + 10.5} L${move(9, -9)} ${move(6, -10)} ${move(0, -9)} Z`
        : `H${x + 10.5} V${y + dy + 6} Q${move(9, dy + 4)} ${move(0, dy + 4)} Z`;
      const upper = adjacent
        ? shape(`${crown(top)} V${y - 6} ${opening}`, 0, -20, 12, 14)
        : shape(
            `${crown(top)} V${y + dy + 6} H${x + 10.5} Q${move(9, dy + 4)} ${move(0, dy + 4)} Z`,
            0,
            dy - 6,
            12,
            12,
          );
      notes = [
        note(
          shape(
            `M${move(0, -6)} H${x + 12} ${underside(0, 0)} Z`,
            0,
            -6,
            12,
            12,
          ),
          x + 6,
          y,
        ),
        note(upper, x + 6, y + dy),
      ];
      const d = `${crown(top)} ${underside(0, 0)} V${y - 6} ${opening}`;
      ink = [shape(d, 0, adjacent ? -20 : dy - 6, 12, adjacent ? 26 : 12 - dy)];
      // Stacked controls split padding at the nominal inter-pitch midpoint.
      const split = y + dy / 2;
      const lowerTarget = notes[0].hitBounds;
      const lowerBottom = lowerTarget.y + lowerTarget.height;
      lowerTarget.y = Math.max(lowerTarget.y, split);
      lowerTarget.height = lowerBottom - lowerTarget.y;
      const upperTarget = notes[1].hitBounds;
      upperTarget.height =
        Math.min(upperTarget.y + upperTarget.height, split) - upperTarget.y;
    } else {
      const adjacent = distance === 1;
      const secondX = adjacent ? 12 : 10.5;
      // Δ>5 retains the Δ4–5 plateau as a documented project extrapolation.
      const stem = distance <= 2 ? 27 : distance === 3 ? 39 : 45;
      const contact = adjacent ? `V${y + 7.5} L${move(10.5, 6)}` : `V${y + 6}`;
      const fittedScoop = `C${move(9, 6)} ${move(8, 4.8)} ${move(6, 4.8)} C${move(4, 4.8)} ${move(3, 6)} ${move(1.5, 6)}`;
      const firstHead = shape(
        `${crown(-6)} ${contact}${adjacent ? '' : ` H${x + 10.5}`} ${fittedScoop} H${x} Z`,
        0,
        -6,
        12,
        adjacent ? 13.5 : 12,
      );
      // Flat join-side top protects the adjacent contact and wider connector.
      const secondTop = `H${x + secondX + 6} C${move(secondX + 9, dy - 6)} ${move(secondX + 12, dy - 5.4)} ${move(secondX + 12, dy - 4)}`;
      const secondBottom = `${underside(secondX, dy)} H${x + secondX}`;
      notes = [
        note(firstHead, x + 6, y),
        note(
          shape(
            `M${move(secondX, dy - 6)} ${secondTop} ${secondBottom} Z`,
            secondX,
            dy - 6,
            12,
            12,
          ),
          x + secondX + 6,
          y + dy,
        ),
      ];
      const d = `${crown(-6)} V${y + dy - 6} ${secondTop} ${secondBottom} ${contact} ${fittedScoop} V${y + stem} H${x} Z`;
      ink = [shape(d, 0, -6, secondX + 12, Math.max(stem, dy + 6) + 6)];
      lyricAnchorX = (notes[0].anchorX + notes[1].anchorX) / 2;
      if (adjacent) {
        const split = x + 12;
        notes[0].hitBounds.width = split - notes[0].hitBounds.x;
        const target = notes[1].hitBounds;
        target.width = target.x + target.width - split;
        target.x = split;
      }
    }
  } else {
    // Unengraved three-note kinds retain the original heads and connectors.
    notes = positions.map((position, index) => {
      const nx = x + index * legacyCompactOffset;
      const ny = bottomStaffY - position * engravingStaffStep;
      return note(
        rectangle(
          nx,
          ny - legacyNoteHeight / 2,
          legacyNoteWidth,
          legacyNoteHeight,
          1,
        ),
        nx + legacyNoteWidth / 2,
        ny,
      );
    });
    const joins = notes.slice(1).map((next, index) => {
      const previous = notes[index];
      return rectangle(
        next.x + 0.5,
        Math.min(previous.anchorY, next.anchorY) - 1.5,
        3,
        Math.abs(previous.anchorY - next.anchorY) + 3,
      );
    });
    ink = [...joins, ...notes.map((n) => n.head)];
  }
  const bounds = getInkBounds(ink);
  return {
    notes,
    ink,
    bounds,
    lyricAnchorX,
    advanceX: bounds.width + interNeumeInkGap,
  };
}
