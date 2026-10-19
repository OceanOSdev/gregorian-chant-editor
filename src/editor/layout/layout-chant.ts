import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type StaffLine,
  type StaffPosition,
} from '../domain/chant-document';
import {
  buildNeumeGeometry,
  firstHeadHalfWidth,
  engravingStaffStep,
  type NeumeGeometry,
  type NoteGeometry,
} from './neume-geometry';
export type { LayoutBounds } from './neume-geometry';

export interface StaffLineLayout {
  x1: number;
  x2: number;
  y: number;
}

export interface ClefLayout {
  type: 'c';
  staffLine: StaffLine;
  x: number;
  y: number;
  fontSize: number;
}

export interface NoteLayout extends NoteGeometry {
  noteId: string;
}

export interface NeumeLayout extends Omit<NeumeGeometry, 'notes'> {
  neumeId: string;
  lyricSyllableId: string;
  kind: Neume['kind'];
  notes: readonly NoteLayout[];
}

export interface LyricLayout {
  syllableId: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

/**
 * One derived system. All child geometry is currently score-absolute, and
 * startNeumeIndex is the global semantic index of its first neume.
 */
export interface ChantSystemLayout {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  staffLines: readonly StaffLineLayout[];
  clef: ClefLayout;
  neumes: readonly NeumeLayout[];
  lyrics: readonly LyricLayout[];
  startNeumeIndex: number;
}

/** Derived, score-absolute geometry with height determined by system count. */
export interface ChantLayout {
  title: string;
  width: number;
  height: number;
  systems: readonly ChantSystemLayout[];
}

export type GraphicalNeumeKind =
  | 'punctum'
  | 'podatus'
  | 'clivis'
  | 'scandicus'
  | 'torculus'
  | 'climacus'
  | 'porrectus';

export type GraphicalStaffPositions =
  | readonly [StaffPosition]
  | readonly [StaffPosition, StaffPosition]
  | readonly [StaffPosition, StaffPosition, StaffPosition];

export type GraphicalNeumePlacement =
  | {
      kind: 'punctum';
      firstStaffPosition: StaffPosition;
      staffPositions: readonly [StaffPosition];
      preferredNeumeInsertionIndex: number;
    }
  | {
      kind: 'podatus';
      firstStaffPosition: StaffPosition;
      staffPositions: readonly [StaffPosition, StaffPosition];
      preferredNeumeInsertionIndex: number;
    }
  | {
      kind: 'clivis';
      firstStaffPosition: StaffPosition;
      staffPositions: readonly [StaffPosition, StaffPosition];
      preferredNeumeInsertionIndex: number;
    }
  | {
      kind: 'scandicus';
      firstStaffPosition: StaffPosition;
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
      preferredNeumeInsertionIndex: number;
    }
  | {
      kind: 'torculus';
      firstStaffPosition: StaffPosition;
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
      preferredNeumeInsertionIndex: number;
    }
  | {
      kind: 'climacus';
      firstStaffPosition: StaffPosition;
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
      preferredNeumeInsertionIndex: number;
    }
  | {
      kind: 'porrectus';
      firstStaffPosition: StaffPosition;
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
      preferredNeumeInsertionIndex: number;
    };

export type GraphicalPlacementPreviewLayout = NeumeGeometry & {
  kind: GraphicalNeumeKind;
  /** Prospective score extent, so a ghost on a new system is not clipped. */
  scoreHeight: number;
  /** Complete visual result; candidate has no semantic IDs or controls. */
  systems?: readonly GraphicalPreviewSystemLayout[];
};

export interface GraphicalPreviewSystemLayout extends Omit<
  ChantSystemLayout,
  'neumes'
> {
  neumes: readonly (NeumeGeometry & {
    candidate: boolean;
    lyricSyllableId: string;
  })[];
}

export type GraphicalPlacementPreviewInput =
  | {
      kind: 'punctum';
      staffPositions: readonly [StaffPosition];
      insertionIndex: number;
    }
  | {
      kind: 'podatus';
      staffPositions: readonly [StaffPosition, StaffPosition];
      insertionIndex: number;
    }
  | {
      kind: 'clivis';
      staffPositions: readonly [StaffPosition, StaffPosition];
      insertionIndex: number;
    }
  | {
      kind: 'scandicus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
      insertionIndex: number;
    }
  | {
      kind: 'torculus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
      insertionIndex: number;
    }
  | {
      kind: 'climacus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
      insertionIndex: number;
    }
  | {
      kind: 'porrectus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
      insertionIndex: number;
    };

export const scoreWidth = 720;
export const systemWidth = scoreWidth;
export const systemHeight = 220;
export const systemGap = 24;
export const systemVerticalAdvance = systemHeight + systemGap;
export const svgTopPadding = 0;
export const svgBottomPadding = 0;
export const firstSystemTopY = svgTopPadding;
export const firstSystemBottomY = firstSystemTopY + systemHeight;
export const staffStartX = 64;
export const staffEndX = 656;
export const firstNeumeCenterX = 230;
export const clefX = 100;
export const firstSystemBottomStaffY = 124;
export const staffLineSpacing = engravingStaffStep * 2;
export const staffStep = engravingStaffStep;
export const firstSystemLyricBaselineY = 180;

/**
 * Converts semantic pitch to an absolute y coordinate in the score.
 * Callers laying out later systems supply that system's bottom-staff y.
 */
export function staffPositionY(
  position: StaffPosition,
  bottomStaffY = firstSystemBottomStaffY,
) {
  return bottomStaffY - position * staffStep;
}

function staffLineY(line: StaffLine, bottomStaffY: number) {
  return bottomStaffY - (line - 1) * staffLineSpacing;
}

interface GeometryInput {
  kind: Neume['kind'];
  staffPositions: readonly StaffPosition[];
}

interface PositionedSystem {
  startNeumeIndex: number;
  geometries: readonly NeumeGeometry[];
}

function geometryInput(neume: Neume): GeometryInput {
  return {
    kind: neume.kind,
    staffPositions: neume.notes.map((note) => note.staffPosition),
  };
}

/** One sequence walker owns advances, exact-fit wrapping, and oversized progress. */
function placeNeumeSequence(
  inputs: readonly GeometryInput[],
  usableRightBoundary = staffEndX,
): readonly PositionedSystem[] {
  const systems: PositionedSystem[] = [];
  let geometries: NeumeGeometry[] = [];
  let startNeumeIndex = 0;
  let nextLeftX = 0;
  function finishSystem() {
    systems.push({ startNeumeIndex, geometries });
    startNeumeIndex += geometries.length;
    geometries = [];
  }
  for (const input of inputs) {
    const build = () =>
      buildNeumeGeometry(
        input.kind,
        input.staffPositions,
        geometries.length
          ? nextLeftX
          : firstNeumeCenterX - firstHeadHalfWidth(input.kind),
        firstSystemBottomStaffY + systems.length * systemVerticalAdvance,
      );
    let geometry = build();
    if (
      geometries.length &&
      geometry.bounds.x + geometry.bounds.width > usableRightBoundary
    ) {
      finishSystem();
      geometry = build();
    }
    geometries.push(geometry);
    nextLeftX = geometry.bounds.x + geometry.advanceX;
    if (geometry.bounds.x + geometry.bounds.width > usableRightBoundary)
      finishSystem();
  }
  if (geometries.length || systems.length === 0) finishSystem();
  return systems;
}

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

export function measureNeumeWidth(neume: Neume): number {
  return buildNeumeGeometry(
    neume.kind,
    geometryInput(neume).staffPositions,
    0,
    firstSystemBottomStaffY,
  ).bounds.width;
}

export function wrapNeumes(
  neumes: readonly Neume[],
  usableRightBoundary = staffEndX,
) {
  return placeNeumeSequence(neumes.map(geometryInput), usableRightBoundary).map(
    (system) => ({
      startNeumeIndex: system.startNeumeIndex,
      neumes: neumes.slice(
        system.startNeumeIndex,
        system.startNeumeIndex + system.geometries.length,
      ),
    }),
  );
}

export function getNeumeLyricAlignmentX(
  neume: Pick<NeumeGeometry, 'lyricAnchorX'>,
): number | null {
  return Number.isFinite(neume.lyricAnchorX) ? neume.lyricAnchorX : null;
}

/** Unwrapped boundary helper; runtime pointer boundaries use positioned ink bounds. */
export function getNeumeBoundaryCenterX(
  neumes: readonly Neume[],
  insertionIndex: number,
): number | null {
  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > neumes.length
  )
    return null;
  if (!neumes.length) return firstNeumeCenterX;
  const positioned = placeNeumeSequence(
    neumes.map(geometryInput),
    Number.POSITIVE_INFINITY,
  )[0];
  if (!positioned) return null;
  const following = positioned.geometries[insertionIndex];
  if (following) return following.notes[0]?.anchorX ?? null;
  const final = positioned.geometries.at(-1);
  return final
    ? final.bounds.x + final.advanceX + firstHeadHalfWidth('punctum')
    : firstNeumeCenterX;
}

