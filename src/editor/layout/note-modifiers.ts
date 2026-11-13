import type { Neume, NoteModifiers } from '../domain/chant-document';
import {
  getInkBounds,
  interNeumeInkGap,
  type InkShape,
  type LayoutBounds,
  type NeumeGeometry,
} from './neumes/shared';

function overlaps(a: LayoutBounds, b: LayoutBounds, clearance = 2): boolean {
  return (
    a.x < b.x + b.width + clearance &&
    a.x + a.width + clearance > b.x &&
    a.y < b.y + b.height + clearance &&
    a.y + a.height + clearance > b.y
  );
}

/** Derived signs use conservative occupied rectangles, including ribbons/stems. */
export function addNoteModifiers(
  geometry: NeumeGeometry,
  modifiers: readonly NoteModifiers[],
  bottomStaffY: number,
  kind: Neume['kind'],
): NeumeGeometry {
  if (!modifiers.some((n) => n.mora || n.episema || n.verticalEpisema))
    return geometry;
  const ink = [...geometry.ink];
  const signs: InkShape[] = [];
  const noteSigns: InkShape[][] = geometry.notes.map(() => []);
  const clear = (bounds: LayoutBounds) =>
    ![...ink, ...signs].some((part) => overlaps(bounds, part.bounds)) &&
    ![0, 2, 4, 6].some((position) => {
      const lineY = bottomStaffY - position * 12;
      return bounds.y < lineY + 1 && bounds.y + bounds.height > lineY - 1;
    });
  // Prefer above, then below. Keep separate strokes rather than imply an unsafe bridge.
  geometry.notes.forEach((note, index) => {
    if (!modifiers[index]?.episema) return;
    for (const distance of [16, 22, 28, 34, 40, Infinity]) {
      const candidates = [
        {
          x: note.anchorX - 6,
          y:
            distance === Infinity
              ? Math.min(geometry.bounds.y - 16, bottomStaffY - 88)
              : note.anchorY - distance,
          width: 12,
          height: 2,
        },
        {
          x: note.anchorX - 6,
          y:
            distance === Infinity
              ? Math.max(
                  geometry.bounds.y + geometry.bounds.height + 14,
                  bottomStaffY + 16,
                )
              : note.anchorY + distance - 2,
          width: 12,
          height: 2,
        },
      ];
      const bounds = candidates.find(clear);
      if (bounds) {
        const sign: InkShape = { kind: 'rect', bounds, radius: 0 };
        signs.push(sign);
        noteSigns[index].push(sign);
        break;
      }
    }
  });
  const marked = geometry.notes.flatMap((_, index) =>
    modifiers[index]?.mora ? [index] : [],
  );
  const right = geometry.bounds.x + geometry.bounds.width;
  const position = (index: number) =>
    Math.round((bottomStaffY - geometry.notes[index].anchorY) / 12);
  const row = (index: number, below: boolean) =>
    geometry.notes[index].anchorY +
    (position(index) % 2 === 0 ? (below ? 12 : -12) : 0);
  const dot = (x: number, y: number): LayoutBounds => ({
    x,
    y: y - 2,
    width: 4,
    height: 4,
  });
  const append = (index: number, bounds: LayoutBounds) => {
    const sign: InkShape = { kind: 'rect', bounds, radius: 2 };
    signs.push(sign);
    noteSigns[index].push(sign);
  };
  if (marked.length === 2) {
    // Gregorio's auctum duplex: sort the two affected pitches, put an
    // adjacent lower line's dot below, and paint both in one trailing column.
    // The common x is resolved for the pair, never as two independent counts.
    const [a, b] = marked;
    const lower = position(a) < position(b) ? a : b;
    const adjacent = Math.abs(position(a) - position(b)) === 1;
    const rows = marked.map((i) => row(i, i === lower && adjacent));
    const columns = [
      right + 3,
      ...signs.map((s) => s.bounds.x + s.bounds.width + 3),
    ]
      .filter((x) => x >= right + 3)
      .sort((a, b) => a - b);
    const x = columns.find((x) => rows.every((y) => clear(dot(x, y))));
    if (x !== undefined)
      marked.forEach((index, i) => append(index, dot(x, rows[i])));
  } else if (marked.length === 1) {
    const index = marked[0];
    const note = geometry.notes[index];
    // Lower Podatus singles use the same adjacent-ascent exception as the
    // lower member of the compound sign. Clivis first singles stay left of
    // the final note's dot position, as in Gregorio's shifted single sign.
    const below =
      kind === 'podatus' && index === 0 && position(1) - position(0) === 1;
    const y = row(
      index,
      below ||
        kind === 'torculus' ||
        kind === 'climacus' ||
        kind === 'pes-subpunctis',
    );
    const initialX = kind === 'porrectus' ? right + 3 : note.anchorX + 11;
    const columns = [
      initialX,
      right + 3,
      ...signs.map((s) => s.bounds.x + s.bounds.width + 3),
    ]
      .filter((x) => x >= initialX)
      .sort((a, b) => a - b);
    // Clivis ink is one compound path whose occupied rectangle includes the
    // empty area to the right of its upper head. Heads plus the left stem/
    // connector give a conservative collision partition for this single case.
    const singleClear = (bounds: LayoutBounds) =>
      kind === 'clivis' && index === 0
        ? ![...geometry.notes.map((n) => n.head), ...signs].some((s) =>
            overlaps(bounds, s.bounds),
          ) &&
          bounds.x >= geometry.notes[0].anchorX + 9 &&
          ![0, 2, 4, 6].some(
            (p) => Math.abs(bounds.y + 2 - (bottomStaffY - p * 12)) < 3,
          )
        : clear(bounds);
    const x = columns.find((x) => singleClear(dot(x, y)));
    if (x !== undefined) append(index, dot(x, y));
  }
  // Resolve vertical signs last so horizontal episemata and mora retain their
  // established geometry. Compound occupied boxes include empty apertures;
  // use the same head regions and the recipes' narrow shafts for this pass.
  const obstacles = verticalObstacles(geometry, kind);
  const verticalClear = (bounds: LayoutBounds) =>
    bounds.x >= geometry.bounds.x &&
    ![...obstacles, ...signs.map((sign) => sign.bounds)].some((part) =>
      overlaps(bounds, part),
    ) &&
    ![0, 2, 4, 6].some((position) => {
      const lineY = bottomStaffY - position * 12;
      // The staff stroke does not scale with the SVG. Four layout units
      // keep ordinary narrow-view ticks visually separate from its raster ink.
      return bounds.y < lineY + 4 && bounds.y + bounds.height > lineY - 4;
    });
  geometry.notes.forEach((note, index) => {
    if (!modifiers[index]?.verticalEpisema) return;
    const candidates: LayoutBounds[] = [];
    for (const below of [true, false]) {
      for (const offsetX of [0, -9, 9, -15, 15]) {
        for (const distance of [10, 14, 18, 22, 26, 30]) {
          candidates.push({
            x: note.anchorX + offsetX - 0.75,
            y: note.anchorY + (below ? distance : -distance - 7),
            width: 1.5,
            height: 7,
          });
        }
      }
    }
    // Never move an upper tick past a lower constituent in the same column
    // (or vice versa): clear ink alone would visually assign it to that note.
    const bounds = candidates.find(
      (candidate) =>
        verticalClear(candidate) &&
        geometry.notes.every((other, otherIndex) => {
          if (
            otherIndex === index ||
            Math.abs(other.anchorX - note.anchorX) > 7
          )
            return true;
          return other.anchorY > note.anchorY
            ? candidate.y + candidate.height <= other.head.bounds.y - 2
            : candidate.y >= other.head.bounds.y + other.head.bounds.height + 2;
        }),
    );
    if (!bounds)
      throw new Error('No local vertical episema placement for this geometry');
    const sign: InkShape = {
      kind: 'rect',
      bounds,
      radius: 0,
      rasterization: 'vertical-episema',
    };
    signs.push(sign);
    noteSigns[index].push(sign);
  });
  ink.push(...signs);
  const bounds = getInkBounds(ink);
  return {
    ...geometry,
    notes: geometry.notes.map((note, index) =>
      noteSigns[index].length
        ? {
            ...note,
            modifierBounds: getInkBounds(noteSigns[index]),
          }
        : note,
    ),
    ink,
    bounds,
    advanceX: bounds.width + interNeumeInkGap,
  };
}

