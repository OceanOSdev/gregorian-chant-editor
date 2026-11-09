import type { NoteModifiers } from '../domain/chant-document';
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
): NeumeGeometry {
  if (!modifiers.some((n) => n.mora || n.episema)) return geometry;
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
  geometry.notes.forEach((note, index) => {
    const count = modifiers[index]?.mora;
    if (!count) return;
    // Line notes prefer the adjacent space above. Double mora is a vertical pair.
    const position = Math.round((bottomStaffY - note.anchorY) / 12);
    const y = note.anchorY - (position % 2 === 0 ? 12 : 0);
    const initialX = note.anchorX + 11;
    const columns = [
      initialX,
      ...[...ink, ...signs].map(
        (part) => part.bounds.x + part.bounds.width + 3,
      ),
    ]
      .filter((x) => x >= initialX)
      .sort((a, b) => a - b);
    for (const x of columns) {
      const rows = position % 2 === 0 ? [y, y + 24] : [y];
      const candidates = rows.map((centerY) =>
        Array.from({ length: count }, (_, dot) => ({
          x,
          y: centerY + dot * 24 - 2,
          width: 4,
          height: 4,
        })),
      );
      const dots = candidates.find((dots) => dots.every(clear));
      if (dots) {
        const parts = dots.map((bounds) => ({
          kind: 'rect' as const,
          bounds,
          radius: 2,
        }));
        signs.push(...parts);
        noteSigns[index].push(...parts);
        break;
      }
    }
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