/** The candidate is ID-free and runs through exactly the committed placement pass. */
export function layoutGraphicalPlacementPreview(
  neumes: readonly Neume[],
  placement: GraphicalPlacementPreviewInput,
  context?: { document: ChantDocument; lyricSyllableId: string },
): GraphicalPlacementPreviewLayout | null {
  if (
    !Number.isInteger(placement.insertionIndex) ||
    placement.insertionIndex < 0 ||
    placement.insertionIndex > neumes.length
  )
    return null;
  const inputs = neumes.map(geometryInput);
  inputs.splice(placement.insertionIndex, 0, placement);
  const systems = placeNeumeSequence(inputs);
  const system = systems.find(
    (candidate) =>
      placement.insertionIndex >= candidate.startNeumeIndex &&
      placement.insertionIndex <
        candidate.startNeumeIndex + candidate.geometries.length,
  );
  const geometry =
    system?.geometries[placement.insertionIndex - system.startNeumeIndex];
  return geometry
    ? {
        ...geometry,
        kind: placement.kind,
        ...(context
          ? {
              systems: layoutSystems(
                context.document,
                systems,
                (geometry, index) => ({
                  ...geometry,
                  candidate: index === placement.insertionIndex,
                  lyricSyllableId:
                    index === placement.insertionIndex
                      ? context.lyricSyllableId
                      : neumes[
                          index < placement.insertionIndex ? index : index - 1
                        ].lyricSyllableId,
                }),
              ),
            }
          : {}),
        scoreHeight:
          firstSystemBottomY +
          (systems.length - 1) * systemVerticalAdvance +
          svgBottomPadding,
      }
    : null;
}

