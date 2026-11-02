import { lyricLanguage } from '../domain/lyric-alignment';
import {
  alignLyricText,
  lyricFontSize,
  type MeasureLyricText,
} from './lyric-text-metrics';
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
  interNeumeInkGap,
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

  kind: Neume['kind'];
  notes: readonly NoteLayout[];
}

export interface LyricLayout {
  alignment: ReturnType<typeof alignLyricText>;
  anchorX: number;
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
  hyphens?: readonly { x: number; y: number }[];
  lyricBaselineY?: number;
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

/** Insertion intent on committed systems, not hypothetical engraved placement. */
export type GraphicalPlacementPreviewLayout = NeumeGeometry & {
  kind: GraphicalNeumeKind;
  pointerSystemIndex: number;
  caret: { systemIndex: number; x: number; top: number; bottom: number };
};

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
  lyric?: { offset: number; width: number; word: boolean };
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
  let previousLyricRight: number | null = null;
  function finishSystem() {
    systems.push({ startNeumeIndex, geometries });
    startNeumeIndex += geometries.length;
    geometries = [];
    previousLyricRight = null;
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
    const place = () => {
      let geometry = build();
      if (input.lyric) {
        const left =
          geometry.lyricAnchorX + input.lyric.offset - input.lyric.width / 2;
        const minimum =
          previousLyricRight === null
            ? staffStartX + 4
            : previousLyricRight + (input.lyric.word ? 14 : 2);
        if (left < minimum)
          geometry = buildNeumeGeometry(
            input.kind,
            input.staffPositions,
            geometry.bounds.x + minimum - left,
            firstSystemBottomStaffY + systems.length * systemVerticalAdvance,
          );
      }
      return geometry;
    };
    const right = (geometry: NeumeGeometry) =>
      Math.max(
        geometry.bounds.x + geometry.bounds.width,
        input.lyric
          ? geometry.lyricAnchorX +
              input.lyric.offset +
              input.lyric.width / 2 +
              14
          : 0,
      );
    let geometry = place();
    if (geometries.length && right(geometry) > usableRightBoundary) {
      finishSystem();
      geometry = place();
    }
    geometries.push(geometry);
    nextLeftX = geometry.bounds.x + geometry.advanceX;
    if (input.lyric)
      previousLyricRight =
        geometry.lyricAnchorX + input.lyric.offset + input.lyric.width / 2;
    if (right(geometry) > usableRightBoundary) finishSystem();
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

    kind: neume.kind,
    notes: geometry.notes.map((note, index) => ({
      ...note,
      noteId: neume.notes[index].id,
    })),
  };
}

