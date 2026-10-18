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
    case 'scandicus':
    case 'torculus':
      return 6;
    case 'climacus':
    case 'porrectus':
      return legacyNoteWidth / 2;
  }
}

/**
 * Approved project contours; see docs/engraving-metrics.md. Intended joins
 * share a filled outer contour; conventional disconnected components stay apart.
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
  } else if (kind === 'scandicus' || kind === 'torculus') {
    const second = positions[1];
    const third = positions[2];
    if (second === undefined || third === undefined)
      throw new Error('A three-note neume must have three pitches');
    const a = second - first;
    const b = Math.abs(third - second);
    const u = (first - second) * engravingStaffStep;
    const v = (first - third) * engravingStaffStep;
    const h = a === 1 ? 12 : 10.5;
    // Only fitted compound edges use these local fragments. The three already
    // approved engravings above retain their exact paths.
    const crown = (left: number, top: number) =>
      `M${move(left, top + 2)} C${move(left, top + 0.6)} ${move(left + 3, top)} ${move(left + 6, top)} C${move(left + 9, top)} ${move(left + 12, top + 0.6)} ${move(left + 12, top + 2)}`;
    const underside = (left: number, pitch: number) =>
      `V${y + pitch + 5.6} C${move(left + 12, pitch + 5.9)} ${move(left + 11.85, pitch + 6)} ${move(left + 11.6, pitch + 6)} C${move(left + 9.8, pitch + 6)} ${move(left + 8, pitch + 4.8)} ${move(left + 6, pitch + 4.8)} C${move(left + 4, pitch + 4.8)} ${move(left + 2.2, pitch + 6)} ${move(left + 0.4, pitch + 6)} C${move(left + 0.15, pitch + 6)} ${move(left, pitch + 5.9)} ${move(left, pitch + 5.6)}`;

    if (kind === 'scandicus') {
      const firstGeometry = buildNeumeGeometry(
        'punctum',
        [first],
        x,
        bottomStaffY,
      );
      if (a === 1 && b === 1) {
        // Conventional Punctum + Pes: the two ink regions intentionally do NOT
        // touch. Semantic unity does not imply geometric connectivity.
        const pes = buildNeumeGeometry(
          'podatus',
          [second, third],
          x + h,
          bottomStaffY,
        );
        notes = [firstGeometry.notes[0], ...pes.notes];
        ink = [...firstGeometry.ink, ...pes.ink];
      } else {
        const top = v - (b === 1 ? 8 : 6);
        const upperCrown = crown(h, top);
        const upperReturn = `V${y + v + 6} Q${move(h + 8, v + 4)} ${move(h, v + 4)}`;
        const upper = shape(
          `${upperCrown} V${y + v + 6} H${x + h + 10.5} Q${move(h + 8, v + 4)} ${move(h, v + 4)} Z`,
          h,
          top,
          12,
          v + 6 - top,
        );
        const middleTop =
          a === 1
            ? `M${move(h, u - 6)} H${x + h + 12}`
            : `M${move(h, u - 3)} C${move(h + 3, u - 4)} ${move(h + 8, u - 6)} ${move(h + 10.5, u - 6)} H${x + h + 12}`;
        const hook = `V${y + u + 6} C${move(h + 8, u + 4)} ${move(h + 3, u + 6)} ${move(h + 1.5, u + 9)}`;
        const middleBottom = a === 1 ? underside(h, u) : `${hook} H${x + h}`;
        const middle = shape(
          `${middleTop} ${middleBottom} Z`,
          h,
          u - 6,
          12,
          a === 1 ? 12 : 15,
        );
        notes = [
          firstGeometry.notes[0],
          note(middle, x + h + 6, y + u),
          note(upper, x + h + 6, y + v),
        ];
        if (a === 1) {
          // No invented ascending stroke: the reference begins with an
          // unmodified Punctum. The upper pair alone has a continuous join.
          ink = [
            firstGeometry.ink[0],
            shape(
              `${upperCrown} ${middleBottom} V${y + u - 6} H${x + h + 10.5} ${upperReturn} Z`,
              h,
              top,
              12,
              u + 6 - top,
            ),
          ];
        } else {
          const firstTop = `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)} H${x + 12}`;
          notes[0] = note(
            shape(`${firstTop} ${underside(0, 0)} Z`, 0, -6, 12, 12),
            x + 6,
            y,
          );
          // Trace the joined outer boundary once, including the middle hook
          // and the upper indentation. No independently composited join pieces.
          const d = `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)} H${x + h} V${y + u - 3} C${move(h + 3, u - 4)} ${move(h + 8, u - 6)} ${move(h + 10.5, u - 6)} ${upperReturn} ${upperCrown.replace('M', 'L')} ${hook} ${underside(0, 0)} Z`;
          ink = [shape(d, 0, top, h + 12, 6 - top)];
        }
      }
      // First versus upper column: horizontal ownership. Within that column,
      // split padded controls vertically at nominal pitches, not optical boxes.
      const firstTarget = notes[0].hitBounds;
      if (a === 1) firstTarget.width = x + h - firstTarget.x;
      if (a === 1) {
        for (const n of notes.slice(1)) {
          const target = n.hitBounds;
          const right = target.x + target.width;
          target.x = x + h;
          target.width = right - target.x;
        }
      }
      const split = y + (u + v) / 2;
      const middleTarget = notes[1].hitBounds;
      const bottom = middleTarget.y + middleTarget.height;
      middleTarget.y = Math.max(middleTarget.y, split);
      middleTarget.height = bottom - middleTarget.y;
      const upperTarget = notes[2].hitBounds;
      upperTarget.height =
        Math.min(upperTarget.y + upperTarget.height, split) - upperTarget.y;
    } else {
      const z = h + (b === 1 ? 12 : 10.5);
      const firstTop = `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)}`;
      const risingContact =
        a === 1 ? `H${x + 10.5} L${move(12, -7.5)}` : `H${x + h}`;
      const middleCrown = crown(h, u - 6);
      const descendingContact =
        b === 1 ? `V${y + u + 7.5} L${move(h + 10.5, u + 6)}` : `V${y + u + 6}`;
      const middleScoop = `C${move(h + 9, u + 6)} ${move(h + 8, u + 4.8)} ${move(h + 6, u + 4.8)} C${move(h + 4, u + 4.8)} ${move(h + 3, u + 6)} ${move(a === 1 ? h : h + 1.5, u + 6)}`;
      const lastTop = `H${x + z + 6} C${move(z + 9, v - 6)} ${move(z + 12, v - 5.4)} ${move(z + 12, v - 4)}`;
      notes = [
        note(
          shape(
            `${firstTop} ${a === 1 ? risingContact : `H${x + 12}`} ${underside(0, 0)} Z`,
            0,
            a === 1 ? -7.5 : -6,
            12,
            a === 1 ? 13.5 : 12,
          ),
          x + 6,
          y,
        ),
        note(
          shape(
            `${middleCrown} ${descendingContact} ${middleScoop} H${x + h} Z`,
            h,
            u - 6,
            12,
            b === 1 ? 13.5 : 12,
          ),
          x + h + 6,
          y + u,
        ),
        note(
          shape(
            `M${move(z, v - 6)} ${lastTop} ${underside(z, v)} H${x + z} Z`,
            z,
            v - 6,
            12,
            12,
          ),
          x + z + 6,
          y + v,
        ),
      ];
      const d = `${firstTop} ${risingContact} ${middleCrown.replace('M', 'L')} V${y + v - 6} ${lastTop} ${underside(z, v)} H${x + z} ${descendingContact} ${middleScoop} ${underside(0, 0)} Z`;
      ink = [shape(d, 0, u - 6, z + 12, Math.max(6, v + 6) - (u - 6))];
      // Partition adjacent padding at shared x edges. Wider heads keep full
      // padding: clipping those to columns would make visible edges unclickable.
      for (let i = 0; i < 2; i++) {
        if ((i === 0 ? a : b) !== 1) continue;
        const current = notes[i];
        const next = notes[i + 1];
        const split = next.x + (current.x + current.width - next.x) / 2;
        const target = current.hitBounds;
        target.width = split - target.x;
        const nextTarget = next.hitBounds;
        const right = nextTarget.x + nextTarget.width;
        nextTarget.x = split;
        nextTarget.width = right - split;
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
