import type { ChantLayout, ScoreSlotLayout } from '../layout/layout-chant';
import { staffEndX, staffStartX, staffStep } from '../layout/layout-chant';

/** Resolve explicit slots on the displayed system; no numeric-side inference. */
export function resolveScoreSlot(
  layout: ChantLayout,
  point: { x: number; y: number },
): {
  slot: ScoreSlotLayout;
  systemIndex: number;
  top: number;
  bottom: number;
} | null {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < staffStartX ||
    point.x > staffEndX
  )
    return null;
  const system = layout.systems.find(
    (s) => point.y >= s.y && point.y <= s.y + s.height,
  );
  if (!system?.staffLines.length) return null;
  const bottom = Math.max(...system.staffLines.map((l) => l.y));
  const top = Math.min(...system.staffLines.map((l) => l.y));
  if (point.y < bottom - 7 * staffStep || point.y > bottom + staffStep)
    return null;
  const slot = system.slots.reduce<ScoreSlotLayout | null>(
    (nearest, current) =>
      !nearest || Math.abs(current.x - point.x) < Math.abs(nearest.x - point.x)
        ? current
        : nearest,
    null,
  );
  return slot
    ? { slot, systemIndex: system.index, top: top - 12, bottom: bottom + 12 }
    : null;
}
