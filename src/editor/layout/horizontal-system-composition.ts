import type { AccidentalSpec } from './accidental-geometry';
import type { ClefChangeLayout } from './chant-layout-types';
import { buildClefGeometry } from './clef-geometry';
import { clefOffset } from '../domain/clef';
import {
  buildCustosGeometry,
  custosGap,
  measureCustosWidth,
  type CustosGeometry,
} from './custos-geometry';
import type { ScoreItem } from '../domain/divisions';
import type {
  Clef,
  LyricSyllable,
  Neume,
  NoteAppearance,
  StaffPosition,
} from '../domain/chant-document';
import {
  buildDivisionGeometry,
  divisionGap,
  measureDivisionWidth,
  type DivisionLayout,
} from './division-geometry';
import {
  alignLyricText,
  lyricFontSize,
  lyricTextExtents,
} from './lyric-text-metrics';
import {
  buildNeumeGeometry,
  firstHeadHalfWidth,
  geometryKindFor,
  interNeumeInkGap,
  type GeometryKind,
  type NeumeGeometry,
} from './neume-geometry';
import {
  clefX,
  firstNeumeCenterX,
  firstSystemBottomStaffY,
  staffEndX,
  staffLineSpacing,
  staffLineY,
  staffStartX,
} from './staff-metrics';

/*
 * Horizontal system composition (ADR 0010, 0011, 0013, 0026, 0028).
 *
 * One greedy, stateful walker decides every horizontal fact of the score:
 * which system each neume and boundary event belongs to, every x position,
 * ink spacing, word/syllable compaction, lyric clearance, hyphen and custos
 * reservations, clef/division events and oversized progress. It runs once,
 * in the canonical system-local frame (bottom staff at
 * `firstSystemBottomStaffY`), and later phases only translate its result.
 */

/** Ordinary ink gap between neumes of the same word joined by a continuation. */
export const compactNeumeInkGap = 2;
/** Ink gap between consecutive neumes of one syllable (Stage 9C). */
export const intraSyllableInkGap = 6;
// A join must remain substantially tighter than the quarter-em word gap.
// Occupied edges include guarded glyph ink, so this permits near-contiguous
// text without leaving an unmarked word-space-sized continuation.
export const lyricJoinThreshold = lyricFontSize / 10;
export const lyricJoinClearance = lyricFontSize / 20;
/** Clearance on each side of a continuation hyphen. */
export const hyphenClearance = lyricFontSize / 10;

// Reserve clearance from the wider clef (F adds an attachment to the shared
// body) when an outgoing lyric/bar reservation uses the leftward musical room.
const clefRight = Math.max(
  ...(['c', 'f'] as const).map((type) => {
    const bounds = buildClefGeometry({ type, staffLine: 3 }, clefX, 0).bounds;
    return bounds.x + bounds.width;
  }),
);
const minimumNeumeLeft = clefRight + interNeumeInkGap;

/** Everything a neume builder needs; rebuilt unchanged at resolved origins. */
export interface GeometryInput {
  /** Derived from ADR 0008 anchors only when the font snapshot is ready. */
  syllableId?: string;
  accidentals?: readonly AccidentalSpec[];
  modifiers?: readonly NoteAppearance[];
  /** Semantic kind, or the derived liquescent figure (ADR 0027). */
  kind: GeometryKind;
  staffPositions: readonly StaffPosition[];
}

/** A clef change or division in semantic score order. */
export type BoundaryEvent = Exclude<ScoreItem, { type: 'neume' }>;

/** A fully measured lyric anchored at a neume (absent when not measured). */
export interface LyricRequirement {
  syllableId: string;
  alignment: ReturnType<typeof alignLyricText>;
  boundaryBefore: LyricSyllable['boundaryBefore'];
  /** The following syllable continues this word. */
  continues: boolean;
}

/**
 * One composed system in the canonical local frame: system membership and
 * order plus geometry whose x positions are final.
 */
export interface PositionedSystem {
  leadingClef: Clef;
  leadingClefChangeId: string | null;
  clefChanges: readonly ClefChangeLayout[];
  custodes: readonly CustosGeometry[];
  startNeumeIndex: number;
  geometries: readonly NeumeGeometry[];
  divisions: readonly DivisionLayout[];
}

export interface HorizontalCompositionInput {
  /** One entry per semantic neume, in document order. */
  neumes: readonly GeometryInput[];
  /** Wrapping limit for ordinary systems. */
  usableRightBoundary?: number;
  /** Measured lyric requirements keyed by anchor neume index. */
  lyrics?: ReadonlyMap<number, LyricRequirement>;
  /** Measured hyphen advance; 0 when the font snapshot is not ready. */
  hyphenWidth?: number;
  /**
   * Clef changes and divisions after each neume index, in score order;
   * key -1 holds the events before the first neume.
   */
  followingEvents?: ReadonlyMap<number, readonly BoundaryEvent[]>;
  initialClef?: Clef;
  /** Effective clef of each neume; drives custodes at clef changes. */
  noteClefs?: readonly Clef[];
}

export function geometryInput(neume: Neume): GeometryInput {
  return {
    kind: geometryKindFor(neume),
    modifiers: neume.notes,
    staffPositions: neume.notes.map((note) => note.staffPosition),
  };
}

