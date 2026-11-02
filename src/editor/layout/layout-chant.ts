import { lyricLanguage } from '../domain/lyric-alignment';
import {
  alignLyricText,
  lyricFontSize,
  lyricTextExtents,
  type MeasureLyricText,
} from './lyric-text-metrics';
import {
  staffPosition,
  type ChantDocument,
  type LyricSyllable,
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
  /** Horizontal ownership interval for contextual pointer padding. */
  hitClip?: { left: number; right: number };

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
  boundaryBefore: LyricSyllable['boundaryBefore'];
  /** Occupied advance/ink edges; null when measurements are unavailable. */
  left: number | null;
  right: number | null;
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
  hyphens?: readonly { x: number; y: number; outgoing: boolean }[];
  lyrics: readonly LyricLayout[];
  startNeumeIndex: number;
}

/** Derived, score-absolute geometry with height determined by system count. */
export interface ChantLayout {
  title: string;
  /** Derived canvas origin; logical system coordinates remain unchanged. */
  x: number;
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

interface LyricRequirement {
  alignment: ReturnType<typeof alignLyricText>;
  boundaryBefore: LyricSyllable['boundaryBefore'];
  continues: boolean;
}

export const compactNeumeInkGap = 2;
// A join must remain substantially tighter than the quarter-em word gap.
// Occupied edges include guarded glyph ink, so this permits near-contiguous
// text without leaving an unmarked word-space-sized continuation.
export const lyricJoinThreshold = lyricFontSize / 10;
export const lyricJoinClearance = lyricFontSize / 20;
const hyphenClearance = lyricFontSize / 10;

/** One walker owns music minima, lyric clearance, wrapping and oversized progress. */
function placeNeumeSequence(
  inputs: readonly GeometryInput[],
  usableRightBoundary = staffEndX,
  lyrics: ReadonlyMap<number, LyricRequirement> = new Map(),
  hyphenWidth = 0,
): readonly PositionedSystem[] {
  const systems: PositionedSystem[] = [];
  let geometries: NeumeGeometry[] = [];
  let startNeumeIndex = 0;
  let nextLeftX = 0;
  let previousLyricRight: number | null = null;
  let activeLyric: LyricRequirement | undefined;
  function finishSystem() {
    systems.push({ startNeumeIndex, geometries });
    startNeumeIndex += geometries.length;
    geometries = [];
    previousLyricRight = null;
    activeLyric = undefined;
  }
  for (const [inputIndex, input] of inputs.entries()) {
    const lyric = lyrics.get(inputIndex);
    const extents = lyric ? lyricTextExtents(lyric.alignment) : null;
    const build = () => {
      const previous = geometries.at(-1);
      const compact =
        previous &&
        lyric?.boundaryBefore === 'continuation' &&
        lyrics.has(inputIndex - 1);
      const initial = buildNeumeGeometry(
        input.kind,
        input.staffPositions,
        geometries.length
          ? compact
            ? previous.bounds.x + previous.bounds.width + compactNeumeInkGap
            : nextLeftX
          : firstNeumeCenterX - firstHeadHalfWidth(input.kind),
        firstSystemBottomStaffY + systems.length * systemVerticalAdvance,
      );
      if (!extents || !lyric) return initial;
      const left = initial.lyricAnchorX + extents.left;
      // Word clearance is a deterministic quarter-em minimum (5 score units).
      const minimum =
        previousLyricRight === null
          ? staffStartX
          : previousLyricRight +
            (lyric.boundaryBefore === 'word'
              ? lyricFontSize / 4
              : lyricJoinClearance);
      // Decide from the safe placement once; adding mark clearance never
      // changes the decision back to joined (no iterative threshold loop).
      const separated =
        lyric.boundaryBefore === 'continuation' &&
        previousLyricRight !== null &&
        left - previousLyricRight > lyricJoinThreshold;
      const shift = Math.max(
        0,
        (separated && previousLyricRight !== null
          ? previousLyricRight + hyphenWidth + 2 * hyphenClearance
          : minimum) - left,
      );
      const shifted = () =>
        buildNeumeGeometry(
          input.kind,
          input.staffPositions,
          initial.bounds.x + shift,
          firstSystemBottomStaffY + systems.length * systemVerticalAdvance,
        );
      // If an empty system cannot contain this anchored unit, retain its normal
      // musical anchor. Canvas expansion exposes both overhangs without scaling.
      if (
        !geometries.length &&
        Math.max(
          initial.bounds.x + initial.bounds.width + shift,
          initial.lyricAnchorX + extents.right + shift,
        ) > usableRightBoundary
      )
        return initial;
      return shift ? shifted() : initial;
    };
    const rightEdge = (g: NeumeGeometry) =>
      Math.max(
        g.bounds.x + g.bounds.width,
        extents ? g.lyricAnchorX + extents.right : -Infinity,
      );
    // Reserve a possible outgoing mark while its source lyric is on this
    // system. On acceptance of the next syllable this reservation is released.
    const reservedRight = (g: NeumeGeometry) =>
      Math.max(
        rightEdge(g),
        (lyric ?? activeLyric)?.continues && hyphenWidth
          ? Math.max(rightEdge(g), previousLyricRight ?? -Infinity) +
              hyphenWidth +
              2 * hyphenClearance
          : -Infinity,
      );
    const oversized = (g: NeumeGeometry) =>
      rightEdge(g) > usableRightBoundary ||
      (extents ? g.lyricAnchorX + extents.left < staffStartX : false);
    let geometry = build();
    if (geometries.length && reservedRight(geometry) > usableRightBoundary) {
      finishSystem();
      geometry = build();
    }
    geometries.push(geometry);
    nextLeftX = geometry.bounds.x + geometry.advanceX;
    if (extents) previousLyricRight = geometry.lyricAnchorX + extents.right;
    if (lyric) activeLyric = lyric;
    if (oversized(geometry)) finishSystem();
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

/** Music-only wrapping utility; lyric scores use layoutChant with measurements. */
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

/** Music-only unwrapped helper; runtime pointer boundaries use displayed ink bounds. */
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
): ChantLayout {
  const alignments = new Map(
    document.syllables.map((syllable) => [
      syllable.id,
      alignLyricText(syllable, lyricLanguage(document.lyricLanguage), measure),
    ]),
  );
  // A partial/stale font snapshot cannot establish safe adjacent clearances.
  const hyphenAlignment = alignLyricText(
    {
      id: 'decoration',
      text: '-',
      startsAtNeumeId: '',
      boundaryBefore: 'word',
    },
    'und',
    measure,
  );
  const hyphenExtents = lyricTextExtents(hyphenAlignment);
  const hyphenWidth = hyphenExtents
    ? hyphenExtents.right - hyphenExtents.left
    : 0;
  const ready =
    [...alignments.values()].every((a) => a.measured) &&
    hyphenAlignment.measured;
  const requirements = new Map<number, LyricRequirement>();
  const indexes = new Map(document.neumes.map((n, i) => [n.id, i]));
  if (ready)
    for (const [syllableIndex, syllable] of document.syllables.entries()) {
      const index = indexes.get(syllable.startsAtNeumeId);
      const alignment = alignments.get(syllable.id);
      if (index !== undefined && alignment)
        requirements.set(index, {
          alignment,
          boundaryBefore: syllable.boundaryBefore,
          continues:
            document.syllables[syllableIndex + 1]?.boundaryBefore ===
            'continuation',
        });
    }
  const wrappedSystems = placeNeumeSequence(
    document.neumes.map(geometryInput),
    staffEndX,
    requirements,
    hyphenWidth,
  );
  const systemsWithoutLyrics = wrappedSystems.map(
    ({ startNeumeIndex, geometries }, index): ChantSystemLayout => {
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
          layoutCommittedNeume(
            document.neumes[startNeumeIndex + offset],
            geometry,
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

    const alignment =
      alignments.get(syllable.id) ??
      alignLyricText(syllable, lyricLanguage(document.lyricLanguage));
    const x = alignmentX + alignment.offset;
    const extents = lyricTextExtents(alignment);
    lyricsBySystem[first.systemIndex]?.push({
      alignment,
      anchorX: alignmentX,
      syllableId: syllable.id,
      text: syllable.text,
      x,
      boundaryBefore: syllable.boundaryBefore,
      left: extents ? alignmentX + extents.left : null,
      right: extents ? alignmentX + extents.right : null,
      y: firstSystemLyricBaselineY + first.systemIndex * systemVerticalAdvance,
      fontSize: lyricFontSize,
    });
  }

  const systems = systemsWithoutLyrics.map((system) => ({
    ...system,
    lyrics: lyricsBySystem[system.index] ?? [],
    hyphens: [] as { x: number; y: number; outgoing: boolean }[],
  }));
  if (ready && hyphenExtents) {
    const orderedLyrics = systems.flatMap((system) =>
      system.lyrics.map((lyric) => ({ lyric, system })),
    );
    for (let i = 1; i < orderedLyrics.length; i++) {
      const before = orderedLyrics[i - 1];
      const after = orderedLyrics[i];
      if (
        after.lyric.boundaryBefore !== 'continuation' ||
        before.lyric.right === null ||
        after.lyric.left === null
      )
        continue;
      const outgoing = before.system.index !== after.system.index;
      const gap = after.lyric.left - before.lyric.right;
      if (!outgoing && gap <= lyricJoinThreshold) continue;
      const left = outgoing
        ? Math.max(
            before.lyric.right,
            ...before.system.neumes.map((n) => n.bounds.x + n.bounds.width),
          ) + hyphenClearance
        : before.lyric.right + (gap - hyphenWidth) / 2;
      before.system.hyphens.push({
        x: left - hyphenExtents.left,
        y: before.lyric.y,
        outgoing,
      });
    }
    // Clip only external pointer padding. Ink, anchors and internal note
    // ownership remain untouched; midpoint intervals are disjoint.
    for (const system of systems) {
      for (let i = 1; i < system.neumes.length; i++) {
        const a = system.neumes[i - 1],
          b = system.neumes[i];
        const right = a.bounds.x + a.bounds.width;
        if (b.bounds.x - right >= interNeumeInkGap) continue;
        const split = (right + b.bounds.x) / 2;
        a.hitClip = { left: a.hitClip?.left ?? a.bounds.x - 7, right: split };
        b.hitClip = { left: split, right: b.bounds.x + b.bounds.width + 7 };
      }
    }
  }

  // Normal systems still wrap at staffEndX, irrespective of this canvas.
  const edges = ready ? systems.flatMap((system) => system.lyrics) : [];
  let canvasLeft = 0;
  let canvasRight = scoreWidth;
  for (const lyric of edges) {
    canvasLeft = Math.min(canvasLeft, (lyric.left ?? 12) - 12);
    canvasRight = Math.max(canvasRight, (lyric.right ?? 0) + 12);
  }
  for (const system of systems)
    for (const hyphen of system.hyphens)
      canvasRight = Math.max(
        canvasRight,
        hyphen.x + (hyphenExtents?.right ?? 0) + 12,
      );
  return {
    title: document.title,
    x: canvasLeft,
    width: canvasRight - canvasLeft,
    height:
      firstSystemBottomY +
      (systems.length - 1) * systemVerticalAdvance +
      svgBottomPadding,
    systems,
  };
}
