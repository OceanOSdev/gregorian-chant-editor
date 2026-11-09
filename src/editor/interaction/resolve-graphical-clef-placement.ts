import { isValidClef } from '../domain/clef';
import type {
  Clef,
  ScoreInsertionBoundary,
  StaffLine,
} from '../domain/chant-document';
import { buildClefGeometry, type ClefGeometry } from '../layout/clef-geometry';
import type { ChantLayout } from '../layout/layout-chant';
import { resolveScoreSlot } from './resolve-score-slot';

export interface ClefPlacementCursor {
  boundary: ScoreInsertionBoundary;
  staffLine: StaffLine;
}
export interface ClefPlacementPreview {
  clef: ClefGeometry;
  caret: { x: number; top: number; bottom: number };
  systemIndex: number;
}
export interface ResolvedClefPlacement extends ClefPlacementCursor {
  clef: Clef;
  preview: ClefPlacementPreview;
}

/** The ghost uses the real glyph and the same displayed slot as commit. */
function atSlot(
  layout: ChantLayout,
  systemIndex: number,
  slotIndex: number,
  type: Clef['type'],
  staffLine: StaffLine,
): ResolvedClefPlacement | null {
  const system = layout.systems[systemIndex];
  const slot = system?.slots[slotIndex];
  if (!system || !slot || !system.staffLines.length) return null;
  const bottom = Math.max(...system.staffLines.map((l) => l.y));
  const top = Math.min(...system.staffLines.map((l) => l.y));
  const clef = { type, staffLine };
  const origin = buildClefGeometry(clef, 0, 0).bounds;
  const left = Math.max(
    system.staffLines[0].x1 + 3,
    Math.min(
      system.staffLines[0].x2 - origin.width - 3,
      slot.x - origin.width / 2,
    ),
  );
  return {
    boundary: slot.boundary,
    staffLine,
    clef,
    preview: {
      systemIndex,
      clef: buildClefGeometry(
        clef,
        left - origin.x,
        system.staffLines[staffLine - 1].y,
      ),
      caret: { x: slot.x, top: top - 12, bottom: bottom + 12 },
    },
  };
}

/** Half a staff space beyond the outer lines is a hit band, never a clamp outside it. */
export function resolveGraphicalClefPlacement(
  layout: ChantLayout,
  type: Clef['type'],
  point: { x: number; y: number },
): ResolvedClefPlacement | null {
  if (type !== 'c' && type !== 'f') return null;
  const resolved = resolveScoreSlot(layout, point);
  if (!resolved) return null;
  const system = layout.systems[resolved.systemIndex];
  const line = ([1, 2, 3, 4] as const).reduce((best, current) =>
    Math.abs(system.staffLines[current - 1].y - point.y) <=
    Math.abs(system.staffLines[best - 1].y - point.y)
      ? current
      : best,
  );
  return atSlot(
    layout,
    system.index,
    system.slots.indexOf(resolved.slot),
    type,
    line,
  );
}

export function resolveKeyboardClefPlacement(
  layout: ChantLayout,
  type: Clef['type'],
  cursor: ClefPlacementCursor,
): ResolvedClefPlacement | null {
  if (
    (type !== 'c' && type !== 'f') ||
    ![1, 2, 3, 4].includes(cursor.staffLine)
  )
    return null;
  // Prefer the continuation-side copy of a shared semantic boundary.
  for (const system of [...layout.systems].reverse()) {
    const index = system.slots.findIndex(
      (s) =>
        s.boundary.beforeNeumeId === cursor.boundary.beforeNeumeId &&
        s.boundary.beforeDivisionId === cursor.boundary.beforeDivisionId &&
        s.boundary.beforeClefId === cursor.boundary.beforeClefId,
    );
    if (index >= 0)
      return atSlot(layout, system.index, index, type, cursor.staffLine);
  }
  return null;
}

/** Preview an existing clef in place only when its draft glyph fits safely. */
export function layoutClefDraftPreview(
  layout: ChantLayout,
  id: string,
  clef: Clef,
): { id: string; clef: ClefGeometry } | null {
  if (!isValidClef(clef)) return null;
  const system = layout.systems.find((s) =>
    s.clefChanges.some((c) => c.clefChangeId === id),
  );
  const current = system?.clefChanges.find((c) => c.clefChangeId === id);
  if (!system || !current) return null;
  const draft = buildClefGeometry(
    clef,
    current.x,
    system.staffLines[clef.staffLine - 1].y,
  );
  const left = draft.bounds.x,
    right = left + draft.bounds.width;
  const others = [
    ...system.neumes,
    ...system.divisions,
    ...system.custodes,
    ...system.clefChanges.filter((c) => c.clefChangeId !== id),
  ];
  if (
    left < system.staffLines[0].x1 ||
    right > system.staffLines[0].x2 ||
    others.some(
      (item) =>
        left < item.bounds.x + item.bounds.width && right > item.bounds.x,
    )
  )
    return null;
  return { id, clef: draft };
}
