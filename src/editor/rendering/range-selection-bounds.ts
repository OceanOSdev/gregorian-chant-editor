import type { ChantSystemLayout } from '../layout/layout-chant';

/** Decorative overlay only; never participates in engraving or hit testing. */
export function rangeSelectionBounds(
  system: ChantSystemLayout,
  ids?: ReadonlySet<string>,
) {
  const members = system.neumes.filter((n) => ids?.has(n.neumeId));
  const first = members[0];
  const last = members.at(-1);
  if (!first || !last) return null;
  const x = Math.max(first.bounds.x - 3, first.hitClip?.left ?? -Infinity);
  const right = Math.min(
    last.bounds.x + last.bounds.width + 3,
    last.hitClip?.right ?? Infinity,
  );
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
