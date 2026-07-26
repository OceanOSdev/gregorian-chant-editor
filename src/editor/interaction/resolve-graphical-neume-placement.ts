import { resolveSyllableNeumeInsertionIndex } from '../commands/resolve-syllable-neume-insertion';
import type { ChantDocument, StaffPosition } from '../domain/chant-document';
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
    });

/**
 * Couples system hit testing, a global whole-neume boundary, active-syllable
 * clamping, graphical fit validation, and an ID-free post-reflow preview.
 */
export function resolveGraphicalNeumePlacement(
  document: ChantDocument,
  layout: ChantLayout,
  activeSyllableId: string | null,
  kind: GraphicalNeumeKind,
  point: { x: number; y: number },
): ResolvedGraphicalNeumePlacement | null {
  if (
    !activeSyllableId ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !document.syllables.some((syllable) => syllable.id === activeSyllableId)
  ) {
    return null;
  }

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

  const insertionIndex = resolveSyllableNeumeInsertionIndex(
    document,
    activeSyllableId,
    placement.preferredNeumeInsertionIndex,
  );

  if (
    insertionIndex === null ||
    !canGraphicalNeumeFitNormalSystem(placement.kind, placement.staffPositions)
  ) {
    return null;
  }

  const preview = (() => {
    switch (placement.kind) {
      case 'punctum':
        return layoutGraphicalPlacementPreview(document.neumes, {
          kind: placement.kind,
          staffPositions: placement.staffPositions,
          insertionIndex,
        });
      case 'podatus':
        return layoutGraphicalPlacementPreview(document.neumes, {
          kind: placement.kind,
          staffPositions: placement.staffPositions,
          insertionIndex,
        });
      case 'clivis':
        return layoutGraphicalPlacementPreview(document.neumes, {
          kind: placement.kind,
          staffPositions: placement.staffPositions,
          insertionIndex,
        });
      case 'scandicus':
        return layoutGraphicalPlacementPreview(document.neumes, {
          kind: placement.kind,
          staffPositions: placement.staffPositions,
          insertionIndex,
        });
    }
  })();

  if (!preview || preview.kind !== placement.kind) {
    return null;
  }

  switch (placement.kind) {
    case 'punctum':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        preview,
      };
    case 'podatus':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        preview,
      };
    case 'clivis':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        preview,
      };
    case 'scandicus':
      return {
        kind: placement.kind,
        staffPositions: placement.staffPositions,
        insertionIndex,
        preview,
      };
  }
}