function createGraphicalNeumePlacement(
  kind: GraphicalNeumeKind,
  firstStaffPosition: StaffPosition,
  preferredNeumeInsertionIndex: number,
): GraphicalNeumePlacement {
  switch (kind) {
    case 'punctum':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [firstStaffPosition],
        preferredNeumeInsertionIndex,
      };
    case 'podatus':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 1),
        ],
        preferredNeumeInsertionIndex,
      };
    case 'clivis':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition - 1),
        ],
        preferredNeumeInsertionIndex,
      };
    case 'scandicus':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 1),
          staffPosition(firstStaffPosition + 2),
        ],
        preferredNeumeInsertionIndex,
      };
    case 'torculus':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 2),
          staffPosition(firstStaffPosition + 1),
        ],
        preferredNeumeInsertionIndex,
      };
    case 'climacus':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition - 1),
          staffPosition(firstStaffPosition - 2),
        ],
        preferredNeumeInsertionIndex,
      };
    case 'porrectus':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition - 2),
          staffPosition(firstStaffPosition - 1),
        ],
        preferredNeumeInsertionIndex,
      };
  }
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
    point.x > staffEndX ||
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

  return createGraphicalNeumePlacement(
    kind,
    firstStaffPosition,
    system.startNeumeIndex + neumeInsertionIndex,
  );
}

