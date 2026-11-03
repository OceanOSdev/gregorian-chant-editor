import type { StaffPosition } from '../../domain/chant-document';
import {
  geometryContext,
  headContours,
  firstHeadHalfWidth,
  finishGeometry,
  note,
  engravingStaffStep,
  type NoteGeometry,
  type InkShape,
  type NeumeGeometry,
} from './shared';
import { buildPunctum } from './punctum';
import { buildPodatusOrClivis } from './podatus-clivis';

export function buildScandicusOrTorculus(
  kind: 'scandicus' | 'torculus',
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { first, x, y, move, shape } = geometryContext(
    positions,
    leftX,
    bottomStaffY,
  );
  let notes: NoteGeometry[];
  let ink: readonly InkShape[];
  const lyricAnchorX = x + firstHeadHalfWidth(kind);
  const second = positions[1];
  const third = positions[2];
  if (second === undefined || third === undefined)
    throw new Error('A three-note neume must have three pitches');
  const a = second - first;
  const b = Math.abs(third - second);
  const u = (first - second) * engravingStaffStep;
  const v = (first - third) * engravingStaffStep;
  const h = a === 1 ? 12 : 10.5;
  const { crown, underside } = headContours(move, y);

  if (kind === 'scandicus') {
    const firstGeometry = buildPunctum([first], x, bottomStaffY);
    if (a === 1 && b === 1) {
      // Conventional Punctum + Pes: the two ink regions intentionally do NOT
      // touch. Semantic unity does not imply geometric connectivity.
      const pes = buildPodatusOrClivis(
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

  return finishGeometry(notes, ink, lyricAnchorX);
}