/** Conservative head/shaft partitions of the existing contour recipes. */
function verticalObstacles(
  geometry: NeumeGeometry,
  kind: Neume['kind'],
): LayoutBounds[] {
  const heads = geometry.notes.map((note) => note.head.bounds);
  const obstacles = [...heads];
  const addShaft = (x: number, top: number, bottom: number) => {
    if (bottom > top)
      obstacles.push({ x, y: top, width: 1.5, height: bottom - top });
  };
  const first = geometry.notes[0];
  const bottom = geometry.bounds.y + geometry.bounds.height;
  if (kind === 'punctum') {
    // An authored virga alone adds a descending right queue.
    if (bottom > first.head.bounds.y + first.head.bounds.height)
      addShaft(first.x + first.width - 1.5, first.anchorY, bottom);
  } else if (kind === 'climacus') {
    addShaft(first.x + first.width - 1.5, first.anchorY, first.anchorY + 27);
  } else if (kind === 'pes-subpunctis') {
    // Only the Podatus is joined; the descending diamonds are detached.
    const apex = geometry.notes[1];
    addShaft(first.x + first.width - 1.5, apex.anchorY, first.anchorY);
  } else {
    if (kind === 'clivis' || kind === 'porrectus')
      addShaft(geometry.bounds.x, first.anchorY, bottom);
    for (let index = 1; index < geometry.notes.length; index++) {
      const previous = geometry.notes[index - 1];
      const current = geometry.notes[index];
      const ascending = current.anchorY < previous.anchorY;
      // Porrectus's first connection is the ribbon, already covered by its
      // two constituent regions. Its final ascent uses the usual right join.
      if (kind === 'porrectus' && index === 1) continue;
      const x = ascending ? previous.x + previous.width - 1.5 : current.x;
      addShaft(
        x,
        Math.min(previous.anchorY, current.anchorY),
        Math.max(previous.anchorY, current.anchorY),
      );
    }
  }
  return obstacles;
}