function layoutCommittedNeume(
  neume: Neume,
  geometry: NeumeGeometry,
): NeumeLayout {
  return {
    ...geometry,
    neumeId: neume.id,
    lyricSyllableId: neume.lyricSyllableId,
    kind: neume.kind,
    notes: geometry.notes.map((note, index) => ({
      ...note,
      noteId: neume.notes[index].id,
    })),
  };
}

function layoutSystems<T extends NeumeGeometry & { lyricSyllableId: string }>(
  document: Pick<ChantDocument, 'clef' | 'syllables'>,
  wrappedSystems: readonly PositionedSystem[],
  decorate: (geometry: NeumeGeometry, index: number) => T,
) {
  const systemsWithoutLyrics = wrappedSystems.map(
    ({ startNeumeIndex, geometries }, index) => {
      const y = firstSystemTopY + index * systemVerticalAdvance;
      const bottomStaffY = firstSystemBottomStaffY + y;

      return {
        index,
        x: 0,
        y,
        width: systemWidth,
        height: systemHeight,
        staffLines: ([1, 2, 3, 4] as const).map((line) => ({
          x1: staffStartX,
          x2: staffEndX,
          y: staffLineY(line, bottomStaffY),
        })),
        clef: {
          type: document.clef.type,
          staffLine: document.clef.staffLine,
          x: clefX,
          y: staffLineY(document.clef.staffLine, bottomStaffY),
          fontSize: 38,
        },
        neumes: geometries.map((geometry, offset) =>
          decorate(geometry, startNeumeIndex + offset),
        ),
        lyrics: [],
        startNeumeIndex,
      };
    },
  );
  const firstNeumeBySyllableId = new Map<
    string,
    { neume: T; systemIndex: number }
  >();

  // A syllable is laid out once, on the system containing its first neume.
  for (const system of systemsWithoutLyrics) {
    for (const neume of system.neumes) {
      if (!firstNeumeBySyllableId.has(neume.lyricSyllableId)) {
        firstNeumeBySyllableId.set(neume.lyricSyllableId, {
          neume,
          systemIndex: system.index,
        });
      }
    }
  }

  const lyricsBySystem = systemsWithoutLyrics.map(() => [] as LyricLayout[]);

  for (const syllable of document.syllables) {
    const first = firstNeumeBySyllableId.get(syllable.id);

    if (!first) {
      continue;
    }

    const alignmentX = getNeumeLyricAlignmentX(first.neume);

    if (alignmentX === null) {
      continue;
    }

    lyricsBySystem[first.systemIndex]?.push({
      syllableId: syllable.id,
      text: syllable.text,
      x: alignmentX,
      y: firstSystemLyricBaselineY + first.systemIndex * systemVerticalAdvance,
      fontSize: 20,
    });
  }

  const systems = systemsWithoutLyrics.map((system) => ({
    ...system,
    lyrics: lyricsBySystem[system.index] ?? [],
  }));

  return systems;
}

export function layoutChant(document: ChantDocument): ChantLayout {
  const systems = layoutSystems(
    document,
    placeNeumeSequence(document.neumes.map(geometryInput)),
    (geometry, index) => layoutCommittedNeume(document.neumes[index], geometry),
  );
  return {
    title: document.title,
    width: scoreWidth,
    height:
      firstSystemBottomY +
      (systems.length - 1) * systemVerticalAdvance +
      svgBottomPadding,
    systems,
  };
}
