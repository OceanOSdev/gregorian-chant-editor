import { resolveScoreSlot } from './resolve-score-slot';
import type {
  ScoreInsertionBoundary,
  NoteAppearance,
} from '../domain/chant-document';
import type { NeumeEntryPitches } from '../neume-entry-pitches';
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

export type ResolvedGraphicalNeumePlacement = NeumeEntryPitches &
  ResolvedPlacementBase;

/**
 * Couples system hit testing, a global whole-neume boundary,
 * graphical fit validation, and an ID-free caret and local ghost.
 */
export function resolveGraphicalNeumePlacement(
  layout: ChantLayout,
  kind: GraphicalNeumeKind,
  point: { x: number; y: number },
  appearance?: readonly NoteAppearance[],
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
  const slot = resolved.slot;
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
      appearance,
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
