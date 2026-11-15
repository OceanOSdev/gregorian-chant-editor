import type { ChantSystemLayout } from '../layout/layout-chant';
import { paddedOwnedExtent } from './neume-selection-bounds';

/** Decorative overlay only; never participates in engraving or hit testing. */
export function rangeSelectionBounds(
  system: ChantSystemLayout,
  ids?: ReadonlySet<string>,
) {
  const members = system.neumes.filter((n) => ids?.has(n.neumeId));
  const first = members[0];
  const last = members.at(-1);
  if (!first || !last) return null;
  const x = paddedOwnedExtent(first, 3).left;
  const right = paddedOwnedExtent(last, 3).right;
  const y =
    Math.min(
      ...members.map((n) => n.bounds.y),
      ...system.staffLines.map((l) => l.y),
    ) - 4;
  const musicBottom =
    Math.max(
      ...members.map((n) => n.bounds.y + n.bounds.height),
      ...system.staffLines.map((l) => l.y),
    ) + 4;
  const lyricTop = Math.min(...system.lyrics.map((l) => l.y - l.fontSize));
  const bottom = Math.min(musicBottom, lyricTop - 2);
  return { x, y, width: right - x, height: Math.max(0, bottom - y) };
}
