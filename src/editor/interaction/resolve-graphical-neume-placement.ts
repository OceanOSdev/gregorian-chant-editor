import { resolveScoreSlot } from './resolve-score-slot';
import type { ScoreInsertionBoundary } from '../domain/chant-document';
import type { StaffPosition } from '../domain/chant-document';
import {
  canGraphicalNeumeFitNormalSystem,
  getSystemNeumePlacement,
  layoutGraphicalPlacementPreview,
  type ChantLayout,
  type GraphicalNeumeKind,
  type GraphicalPlacementPreviewLayout,
} from '../layout/layout-chant';

interface ResolvedPlacementBase {
  insertionIndex: number;
  boundary: ScoreInsertionBoundary;
  preview: GraphicalPlacementPreviewLayout;
}

export type ResolvedGraphicalNeumePlacement =
  | (ResolvedPlacementBase & {
      kind: 'punctum';
      staffPositions: readonly [StaffPosition];
    })
  | (ResolvedPlacementBase & {
      kind: 'podatus';
      staffPositions: readonly [StaffPosition, StaffPosition];
    })
  | (ResolvedPlacementBase & {
      kind: 'clivis';
      staffPositions: readonly [StaffPosition, StaffPosition];
    })
  | (ResolvedPlacementBase & {
      kind: 'scandicus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    })
  | (ResolvedPlacementBase & {
      kind: 'torculus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    })
  | (ResolvedPlacementBase & {
      kind: 'climacus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    })
  | (ResolvedPlacementBase & {
      kind: 'porrectus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    });

/**
 * Couples system hit testing, a global whole-neume boundary,
 * graphical fit validation, and an ID-free caret and local ghost.
 */
export function resolveGraphicalNeumePlacement(
  layout: ChantLayout,
  kind: GraphicalNeumeKind,
  point: { x: number; y: number },
): ResolvedGraphicalNeumePlacement | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  const matchingSystems = layout.systems.filter(
    (system) => point.y >= system.y && point.y <= system.y + system.height,
  );

  if (matchingSystems.length !== 1) {
    return null;
  }

  const system = matchingSystems[0];

  if (!system) {
    return null;
  }

  const placement = getSystemNeumePlacement(point, kind, system);

  if (!placement) {
    return null;
  }

  const resolved = resolveScoreSlot(layout, point);
  if (!resolved) return null;
  const slot = system.divisions.length
    ? resolved.slot
    : (system.slots.find(
        (s) => s.insertionIndex === placement.preferredNeumeInsertionIndex,
      ) ?? resolved.slot);
  const insertionIndex = slot.insertionIndex;
  const boundary = slot.boundary;

  if (
    !canGraphicalNeumeFitNormalSystem(placement.kind, placement.staffPositions)
  ) {
    return null;
  }

  const preview = layoutGraphicalPlacementPreview(
    layout,
    {
      ...placement,
      insertionIndex,
    },
    point,
  );
  if (!preview) return null;

  preview.caret = {
    systemIndex: system.index,
    x: slot.x,
    top: resolved.top,
    bottom: resolved.bottom,
  };
  switch (placement.kind) {
    case 'punctum':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        boundary,
        preview,
      };
    case 'podatus':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        boundary,
        preview,
      };
    case 'clivis':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        boundary,
        preview,
      };
    case 'scandicus':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        boundary,
        preview,
      };
    case 'climacus':
    case 'porrectus':
    case 'torculus':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        boundary,
        preview,
      };
  }
}