export function layoutChant(
  document: ChantDocument,
  measure?: MeasureLyricText,
  options: { lyricSpacing?: boolean } = {},
): ChantLayout {
  const lyricByAnchor = new Map(
    document.syllables.map((s) => [s.startsAtNeumeId, s]),
  );
  const wrappedSystems = placeNeumeSequence(
    document.neumes.map((neume) => {
      const input: GeometryInput = geometryInput(neume);
      const syllable = lyricByAnchor.get(neume.id);
      if (options.lyricSpacing && syllable) {
        const aligned = alignLyricText(
          syllable,
          lyricLanguage(document.lyricLanguage),
          measure,
        );
        // Before fonts are ready, conservative grapheme metrics keep a usable layout.
        input.lyric = {
          offset: aligned.offset,
          width:
            aligned.width ??
            Array.from(syllable.text).length * lyricFontSize * 0.65,
          word: syllable.boundaryBefore === 'word',
        };
      }
      return input;
    }),
  );
  let nextSystemY = firstSystemTopY;
  const lyricBaselines: number[] = [];
  const systemsWithoutLyrics = wrappedSystems.map(
    ({ startNeumeIndex, geometries }, index): ChantSystemLayout => {
      const originalY = index * systemVerticalAdvance;
      const inkTop = Math.min(
        12,
        ...geometries.map((g) => g.bounds.y - originalY),
      );
      const extraTop = options.lyricSpacing ? Math.max(0, 12 - inkTop) : 0;
      const inkBottom =
        Math.max(
          firstSystemBottomStaffY,
          ...geometries.map((g) => g.bounds.y + g.bounds.height - originalY),
        ) + extraTop;
      const baseline = options.lyricSpacing
        ? Math.max(firstSystemLyricBaselineY + extraTop, inkBottom + 36)
        : firstSystemLyricBaselineY;
      const height = options.lyricSpacing
        ? Math.max(systemHeight + extraTop, baseline + 40)
        : systemHeight;
      const y = nextSystemY;
      nextSystemY += height + systemGap;
      const bottomStaffY = firstSystemBottomStaffY + y + extraTop;
      lyricBaselines.push(y + baseline);

      return {
        index,
        x: 0,
        y,
        width: systemWidth,
        height,
        lyricBaselineY: y + baseline,
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
          layoutCommittedNeume(
            document.neumes[startNeumeIndex + offset],
            options.lyricSpacing
              ? buildNeumeGeometry(
                  document.neumes[startNeumeIndex + offset].kind,
                  document.neumes[startNeumeIndex + offset].notes.map(
                    (n) => n.staffPosition,
                  ),
                  geometry.bounds.x,
                  bottomStaffY,
                )
              : geometry,
          ),
        ),
        lyrics: [],
        startNeumeIndex,
      };
    },
  );
  const neumesById = new Map(
    systemsWithoutLyrics.flatMap((system) =>
      system.neumes.map(
        (neume) =>
          [neume.neumeId, { neume, systemIndex: system.index }] as const,
      ),
    ),
  );

  const lyricsBySystem = systemsWithoutLyrics.map(() => [] as LyricLayout[]);

  for (const syllable of document.syllables) {
    const first = neumesById.get(syllable.startsAtNeumeId);

    if (!first) {
      continue;
    }

    const alignmentX = getNeumeLyricAlignmentX(first.neume);

    if (alignmentX === null) {
      continue;
    }

    const alignment = alignLyricText(
      syllable,
      lyricLanguage(document.lyricLanguage),
      measure,
    );
    lyricsBySystem[first.systemIndex]?.push({
      alignment,
      anchorX: alignmentX,
      syllableId: syllable.id,
      text: syllable.text,
      x: alignmentX + alignment.offset,
      y: lyricBaselines[first.systemIndex],
      fontSize: lyricFontSize,
    });
  }

  const hyphens = systemsWithoutLyrics.map(
    () => [] as { x: number; y: number }[],
  );
  let width = scoreWidth;
  if (options.lyricSpacing) {
    for (const system of systemsWithoutLyrics) {
      for (const neume of system.neumes)
        width = Math.max(width, neume.bounds.x + neume.bounds.width + 64);
      for (const lyric of lyricsBySystem[system.index]) {
        const textWidth =
          lyric.alignment.width ??
          Array.from(lyric.text).length * lyricFontSize * 0.65;
        width = Math.max(width, lyric.x + textWidth / 2 + 64);
      }
    }
    for (let i = 1; i < document.syllables.length; i++) {
      const before = document.syllables[i - 1];
      const after = document.syllables[i];
      if (after.boundaryBefore !== 'continuation') continue;
      const a = neumesById.get(before.startsAtNeumeId);
      const b = neumesById.get(after.startsAtNeumeId);
      if (!a || !b) continue;
      const left = lyricsBySystem[a.systemIndex].find(
        (l) => l.syllableId === before.id,
      );
      const right = lyricsBySystem[b.systemIndex].find(
        (l) => l.syllableId === after.id,
      );
      if (!left || !right) continue;
      const textWidth = (lyric: LyricLayout) =>
        lyric.alignment.width ??
        Array.from(lyric.text).length * lyricFontSize * 0.65;
      const edge = left.x + textWidth(left) / 2;
      if (a.systemIndex === b.systemIndex) {
        const nextEdge = right.x - textWidth(right) / 2;
        if (nextEdge - edge >= 12)
          hyphens[a.systemIndex].push({ x: (edge + nextEdge) / 2, y: left.y });
      } else {
        for (let system = a.systemIndex; system < b.systemIndex; system++) {
          const x = Math.max(
            staffEndX - 8,
            system === a.systemIndex ? edge + 9 : 0,
          );
          width = Math.max(width, x + 64);
          hyphens[system].push({ x, y: lyricBaselines[system] });
        }
      }
    }
  }
  const systems = systemsWithoutLyrics.map((system) => ({
    ...system,
    lyrics: lyricsBySystem[system.index] ?? [],
    ...(options.lyricSpacing ? { hyphens: hyphens[system.index] } : {}),
  }));

  return {
    title: document.title,
    width,
    height: nextSystemY - systemGap + svgBottomPadding,
    systems,
  };
}
