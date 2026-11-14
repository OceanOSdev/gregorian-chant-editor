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
import { findSyllableForNeume } from '../domain/lyrics';
import {
  alignLyricText,
  lyricFontSize,
  lyricTextExtents,
  type MeasureLyricText,
} from './lyric-text-metrics';
import {
  buildNeumeGeometry,
  firstHeadHalfWidth,
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
  height: number;
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
export const systemHeight = 220;
export const systemGap = 24;
export const systemVerticalAdvance = systemHeight + systemGap;
export const svgTopPadding = 0;
export const svgBottomPadding = 0;
export const firstSystemTopY = svgTopPadding;
export const firstSystemBottomY = firstSystemTopY + systemHeight;
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
export const firstSystemLyricBaselineY = 180;

function staffLineY(line: StaffLine, bottomStaffY: number) {
  return bottomStaffY - (line - 1) * staffLineSpacing;
}

interface GeometryInput {
  /** Derived from ADR 0008 anchors only when the font snapshot is ready. */
  syllableId?: string;
  accidentals?: readonly AccidentalSpec[];
  modifiers?: readonly NoteAppearance[];
  kind: Neume['kind'];
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
    kind: neume.kind,
    modifiers: neume.notes,
    staffPositions: neume.notes.map((note) => note.staffPosition),
  };
}

