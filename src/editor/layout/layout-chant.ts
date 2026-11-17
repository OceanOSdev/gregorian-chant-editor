import {
  writtenAccidentals,
  type PitchContext,
  type WrittenAccidental,
} from '../domain/accidentals';
import type { AccidentalGeometry, AccidentalSpec } from './accidental-geometry';
import type { NoteAppearance } from '../domain/chant-document';
import { buildClefGeometry, type ClefGeometry } from './clef-geometry';
import {
  staffStartX,
  staffEndX,
  firstNeumeCenterX,
  firstSystemBottomStaffY,
} from './staff-metrics';
import { clefOffset } from '../domain/clef';
import {
  buildCustosGeometry,
  measureCustosWidth,
  custosGap,
  type CustosGeometry,
} from './custos-geometry';
import {
  deriveScoreOrder,
  scoreBoundaryAt,
  type ScoreItem,
} from '../domain/divisions';
import type {
  Clef,
  ChantDocument,
  LyricSyllable,
  Neume,
  ScoreInsertionBoundary,
  StaffLine,
  StaffPosition,
} from '../domain/chant-document';
import {
  buildDivisionGeometry,
  divisionGap,
  measureDivisionWidth,
  type DivisionLayout,
} from './division-geometry';
import { lyricLanguage } from '../domain/lyric-alignment';
import { liquescentFigure, type LiquescentFigure } from '../domain/liquescence';
import {
  alignLyricText,
  lyricFontSize,
  lyricTextExtents,
  type MeasureLyricText,
} from './lyric-text-metrics';
import {
  measureSystemVertical,
  offStaffCanvasMargin,
  stackSystems,
  systemGap,
  systemHeight,
  type VerticalBand,
} from './system-vertical-layout';
import {
  buildNeumeGeometry,
  firstHeadHalfWidth,
  geometryKindFor,
  type GeometryKind,
  engravingStaffStep,
  interNeumeInkGap,
  type NeumeGeometry,
  type NoteGeometry,
  type LayoutBounds,
} from './neume-geometry';
export {
  staffStartX,
  staffEndX,
  firstNeumeCenterX,
  firstSystemBottomStaffY,
  staffStep,
  staffPositionY,
} from './staff-metrics';
export {
  canGraphicalNeumeFitNormalSystem,
  getSystemNeumePlacement,
  layoutGraphicalPlacementPreview,
} from './graphical-placement';
export type {
  GraphicalNeumePlacement,
  GraphicalPlacementPreviewInput,
  GraphicalPlacementPreviewLayout,
} from './graphical-placement';
export type {
  GraphicalNeumeKind,
  GraphicalStaffPositions,
} from '../neume-entry-pitches';
export type { LayoutBounds } from './neume-geometry';

export interface StaffLineLayout {
  x1: number;
  x2: number;
  y: number;
}

export type ClefLayout = ClefGeometry;
export interface ClefChangeLayout extends ClefGeometry {
  clefChangeId: string;
}

export interface NoteLayout extends NoteGeometry, NoteAppearance {
  noteId: string;
}

export interface AccidentalNoteContext {
  noteId: string;
  noteIndex: number;
  neumeId: string;
  neumeIndex: number;
  neumeKind: Neume['kind'];
}
export interface AccidentalLayout extends AccidentalGeometry {
  accidentalId: string;
  owner: AccidentalNoteContext;
  placement: AccidentalNoteContext | null;
}
export interface NeumeLayout extends Omit<
  NeumeGeometry,
  'notes' | 'accidentals'
