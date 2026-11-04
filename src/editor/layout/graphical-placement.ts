import { staffPosition, type StaffPosition } from '../domain/chant-document';
import {
  createNeumeEntryPitches,
  type GraphicalNeumeKind,
  type GraphicalStaffPositions,
  type NeumeEntryPitches,
} from '../neume-entry-pitches';
import type { ChantLayout, ChantSystemLayout } from './layout-chant';
import {
  buildNeumeGeometry,
  firstHeadHalfWidth,
  interNeumeInkGap,
  type NeumeGeometry,
} from './neume-geometry';
import {
  staffStartX,
  staffEndX,
  firstNeumeCenterX,
  firstSystemBottomStaffY,
  staffStep,
  staffPositionY,
} from './staff-metrics';

export type GraphicalNeumePlacement = NeumeEntryPitches & {
  firstStaffPosition: StaffPosition;
  preferredNeumeInsertionIndex: number;
};

/** Insertion intent on committed systems, not hypothetical engraved placement. */
export type GraphicalPlacementPreviewLayout = NeumeGeometry & {
  kind: GraphicalNeumeKind;
  pointerSystemIndex: number;
  caret: { systemIndex: number; x: number; top: number; bottom: number };
};

export type GraphicalPlacementPreviewInput = NeumeEntryPitches & {
  insertionIndex: number;
};

export function canGraphicalNeumeFitNormalSystem(
  kind: GraphicalNeumeKind,
  staffPositions: GraphicalStaffPositions,
) {
  const geometry = buildNeumeGeometry(
    kind,
    staffPositions,
    firstNeumeCenterX - firstHeadHalfWidth(kind),
    firstSystemBottomStaffY,
  );
  return (
    geometry.bounds.x >= staffStartX &&
    geometry.bounds.x + geometry.bounds.width <= staffEndX
  );
}

/** Ghost follows the pointer; caret follows the semantic boundary. */
export function layoutGraphicalPlacementPreview(
  layout: ChantLayout,
  placement: GraphicalPlacementPreviewInput,
  point: { x: number; y: number },
): GraphicalPlacementPreviewLayout | null {
  const total = layout.systems.reduce(
    (count, system) => count + system.neumes.length,
    0,
  );
  if (
    !Number.isInteger(placement.insertionIndex) ||
    placement.insertionIndex < 0 ||
    placement.insertionIndex > total ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  )
    return null;
  const source = layout.systems.find(
    (system) => point.y >= system.y && point.y <= system.y + system.height,
  );
  if (!source?.staffLines.length) return null;
  // A boundary shared by two systems belongs to the hovered system when possible.
  // Otherwise follow the next semantic neume, or the final committed system.
  const at = placement.insertionIndex;
  const target =
    at >= source.startNeumeIndex &&
    at <= source.startNeumeIndex + source.neumes.length
      ? source
      : (layout.systems.find(
          (system) =>
            at >= system.startNeumeIndex &&
            at < system.startNeumeIndex + system.neumes.length,
        ) ?? layout.systems.at(-1));
  if (!target?.staffLines.length) return null;
  const offset = at - target.startNeumeIndex;
  const previous = target.neumes[offset - 1];
  const following = target.neumes[offset];
  const previousRight = previous
    ? previous.bounds.x + previous.bounds.width
    : null;
  const boundaryX = following
    ? previousRight === null
      ? following.bounds.x - interNeumeInkGap / 2
      : (previousRight + following.bounds.x) / 2
    : previousRight === null
      ? firstNeumeCenterX
      : previousRight + interNeumeInkGap / 2;
  const bottomStaffY = Math.max(...source.staffLines.map((line) => line.y));
  const measured = buildNeumeGeometry(
    placement.kind,
    placement.staffPositions,
    0,
    bottomStaffY,
  );
  // Keep the actual shape visible at crowded ends without changing its pitch or scale.
  const left = Math.max(
    source.staffLines[0].x1 + 3,
    Math.min(
      source.staffLines[0].x2 - measured.bounds.width - 3,
      point.x - firstHeadHalfWidth(placement.kind),
    ),
  );
  return {
    ...buildNeumeGeometry(
      placement.kind,
      placement.staffPositions,
      left,
      bottomStaffY,
    ),
    kind: placement.kind,
    pointerSystemIndex: source.index,
    caret: {
      systemIndex: target.index,
      x: Math.max(
        target.staffLines[0].x1 + 3,
        Math.min(target.staffLines[0].x2 - 3, boundaryX),
      ),
      top: Math.min(...target.staffLines.map((line) => line.y)) - 12,
      bottom: Math.max(...target.staffLines.map((line) => line.y)) + 12,
    },
  };
}

/**
 * Resolves a score-absolute point within one rendered system. Exact
 * vertical half-step ties snap upward to the higher StaffPosition. A point at
 * a neume's bounds midpoint resolves before it, and startNeumeIndex converts
 * that system-local boundary to the global semantic boundary.
 */
export function getSystemNeumePlacement(
  point: { x: number; y: number },
  kind: GraphicalNeumeKind,
  system: ChantSystemLayout,
): GraphicalNeumePlacement | null {
  const bottomStaffY =
    system.staffLines.length > 0
      ? Math.max(...system.staffLines.map((line) => line.y))
      : undefined;

  if (bottomStaffY === undefined) {
    return null;
  }

  const minimumPlacementY = staffPositionY(staffPosition(7), bottomStaffY);
  const maximumPlacementY = staffPositionY(staffPosition(-1), bottomStaffY);

  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < staffStartX ||
    point.x > (system.staffLines[0]?.x2 ?? staffEndX) ||
    point.y < minimumPlacementY ||
    point.y > maximumPlacementY
  ) {
    return null;
  }

  const snappedPosition = Math.round((bottomStaffY - point.y) / staffStep) || 0;
  const firstStaffPosition = staffPosition(snappedPosition);
  let neumeInsertionIndex = system.neumes.length;

  for (const [index, neume] of system.neumes.entries()) {
    const midpoint = neume.bounds.x + neume.bounds.width / 2;

    if (point.x <= midpoint) {
      neumeInsertionIndex = index;
      break;
    }
  }

  return {
    ...createNeumeEntryPitches(kind, firstStaffPosition),
    firstStaffPosition,
    preferredNeumeInsertionIndex: system.startNeumeIndex + neumeInsertionIndex,
  };
}