interface LyricRequirement {
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

/** The same measured low-sign exclusions drive reservation and final placement. */
function lyricBandAccidentals(
  groups: readonly Pick<NeumeGeometry, 'accidentals'>[],
  baseline: number,
): LayoutBounds[] {
  return groups.flatMap((g) =>
    (g.accidentals ?? [])
      .map((a) => a.ink.bounds)
      .filter(
        (b) =>
          b.y < baseline + lyricFontSize / 4 + 3 &&
          b.y + b.height > baseline - lyricFontSize - 3,
      ),
  );
}

/** Prefer the rightmost clear interval. Reservation guarantees a fitting gap. */
function continuationHyphenLeft(
  start: number,
  end: number,
  obstacles: readonly LayoutBounds[],
  width: number,
): number {
  for (const b of obstacles
    .filter((b) => b.x < end && b.x + b.width > start)
    .sort((a, b) => b.x - a.x)) {
    const right = Math.max(start, b.x + b.width);
    if (end - right >= width + 2 * hyphenClearance)
      return right + (end - right - width) / 2;
    end = Math.min(end, b.x);
  }
  return start + (end - start - width) / 2;
}

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
  const bottomY = () =>
    firstSystemBottomStaffY + systems.length * systemVerticalAdvance;
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
                bottomY(),
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
          bottomY(),
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
            bottomY(),
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
          staffLineY(clef.clef.staffLine, bottomY()),
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
          bottomY(),
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
    const accidentalLyricBox = extents
      ? {
          ...extents,
          top:
            firstSystemLyricBaselineY - firstSystemBottomStaffY - lyricFontSize,
          bottom:
            firstSystemLyricBaselineY -
            firstSystemBottomStaffY +
            lyricFontSize / 4,
        }
      : undefined;
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
        !followingEvents.get(inputIndex - 1)?.length &&
        !previous.accidentals?.length &&
        !input.accidentals?.length;
      const minimumGap = compactSyllables
        ? compactNeumeInkGap
        : compactMelisma
          ? intraSyllableInkGap
          : interNeumeInkGap;
      let initial = buildNeumeGeometry(
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
        firstSystemBottomStaffY + systems.length * systemVerticalAdvance,
        input.modifiers,
        input.accidentals,
        accidentalLyricBox,
      );
      if (previousLyricRight !== null && initial.accidentals?.length) {
        const textRight = previousLyricRight;
        const textTop =
          firstSystemLyricBaselineY +
          systems.length * systemVerticalAdvance -
          lyricFontSize;
        const textBottom = textTop + lyricFontSize * 1.25;
        const previousExtents = activeLyric
          ? lyricTextExtents(activeLyric.alignment)
          : null;
        const previousLeft = previousExtents
          ? textRight - (previousExtents.right - previousExtents.left)
          : -Infinity;
        const shift = Math.max(
          0,
          ...initial.accidentals.map((a) => {
            const b = a.ink.bounds;
            return b.y < textBottom + 3 &&
              b.y + b.height > textTop - 3 &&
              b.x < textRight + 4 &&
              b.x + b.width > previousLeft - 3
              ? textRight + 4 - b.x
              : 0;
          }),
        );
        if (shift)
          initial = buildNeumeGeometry(
            input.kind,
            input.staffPositions,
            initial.bounds.x + shift,
            firstSystemBottomStaffY + systems.length * systemVerticalAdvance,
            input.modifiers,
            input.accidentals,
            accidentalLyricBox,
          );
      }
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
      const baseline =
        firstSystemLyricBaselineY + systems.length * systemVerticalAdvance;
      const previousSigns = lyricBandAccidentals(geometries, baseline);
      const currentSigns = lyricBandAccidentals([initial], baseline);
      // Genuine music, lyric and sign clearance decides whether a continuation
      // must separate; hyphen space is reserved only after that decision.
      const clearance = Math.max(
        lyricMinimum,
        ...previousSigns.map((b) => b.x + b.width + 4),
        lastBoundaryEventRight === null
          ? -Infinity
          : lastBoundaryEventRight + divisionGap,
      );
      // Decide from the safe placement once; adding mark clearance never
      // changes the decision back to joined (no iterative threshold loop).
      const separated =
        lyric.boundaryBefore === 'continuation' &&
        previousLyricRight !== null &&
        Math.max(left, clearance) - previousLyricRight > lyricJoinThreshold;
      // A hyphen starts after the previous lyric, so only signs ending beyond
      // that edge can intersect its interval.
      const hyphenStart = previousLyricRight;
      const minimum =
        separated && hyphenStart !== null
          ? Math.max(
              clearance,
              ...previousSigns
                .filter((b) => b.x + b.width > hyphenStart)
                .map(
                  (b) => b.x + b.width + 4 + hyphenWidth + 2 * hyphenClearance,
                ),
            )
          : clearance;
      // Current signs translate with their lyric: reserve before their leading
      // ink, rather than attempting to enlarge the fixed sign-to-lyric gap.
      const shift = Math.max(
        0,
        (separated && previousLyricRight !== null
          ? Math.max(
              previousLyricRight,
              lastBoundaryEventRight ?? -Infinity,
              ...previousSigns.map((b) => b.x + b.width),
            ) +
            hyphenWidth +
            2 * hyphenClearance
          : minimum) -
          (separated
            ? Math.min(
                left,
                ...currentSigns.filter((b) => b.x < left).map((b) => b.x),
              )
            : left),
        minimum - left,
      );
      const shifted = () =>
        buildNeumeGeometry(
          input.kind,
          input.staffPositions,
          initial.bounds.x + shift,
          firstSystemBottomStaffY + systems.length * systemVerticalAdvance,
          input.modifiers,
          input.accidentals,
          accidentalLyricBox,
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
          firstSystemBottomStaffY + systems.length * systemVerticalAdvance,
          input.modifiers,
          input.accidentals,
          accidentalLyricBox,
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
    neume.kind,
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

function layoutCommittedNeume(
  neume: Neume,
  geometry: Omit<NeumeGeometry, 'accidentals'>,
): NeumeLayout {
  return {
    ...geometry,
    neumeId: neume.id,

    kind: neume.kind,
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
  const wrappedSystems = placeNeumeSequence(
    document.neumes.map((neume) => ({
      ...geometryInput(neume),
      syllableId: ready
        ? findSyllableForNeume(document, neume.id)?.id
        : undefined,
      accidentals: signsForNeume(neume.id).map((s) => ({
        kind: s.entity.kind,
        staffPosition: s.owner.degree - s.location.offset,
        noteIndex: s.entity.placement ? s.location.noteIndex : null,
      })),
    })),
    staffEndX,
    requirements,
    hyphenWidth,
    followingEvents,
    document.clef,
    noteClefs,
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
      y: firstSystemLyricBaselineY + first.systemIndex * systemVerticalAdvance,
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
            return continuationHyphenLeft(
              start,
              after.lyric.left,
              lyricBandAccidentals(before.system.neumes, before.lyric.y),
              hyphenWidth,
            );
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
  let canvasTop = 0;
  let canvasBottom =
    firstSystemBottomY +
    (systems.length - 1) * systemVerticalAdvance +
    svgBottomPadding;
  let canvasLeft = 0;
  let canvasRight = scoreWidth;
  for (const lyric of edges) {
    canvasLeft = Math.min(canvasLeft, (lyric.left ?? 12) - 12);
    canvasRight = Math.max(canvasRight, (lyric.right ?? 0) + 12);
  }
  for (const system of systems) {
    for (const marked of system.neumes.filter(
      (n) =>
        n.accidentals?.length ||
        n.notes.some(
          (note) =>
            note.mora || note.episema || note.verticalEpisema || note.form,
        ),
    )) {
      canvasTop = Math.min(canvasTop, marked.bounds.y - 12);
      canvasBottom = Math.max(
        canvasBottom,
        marked.bounds.y + marked.bounds.height + 12,
      );
    }
    for (const guide of system.custodes) {
      canvasTop = Math.min(canvasTop, guide.bounds.y - 12);
      canvasBottom = Math.max(
        canvasBottom,
        guide.bounds.y + guide.bounds.height + 12,
      );
    }
    for (const c of [...system.clefChanges, ...system.custodes])
      canvasRight = Math.max(canvasRight, c.bounds.x + c.bounds.width + 12);
    if (system.staffLines[0].x2 > staffEndX)
      canvasRight = Math.max(canvasRight, system.staffLines[0].x2 + 12);
    for (const hyphen of system.hyphens)
      canvasRight = Math.max(
        canvasRight,
        hyphen.x + (hyphenExtents?.right ?? 0) + 12,
      );
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