> {
  accidentals?: readonly AccidentalLayout[];
  neumeId: string;
  /** Horizontal ownership interval for contextual pointer padding and decorations. */
  hitClip?: { left: number; right: number };

  kind: Neume['kind'];
  /** Derived liquescent figure for labels/data hooks (ADR 0027); never stored. */
  liquescentFigure?: LiquescentFigure;
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

export interface HyphenLayout {
  x: number;
  y: number;
  outgoing: boolean;
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
  /** Measured height (Stage 11B); at least `systemHeight`. */
  height: number;
  /** Authoritative bottom staff line: the pitch origin for this system. */
  bottomStaffY: number;
  /** Shared baseline of every lyric and hyphen on this system. */
  lyricBaselineY: number;
  /**
   * Resolved musical band (`SystemFrame.musicBand`): the canonical maximum
   * band intersected with this system's box. Musical ink, ledger runs,
   * pointer regions and in-system overlays are clipped to it.
   */
  musicBand: VerticalBand;
  staffLines: readonly StaffLineLayout[];
  clef: ClefLayout;
  leadingClefChangeId: string | null;
  clefChanges: readonly ClefChangeLayout[];
  custodes: readonly CustosGeometry[];
  neumes: readonly NeumeLayout[];
  hyphens: readonly HyphenLayout[];
  lyrics: readonly LyricLayout[];
  startNeumeIndex: number;
  divisions: readonly DivisionLayout[];
  slots: readonly ScoreSlotLayout[];
}

export interface ScoreSlotLayout {
  /** Inclusive pointer split at the following item midpoint, independent of caret. */
  hitRight: number;
  boundary: ScoreInsertionBoundary;
  insertionIndex: number;
  x: number;
}

/** Derived, score-absolute geometry; canvas includes exceptional guide ink. */
export interface ChantLayout {
  title: string;
  /** Derived canvas origin; logical system coordinates remain unchanged. */
  x: number;
  y: number;
  width: number;
  height: number;
  systems: readonly ChantSystemLayout[];
}

export const scoreWidth = 720;
export const systemWidth = scoreWidth;
/**
 * Ordinary (unexpanded) system advance. Systems are stacked from measured
 * heights (Stage 11B), so this equals the actual advance only when every
 * earlier system kept the minimum height.
 */
export const systemVerticalAdvance = systemHeight + systemGap;
export const svgTopPadding = 0;
export const svgBottomPadding = 0;
export const firstSystemTopY = svgTopPadding;
export const clefX = 100;
// Reserve clearance from the wider clef (F adds an attachment to the shared
// body) when an outgoing lyric/bar reservation uses the leftward musical room.
const clefRight = Math.max(
  ...(['c', 'f'] as const).map((type) => {
    const bounds = buildClefGeometry({ type, staffLine: 3 }, clefX, 0).bounds;
    return bounds.x + bounds.width;
  }),
);
const minimumNeumeLeft = clefRight + interNeumeInkGap;
export const staffLineSpacing = engravingStaffStep * 2;

function staffLineY(line: StaffLine, bottomStaffY: number) {
  return bottomStaffY - (line - 1) * staffLineSpacing;
}

interface GeometryInput {
  /** Derived from ADR 0008 anchors only when the font snapshot is ready. */
  syllableId?: string;
  accidentals?: readonly AccidentalSpec[];
  modifiers?: readonly NoteAppearance[];
  /** Semantic kind, or the derived liquescent figure (ADR 0027). */
  kind: GeometryKind;
  staffPositions: readonly StaffPosition[];
}

type BoundaryEvent = Exclude<ScoreItem, { type: 'neume' }>;

interface PositionedSystem {
  leadingClef: Clef;
  leadingClefChangeId: string | null;
  clefChanges: readonly ClefChangeLayout[];
  custodes: readonly CustosGeometry[];
  startNeumeIndex: number;
  geometries: readonly NeumeGeometry[];
  divisions: readonly DivisionLayout[];
}

function geometryInput(neume: Neume): GeometryInput {
  return {
    kind: geometryKindFor(neume),
    modifiers: neume.notes,
    staffPositions: neume.notes.map((note) => note.staffPosition),
  };
}

interface LyricRequirement {
  syllableId: string;
  alignment: ReturnType<typeof alignLyricText>;
  boundaryBefore: LyricSyllable['boundaryBefore'];
  continues: boolean;
}

export const compactNeumeInkGap = 2;
export const intraSyllableInkGap = 6;
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
  followingEvents: ReadonlyMap<number, readonly BoundaryEvent[]> = new Map(),
  initialClef: Clef = { type: 'c', staffLine: 3 },
  noteClefs: readonly Clef[] = [],
): readonly PositionedSystem[] {
  const systems: PositionedSystem[] = [];
  let geometries: NeumeGeometry[] = [];
  let effectiveClef = initialClef;
  let leadingClef = initialClef;
  let leadingClefChangeId: string | null = null;
  let clefChanges: ClefChangeLayout[] = [];
  let custodes: CustosGeometry[] = [];
  const hasItems = () =>
    geometries.length || divisions.length || clefChanges.length;
  // Every system composes in the canonical local frame (ADR 0028) at
  // firstSystemBottomStaffY; layoutChant measures, stacks and then translates
  // each system by rebuilding it.
  const guidePosition = (index: number) =>
    inputs[index].staffPositions[0] +
    clefOffset(noteClefs[index]) -
    clefOffset(effectiveClef);
  const outgoingWidth = (index: number) =>
    noteClefs[index] ? custosGap + measureCustosWidth(guidePosition(index)) : 0;
  let divisions: DivisionLayout[] = [];
  let lastBoundaryEventRight: number | null = null;
  let startNeumeIndex = 0;
  let nextLeftX = 0;
  let previousLyricRight: number | null = null;
  let activeLyric: LyricRequirement | undefined;
  function finishSystem() {
    const nextIndex = startNeumeIndex + geometries.length;
    if (hasItems() && noteClefs[nextIndex]) {
      const removedGuides = custodes.filter(
        (g) => g.nextNeumeIndex === nextIndex,
      );
      for (const guide of removedGuides) {
        const shift = guide.bounds.width + custosGap;
        clefChanges = clefChanges.map((c) =>
          c.bounds.x > guide.bounds.x
            ? {
                ...buildClefGeometry(c, c.x - shift, c.y),
                clefChangeId: c.clefChangeId,
              }
            : c,
        );
        divisions = divisions.map((d) =>
          d.bounds.x > guide.bounds.x
            ? buildDivisionGeometry(
                { id: d.divisionId, kind: d.kind, beforeNeumeId: null },
                d.bounds.x - shift,
                firstSystemBottomStaffY,
                staffLineSpacing,
              )
            : d,
        );
        nextLeftX -= shift;
      }
      custodes = custodes.filter((g) => g.nextNeumeIndex !== nextIndex);
      const right = Math.max(
        nextLeftX - interNeumeInkGap,
        previousLyricRight ?? 0,
        ...clefChanges.map((c) => c.bounds.x + c.bounds.width),
        ...divisions.map((d) => d.bounds.x + d.bounds.width),
      );
      custodes.push(
        buildCustosGeometry(
          guidePosition(nextIndex),
          right + custosGap,
          firstSystemBottomStaffY,
          nextIndex,
          true,
        ),
      );
    }
    systems.push({
      startNeumeIndex,
      geometries,
      divisions,
      leadingClef,
      leadingClefChangeId,
      clefChanges,
      custodes,
    });
    startNeumeIndex += geometries.length;
    geometries = [];
    leadingClef = effectiveClef;
    leadingClefChangeId = null;
    clefChanges = [];
    custodes = [];
    divisions = [];
    lastBoundaryEventRight = null;
    nextLeftX = 0;
    previousLyricRight = null;
    activeLyric = undefined;
  }
  function eventWidth(item: BoundaryEvent) {
    if (item.type === 'division') return measureDivisionWidth(item.entity.kind);
    return buildClefGeometry(item.entity.clef, 0, 0).bounds.width;
  }
  function appendEvents(
    items: readonly BoundaryEvent[],
    left: number,
    nextIndex: number,
  ) {
    let anticipated = false;
    for (const item of items) {
      const clef = item.type === 'clef' ? item.entity : null;
      const needsGuide = () =>
        clef &&
        !anticipated &&
        !!noteClefs[nextIndex] &&
        clefOffset(effectiveClef) !== clefOffset(noteClefs[nextIndex]);
      let guideWidth = needsGuide()
        ? custosGap + measureCustosWidth(guidePosition(nextIndex))
        : 0;
      const width = eventWidth(item);
      const oversizedLyric =
        (previousLyricRight ?? -Infinity) > usableRightBoundary;
      if (
        !oversizedLyric &&
        hasItems() &&
        left + width + guideWidth + outgoingWidth(nextIndex) >
          usableRightBoundary
      ) {
        finishSystem();
        anticipated = true;
        left = firstNeumeCenterX;
        guideWidth = 0;
      }
      const leading = !!clef && systems.length > 0 && !hasItems();
      if (leading) {
        leadingClef = clef.clef;
        leadingClefChangeId = clef.id;
        guideWidth = 0;
      }
      if (guideWidth) {
        custodes.push(
          buildCustosGeometry(
            guidePosition(nextIndex),
            left,
            firstSystemBottomStaffY,
            nextIndex,
            false,
          ),
        );
        left += guideWidth;
      }
      if (clef) {
        const origin = buildClefGeometry(clef.clef, 0, 0).bounds.x;
        const x = leading ? clefX : left - origin;
        const geometry = buildClefGeometry(
          clef.clef,
          x,
          staffLineY(clef.clef.staffLine, firstSystemBottomStaffY),
        );
        clefChanges.push({ ...geometry, clefChangeId: clef.id });
        effectiveClef = clef.clef;
        anticipated = true;
        lastBoundaryEventRight = geometry.bounds.x + geometry.bounds.width;
        left = leading
          ? firstNeumeCenterX
          : lastBoundaryEventRight + divisionGap;
      } else if (item.type === 'division') {
        const geometry = buildDivisionGeometry(
          item.entity,
          left,
          firstSystemBottomStaffY,
          staffLineSpacing,
        );
        divisions.push(geometry);
        lastBoundaryEventRight = geometry.bounds.x + geometry.bounds.width;
        left = lastBoundaryEventRight + divisionGap;
      }
      nextLeftX = leading
        ? firstNeumeCenterX - firstHeadHalfWidth('punctum')
        : left + interNeumeInkGap - divisionGap;
    }
  }
  appendEvents(followingEvents.get(-1) ?? [], firstNeumeCenterX, 0);
  for (const [inputIndex, input] of inputs.entries()) {
    const lyric = lyrics.get(inputIndex);
    const extents = lyric ? lyricTextExtents(lyric.alignment) : null;
    const build = () => {
      const previous = geometries.at(-1);
      const compactSyllables =
        previous &&
        !followingEvents
          .get(inputIndex - 1)
          ?.some((item) => item.type === 'division') &&
        lyric?.boundaryBefore === 'continuation' &&
        lyrics.has(inputIndex - 1);
      const compactMelisma =
        previous &&
        input.syllableId !== undefined &&
        input.syllableId === inputs[inputIndex - 1]?.syllableId &&
        !followingEvents.get(inputIndex - 1)?.length;
      const minimumGap = compactSyllables
        ? compactNeumeInkGap
        : compactMelisma
          ? intraSyllableInkGap
          : interNeumeInkGap;
      const initial = buildNeumeGeometry(
        input.kind,
        input.staffPositions,
        hasItems()
          ? previous && minimumGap < interNeumeInkGap
            ? Math.max(
                previous.bounds.x + previous.bounds.width + minimumGap,
                lastBoundaryEventRight === null
                  ? -Infinity
                  : lastBoundaryEventRight + interNeumeInkGap,
              )
            : nextLeftX
          : firstNeumeCenterX - firstHeadHalfWidth(input.kind),
        firstSystemBottomStaffY,
        input.modifiers,
        input.accidentals,
      );
      if (!extents || !lyric) return initial;
      const left = initial.lyricAnchorX + extents.left;
      // Word clearance is a deterministic quarter-em minimum (5 score units).
      const lyricMinimum =
        previousLyricRight === null
          ? staffStartX
          : previousLyricRight +
            (lyric.boundaryBefore === 'word'
              ? lyricFontSize / 4
              : lyricJoinClearance);
      // Genuine music and lyric clearance decides whether a continuation
      // must separate; hyphen space is reserved only after that decision.
      // Musical signs never enter the lyric row (ADR 0028): it clears them
      // vertically, so they impose no lyric or hyphen exclusion here.
      const minimum = Math.max(
        lyricMinimum,
        lastBoundaryEventRight === null
          ? -Infinity
          : lastBoundaryEventRight + divisionGap,
      );
      // Decide from the safe placement once; adding mark clearance never
      // changes the decision back to joined (no iterative threshold loop).
      const separated =
        lyric.boundaryBefore === 'continuation' &&
        previousLyricRight !== null &&
        Math.max(left, minimum) - previousLyricRight > lyricJoinThreshold;
      const shift = Math.max(
        0,
        (separated && previousLyricRight !== null
          ? Math.max(previousLyricRight, lastBoundaryEventRight ?? -Infinity) +
            hyphenWidth +
            2 * hyphenClearance
          : minimum) - left,
        minimum - left,
      );
      const shifted = () =>
        buildNeumeGeometry(
          input.kind,
          input.staffPositions,
          initial.bounds.x + shift,
          firstSystemBottomStaffY,
          input.modifiers,
          input.accidentals,
        );
      // If an empty system cannot contain this anchored unit, retain its normal
      // musical anchor. Canvas expansion exposes both overhangs without scaling.
      if (
        !hasItems() &&
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
    const bars = followingEvents.get(inputIndex) ?? [];
    const endingBars = bars.slice(
      0,
      bars.findIndex((item) => item.type === 'clef') < 0
        ? bars.length
        : bars.findIndex((item) => item.type === 'clef'),
    );
    const barWidth = endingBars.reduce(
      (width, bar) => width + divisionGap + eventWidth(bar),
      0,
    );
    const phraseRight = (g: NeumeGeometry) =>
      Math.max(rightEdge(g), previousLyricRight ?? -Infinity);
    const groupRight = (g: NeumeGeometry) =>
      Math.max(
        rightEdge(g),
        phraseRight(g) +
          Math.min(
            barWidth,
            Math.max(
              0,
              usableRightBoundary -
                firstNeumeCenterX -
                g.bounds.width -
                divisionGap,
            ),
          ),
      );
    // Reserve a possible outgoing mark while its source lyric is on this
    // system. On acceptance of the next syllable this reservation is released.
    const reservedRight = (g: NeumeGeometry) =>
      Math.max(
        groupRight(g) + outgoingWidth(inputIndex + 1),
        (lyric ?? activeLyric)?.continues && hyphenWidth
          ? Math.max(groupRight(g), previousLyricRight ?? -Infinity) +
              outgoingWidth(inputIndex + 1) +
              hyphenWidth +
              2 * hyphenClearance
          : -Infinity,
      );
    const oversized = (g: NeumeGeometry) =>
      reservedRight(g) > usableRightBoundary ||
      (extents ? g.lyricAnchorX + extents.left < staffStartX : false);
    let geometry = build();
    if (hasItems() && reservedRight(geometry) > usableRightBoundary) {
      finishSystem();
      geometry = build();
    }
    if (!hasItems() && (lyric?.continues || bars.length > 0) && extents) {
      const missing = Math.max(
        0,
        reservedRight(geometry) - usableRightBoundary,
      );
      const left = Math.min(
        geometry.bounds.x,
        geometry.lyricAnchorX + extents.left,
      );
      // Preserve internal music and vowel alignment. A combined unit which
      // cannot fit even using this room follows isolated oversized progress.
      if (
        missing &&
        left - missing >= staffStartX &&
        geometry.bounds.x - missing >= minimumNeumeLeft
      )
        geometry = buildNeumeGeometry(
          input.kind,
          input.staffPositions,
          geometry.bounds.x - missing,
          firstSystemBottomStaffY,
          input.modifiers,
          input.accidentals,
        );
    }
    geometries.push(geometry);
    nextLeftX = geometry.bounds.x + geometry.advanceX;
    if (extents) previousLyricRight = geometry.lyricAnchorX + extents.right;
    if (lyric) activeLyric = lyric;
    const isolatedOversize = oversized(geometry);
    appendEvents(bars, phraseRight(geometry) + divisionGap, inputIndex + 1);
    if (isolatedOversize && hasItems()) finishSystem();
  }
  if (hasItems() || systems.length === 0) finishSystem();
  return systems;
}

export function measureNeumeWidth(neume: Neume): number {
  return buildNeumeGeometry(
    geometryKindFor(neume),
    geometryInput(neume).staffPositions,
    0,
    firstSystemBottomStaffY,
    neume.notes,
  ).bounds.width;
}

/** Music-only wrapping utility; lyric scores use layoutChant with measurements. */
export function wrapNeumes(
  neumes: readonly Neume[],
  usableRightBoundary = staffEndX,
) {
  return placeNeumeSequence(
    neumes.map(geometryInput),
    usableRightBoundary,
    new Map(),
    0,
    new Map(),
    { type: 'c', staffLine: 3 },
    neumes.map(() => ({ type: 'c', staffLine: 3 })),
  ).map((system) => ({
    startNeumeIndex: system.startNeumeIndex,
    neumes: neumes.slice(
      system.startNeumeIndex,
      system.startNeumeIndex + system.geometries.length,
    ),
  }));
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

function liquescentLayout(neume: Neume): Pick<NeumeLayout, 'liquescentFigure'> {
  const figure = liquescentFigure(neume);
  return figure ? { liquescentFigure: figure } : {};
}

function layoutCommittedNeume(
  neume: Neume,
  geometry: Omit<NeumeGeometry, 'accidentals'>,
): NeumeLayout {
  return {
    ...geometry,
    neumeId: neume.id,

    kind: neume.kind,
    ...liquescentLayout(neume),
    notes: geometry.notes.map((note, index) => ({
      ...note,
      noteId: neume.notes[index].id,
      ...(neume.notes[index].form ? { form: neume.notes[index].form } : {}),
      ...(neume.notes[index].mora ? { mora: neume.notes[index].mora } : {}),
      ...(neume.notes[index].episema ? { episema: true as const } : {}),
      ...(neume.notes[index].verticalEpisema
        ? { verticalEpisema: true as const }
        : {}),
    })),
  };
}

/**
 * Complete renderable musical ink of a composed system: staff, leading clef,
 * clef changes, divisions, custodes and every neume's complete bounds (body,
 * ledger runs, rhythmic signs and accidentals). Pointer padding, outlines and
 * ghosts are not ink and never trigger vertical expansion.
 */
function positionedMusicInk(
  system: PositionedSystem,
  bottomStaffY: number,
): LayoutBounds[] {
  const staffTop = staffLineY(4, bottomStaffY);
  return [
    {
      x: staffStartX,
      y: staffTop,
      width: staffEndX - staffStartX,
      height: bottomStaffY - staffTop,
    },
    buildClefGeometry(
      system.leadingClef,
      clefX,
      staffLineY(system.leadingClef.staffLine, bottomStaffY),
    ).bounds,
    ...system.clefChanges.map((c) => c.bounds),
    ...system.divisions.map((d) => d.bounds),
    ...system.custodes.map((c) => c.bounds),
    ...system.geometries.map((g) => g.bounds),
  ];
}

/**
 * Translates one composed system to its resolved pitch origin by rebuilding
 * each element through its own builder at its composed left edge (the
 * documented rebuild-at-`bounds.x` contract). No horizontal decision is
 * revisited, so nothing here can change system membership.
 */
function positionComposedSystem(
  system: PositionedSystem,
  bottomStaffY: number,
  inputs: readonly GeometryInput[],
): PositionedSystem {
  if (bottomStaffY === firstSystemBottomStaffY) return system;
  // Every field is listed (no spread), so a new geometric field cannot
  // silently keep the canonical frame: it must be translated or declared
  // vertical-free here.
  return {
    // Semantic identity and order, free of vertical geometry.
    leadingClef: system.leadingClef,
    leadingClefChangeId: system.leadingClefChangeId,
    startNeumeIndex: system.startNeumeIndex,
    geometries: system.geometries.map((geometry, offset) => {
      const input = inputs[offset];
      if (!input) throw new Error('Composed neume without input');
      return buildNeumeGeometry(
        input.kind,
        input.staffPositions,
        geometry.bounds.x,
        bottomStaffY,
        input.modifiers,
        input.accidentals,
      );
    }),
    divisions: system.divisions.map((d) =>
      buildDivisionGeometry(
        { id: d.divisionId, kind: d.kind, beforeNeumeId: null },
        d.bounds.x,
        bottomStaffY,
        staffLineSpacing,
      ),
    ),
    clefChanges: system.clefChanges.map((c) => ({
      ...buildClefGeometry(
        { type: c.type, staffLine: c.staffLine },
        c.x,
        staffLineY(c.staffLine, bottomStaffY),
      ),
      clefChangeId: c.clefChangeId,
    })),
    custodes: system.custodes.map((c) =>
      buildCustosGeometry(
        c.staffPosition,
        c.bounds.x,
        bottomStaffY,
        c.nextNeumeIndex,
        c.outgoing,
      ),
    ),
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
          syllableId: syllable.id,
          alignment,
          boundaryBefore: syllable.boundaryBefore,
          continues:
            document.syllables[syllableIndex + 1]?.boundaryBefore ===
            'continuation',
        });
    }
  const scoreOrder = deriveScoreOrder(document);
  if (!scoreOrder) throw new Error('Invalid division collection');
  const followingEvents = new Map<number, BoundaryEvent[]>();
  let effectiveClef = document.clef;
  const noteClefs: Clef[] = [];
  let precedingIndex = -1;
  for (const item of scoreOrder) {
    if (item.type === 'clef') effectiveClef = item.entity.clef;
    if (item.type === 'neume') {
      precedingIndex++;
      noteClefs.push(effectiveClef);
    } else
      followingEvents.set(precedingIndex, [
        ...(followingEvents.get(precedingIndex) ?? []),
        item,
      ]);
  }
  const signs = writtenAccidentals(document) ?? [];
  const signsByNeume = new Map<string, WrittenAccidental[]>();
  for (const sign of signs) {
    const id = sign.location.neume.id;
    const group = signsByNeume.get(id) ?? [];
    group.push(sign);
    signsByNeume.set(id, group);
  }
  const signsForNeume = (id: string) => signsByNeume.get(id) ?? [];
  const signContext = (c: PitchContext): AccidentalNoteContext => ({
    noteId: c.note.id,
    noteIndex: c.noteIndex,
    neumeId: c.neume.id,
    neumeIndex: c.neumeIndex,
    neumeKind: c.neume.kind,
  });
  // Requirements contain only measured anchors. Carry the last anchor forward
  // once in semantic order (ADR 0008), leaving the lyricless prefix undefined.
  let activeSyllableId: string | undefined;
  const inputs = document.neumes.map((neume, index) => {
    const anchor = requirements.get(index);
    if (anchor) activeSyllableId = anchor.syllableId;
    return {
      ...geometryInput(neume),
      syllableId: activeSyllableId,
      accidentals: signsForNeume(neume.id).map((s) => ({
        kind: s.entity.kind,
        staffPosition: s.owner.degree - s.location.offset,
        noteIndex: s.entity.placement ? s.location.noteIndex : null,
      })),
    };
  });
  // Stage 11B (ADR 0028): compose once in the canonical local frame (every
  // system at firstSystemBottomStaffY), measure each system's vertical
  // requirements, stack, then translate each system by rebuilding it.
  const local = placeNeumeSequence(
    inputs,
    staffEndX,
    requirements,
    hyphenWidth,
    followingEvents,
    document.clef,
    noteClefs,
  );
  const anchoredNeumeIds = new Set(
    document.syllables.map((syllable) => syllable.startsAtNeumeId),
  );
  const frames = stackSystems(
    local.map((system) =>
      measureSystemVertical(
        positionedMusicInk(system, firstSystemBottomStaffY),
        system.geometries.some(
          (geometry, offset) =>
            anchoredNeumeIds.has(
              document.neumes[system.startNeumeIndex + offset].id,
            ) && getNeumeLyricAlignmentX(geometry) !== null,
        ),
      ),
    ),
    firstSystemTopY,
  );
  // Each composed system is rebuilt independently at its resolved origin and
  // the composed left edges; the walker never runs again, so membership,
  // order and every placement decision are fixed by construction.
  const wrappedSystems = local.map((system, index) =>
    positionComposedSystem(
      system,
      frames[index].bottomStaffY,
      inputs.slice(
        system.startNeumeIndex,
        system.startNeumeIndex + system.geometries.length,
      ),
    ),
  );
  const systemsWithoutLyrics = wrappedSystems.map(
    (
      {
        startNeumeIndex,
        geometries,
        divisions,
        leadingClef,
        leadingClefChangeId,
        clefChanges,
        custodes,
      },
      index,
    ): ChantSystemLayout => {
      const frame = frames[index];
      const { bottomStaffY } = frame;

      return {
        index,
        x: 0,
        y: frame.y,
        width: systemWidth,
        height: frame.height,
        bottomStaffY,
        lyricBaselineY: frame.lyricBaselineY,
        musicBand: frame.musicBand,
        staffLines: ([1, 2, 3, 4] as const).map((line) => ({
          x1: staffStartX,
          x2: Math.max(
            staffEndX,
            ...[...divisions, ...clefChanges, ...custodes].map((d) =>
              d.bounds.x + d.bounds.width > staffEndX
                ? d.bounds.x + d.bounds.width + divisionGap + 3
                : staffEndX,
            ),
          ),
          y: staffLineY(line, bottomStaffY),
        })),
        clef: buildClefGeometry(
          leadingClef,
          clefX,
          staffLineY(leadingClef.staffLine, bottomStaffY),
        ),
        neumes: geometries.map((geometry, offset) => {
          const neume = document.neumes[startNeumeIndex + offset];
          const groupSigns = signsForNeume(neume.id);
          const { accidentals: glyphs, ...body } = geometry;
          return {
            ...layoutCommittedNeume(neume, body),
            ...(glyphs?.length
              ? {
                  accidentals: glyphs.map((glyph, i) => ({
                    ...glyph,
                    accidentalId: groupSigns[i].entity.id,
                    owner: signContext(groupSigns[i].owner),
                    placement: groupSigns[i].entity.placement
                      ? signContext(groupSigns[i].location)
                      : null,
                  })),
                }
              : {}),
          };
        }),
        divisions,
        leadingClefChangeId,
        clefChanges,
        custodes,
        slots: [],
        lyrics: [],
        hyphens: [],
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
      y: frames[first.systemIndex].lyricBaselineY,
      fontSize: lyricFontSize,
    });
  }

  const systems = systemsWithoutLyrics.map((system) => ({
    ...system,
    lyrics: lyricsBySystem[system.index] ?? [],
    hyphens: [] as HyphenLayout[],
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
            ...before.system.divisions.map((d) => d.bounds.x + d.bounds.width),
            ...before.system.clefChanges.map(
              (c) => c.bounds.x + c.bounds.width,
            ),
            ...before.system.custodes.map((c) => c.bounds.x + c.bounds.width),
          ) + hyphenClearance
        : (() => {
            const start = Math.max(
              before.lyric.right,
              ...[
                ...before.system.divisions,
                ...before.system.clefChanges,
                ...before.system.custodes,
              ]
                .filter(
                  (d) =>
                    d.bounds.x >= before.lyric.anchorX &&
                    d.bounds.x < after.lyric.anchorX,
                )
                .map((d) => d.bounds.x + d.bounds.width),
            );
            // Centered in the horizontal gap; musical signs never occupy
            // the lyric row (ADR 0028), so they are not hyphen obstacles.
            return start + (after.lyric.left - start - hyphenWidth) / 2;
          })();
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

  // Slots use the same occupied geometry as drawing. Each side of every bar
  // is a distinct semantic boundary, even at leading/trailing and empty music.
  for (const system of systems) {
    const visible = scoreOrder.flatMap((item, index) => {
      const geometry =
        item.type === 'clef'
          ? system.clefChanges.find((c) => c.clefChangeId === item.entity.id)
          : item.type === 'division'
            ? system.divisions.find((d) => d.divisionId === item.entity.id)
            : system.neumes.find((n) => n.neumeId === item.entity.id);
      return geometry
        ? [{ index, bounds: geometry.bounds, type: item.type }]
        : [];
    });
    const slots: ScoreSlotLayout[] = [];
    for (let i = 0; i <= visible.length; i++) {
      const previous = visible[i - 1];
      const next = visible[i];
      const index = next?.index ?? (previous ? previous.index + 1 : 0);
      const boundary = scoreBoundaryAt(scoreOrder, index);
      const insertionIndex =
        boundary.beforeNeumeId === null
          ? document.neumes.length
          : document.neumes.findIndex((n) => n.id === boundary.beforeNeumeId);
      let x =
        next?.type === 'division' || next?.type === 'clef'
          ? next.bounds.x - divisionGap / 2
          : previous?.type === 'division' || previous?.type === 'clef'
            ? previous.bounds.x + previous.bounds.width + divisionGap / 2
            : next
              ? previous
                ? (previous.bounds.x + previous.bounds.width + next.bounds.x) /
                  2
                : next.bounds.x - interNeumeInkGap / 2
              : previous
                ? previous.bounds.x +
                  previous.bounds.width +
                  interNeumeInkGap / 2
                : firstNeumeCenterX;
      const minimumX = Math.max(
        staffStartX + 3,
        previous ? previous.bounds.x + previous.bounds.width + 3 : -Infinity,
      );
      const maximumX = Math.min(
        system.staffLines[0].x2 - 3,
        next ? next.bounds.x - 3 : Infinity,
      );
      for (const guide of system.custodes) {
        const left = guide.bounds.x - 6,
          right = guide.bounds.x + guide.bounds.width + 6;
        if (x > left && x < right) {
          const candidates = [left, right].filter(
            (value) => value >= minimumX && value <= maximumX,
          );
          if (candidates.length)
            x = candidates.reduce((best, value) =>
              Math.abs(value - x) < Math.abs(best - x) ? value : best,
            );
        }
      }
      slots.push({
        boundary,
        insertionIndex,
        hitRight: next
          ? next.bounds.x + next.bounds.width / 2
          : system.staffLines[0].x2,
        x: Math.max(staffStartX + 3, Math.min(system.staffLines[0].x2 - 3, x)),
      });
    }
    system.slots = slots;
  }

  // Normal systems still wrap at staffEndX, irrespective of this canvas.
  const edges = ready ? systems.flatMap((system) => system.lyrics) : [];
  // Vertically the canvas is the stacked systems: each system's measured
  // extent already reserves its (band-limited) musical ink and lyric row.
  const lastSystem = systems[systems.length - 1];
  const canvasTop = firstSystemTopY - svgTopPadding;
  const canvasBottom = lastSystem.y + lastSystem.height + svgBottomPadding;
  let canvasLeft = 0;
  let canvasRight = scoreWidth;
  for (const lyric of edges) {
    canvasLeft = Math.min(canvasLeft, (lyric.left ?? 12) - 12);
    canvasRight = Math.max(canvasRight, (lyric.right ?? 0) + 12);
  }
  // Rendering safeguard, not a pitch restriction (Stage 11A): musical ink
  // and continuation hyphens grow the canvas by at most offStaffCanvasMargin
  // beyond the text-derived extent (the score width, widened by any
  // oversized lyric, ADR 0010/0011) horizontally; vertically, measurement
  // clamps ink to the canonical band and each system's resolved musicBand
  // lies inside its own box (Stage 11B). That is far past any musical use (50
  // ledger levels) and keeps text overflow and the ink it displaces intact,
  // while a valid but absurd safe-integer pitch, the interval-proportional
  // ribbon of a Porrectus reaching one, or an outgoing hyphen displaced after
  // that ribbon cannot turn the viewBox into an unusable 10^17-unit canvas.
  // Ink beyond is clipped; derived positions are unchanged.
  const left = canvasLeft - offStaffCanvasMargin;
  const right = canvasRight + offStaffCanvasMargin;
  const containX = (inkLeft: number, inkRight: number) => {
    canvasLeft = Math.min(canvasLeft, Math.max(left, inkLeft));
    canvasRight = Math.max(canvasRight, Math.min(right, inkRight));
  };
  for (const system of systems) {
    for (const neume of system.neumes)
      containX(neume.bounds.x - 12, neume.bounds.x + neume.bounds.width + 12);
    for (const c of [...system.clefChanges, ...system.custodes])
      containX(c.bounds.x, c.bounds.x + c.bounds.width + 12);
    if (system.staffLines[0].x2 > staffEndX)
      containX(0, system.staffLines[0].x2 + 12);
    for (const hyphen of system.hyphens)
      containX(0, hyphen.x + (hyphenExtents?.right ?? 0) + 12);
  }
  return {
    title: document.title,
    x: canvasLeft,
    y: canvasTop,
    width: canvasRight - canvasLeft,
    height: canvasBottom - canvasTop,
    systems,
  };
}