/**
 * Composes the whole score into systems with one greedy left-to-right pass.
 *
 * Walker state, reset by `finishSystem` for each new system:
 * - `geometries`, `divisions`, `clefChanges`, `custodes`: the open system's
 *   placed items;
 * - `leadingClef` / `leadingClefChangeId`: the clef drawn at the system start;
 * - `nextLeftX`: ordinary left edge for the next neume;
 * - `lastBoundaryEventRight`: right ink edge of the latest clef/division,
 *   which compact spacing may not cross;
 * - `previousLyricRight` / `activeLyric`: the latest lyric's occupied right
 *   edge and requirement, for word clearance and hyphen reservations.
 * `effectiveClef` and `startNeumeIndex` persist across systems.
 *
 * For each neume the walker places a candidate, wraps when its reserved
 * right edge (music, lyric, following divisions, custos and hyphen) passes
 * the boundary, then appends the following clef/division events.
 */
export function composeSystemsHorizontally({
  neumes: inputs,
  usableRightBoundary = staffEndX,
  lyrics = new Map(),
  hyphenWidth = 0,
  followingEvents = new Map(),
  initialClef = { type: 'c', staffLine: 3 },
  noteClefs = [],
}: HorizontalCompositionInput): readonly PositionedSystem[] {
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
  /** Room for an outgoing custos if the system broke before `index`. */
  const outgoingWidth = (index: number) =>
    noteClefs[index] ? custosGap + measureCustosWidth(guidePosition(index)) : 0;
  let divisions: DivisionLayout[] = [];
  let lastBoundaryEventRight: number | null = null;
  let startNeumeIndex = 0;
  let nextLeftX = 0;
  let previousLyricRight: number | null = null;
  let activeLyric: LyricRequirement | undefined;

  /**
   * Closes the open system. An outgoing custos replaces any anticipated
   * mid-system custos for the next neume, shifting later events left.
   */
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
  /**
   * Places clef changes and divisions starting at `left`, wrapping before an
   * event that does not fit. A clef at the start of a later system becomes
   * that system's leading clef; a mid-system clef that changes the next
   * neume's pitch context is preceded by an anticipated custos.
   */
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

    // Candidate placement on the open system: musical minimum gap (ordinary,
    // same-word compact or intra-syllable), then the lyric's word/join
    // clearance and, for a separated continuation, room for its hyphen.
    const placeCandidate = () => {
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

    // Right-edge reservations that decide wrapping.
    const rightEdge = (geometry: NeumeGeometry) =>
      Math.max(
        geometry.bounds.x + geometry.bounds.width,
        extents ? geometry.lyricAnchorX + extents.right : -Infinity,
      );
    const eventsAfter = followingEvents.get(inputIndex) ?? [];
    const firstClefAfter = eventsAfter.findIndex(
      (item) => item.type === 'clef',
    );
    // Divisions before any following clef stay with this neume's phrase.
    const divisionsBeforeClef = eventsAfter.slice(
      0,
      firstClefAfter < 0 ? eventsAfter.length : firstClefAfter,
    );
    const divisionsBeforeClefWidth = divisionsBeforeClef.reduce(
      (width, division) => width + divisionGap + eventWidth(division),
      0,
    );
    const phraseRight = (geometry: NeumeGeometry) =>
      Math.max(rightEdge(geometry), previousLyricRight ?? -Infinity);
    const groupRight = (geometry: NeumeGeometry) =>
      Math.max(
        rightEdge(geometry),
        phraseRight(geometry) +
          Math.min(
            divisionsBeforeClefWidth,
            Math.max(
              0,
              usableRightBoundary -
                firstNeumeCenterX -
                geometry.bounds.width -
                divisionGap,
            ),
          ),
      );
    // Reserve a possible outgoing mark while its source lyric is on this
    // system. On acceptance of the next syllable this reservation is released.
    const reservedRight = (geometry: NeumeGeometry) =>
      Math.max(
        groupRight(geometry) + outgoingWidth(inputIndex + 1),
        (lyric ?? activeLyric)?.continues && hyphenWidth
          ? Math.max(groupRight(geometry), previousLyricRight ?? -Infinity) +
              outgoingWidth(inputIndex + 1) +
              hyphenWidth +
              2 * hyphenClearance
          : -Infinity,
      );
    const oversized = (geometry: NeumeGeometry) =>
      reservedRight(geometry) > usableRightBoundary ||
      (extents ? geometry.lyricAnchorX + extents.left < staffStartX : false);

    // Whole-neume wrapping: a non-empty system that cannot take the
    // candidate closes, and the neume is placed again on the new system.
    let geometry = placeCandidate();
    if (hasItems() && reservedRight(geometry) > usableRightBoundary) {
      finishSystem();
      geometry = placeCandidate();
    }
    // First item of a system with a reservation: borrow leftward room
    // (keeping clear of the clef and the staff start) when that suffices.
    if (
      !hasItems() &&
      (lyric?.continues || eventsAfter.length > 0) &&
      extents
    ) {
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

    // Accept the neume, then its following events; an oversized unit
    // occupies its system alone so later material makes progress.
    geometries.push(geometry);
    nextLeftX = geometry.bounds.x + geometry.advanceX;
    if (extents) previousLyricRight = geometry.lyricAnchorX + extents.right;
    if (lyric) activeLyric = lyric;
    const isolatedOversize = oversized(geometry);
    appendEvents(
      eventsAfter,
      phraseRight(geometry) + divisionGap,
      inputIndex + 1,
    );
    if (isolatedOversize && hasItems()) finishSystem();
  }
  if (hasItems() || systems.length === 0) finishSystem();
  return systems;
}
