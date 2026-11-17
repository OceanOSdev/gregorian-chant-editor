import {
  writtenAccidentals,
  type WrittenAccidental,
} from '../domain/accidentals';
import type { ChantLayout } from './chant-layout-types';
import type { ChantDocument, Clef, Neume } from '../domain/chant-document';
import { deriveScoreOrder, type ScoreItem } from '../domain/divisions';
import {
  composeSystemsHorizontally,
  geometryInput,
  type BoundaryEvent,
  type GeometryInput,
  type LyricRequirement,
  type PositionedSystem,
} from './horizontal-system-composition';
import { lyricLanguage } from '../domain/lyric-alignment';
import {
  alignLyricText,
  lyricTextExtents,
  type MeasureLyricText,
} from './lyric-text-metrics';
import {
  buildNeumeGeometry,
  firstHeadHalfWidth,
  geometryKindFor,
} from './neume-geometry';
import {
  firstNeumeCenterX,
  firstSystemBottomStaffY,
  staffEndX,
} from './staff-metrics';
import {
  addContinuationHyphens,
  attachLyrics,
  buildScoreSlots,
  buildSystemLayout,
  clipCompactNeumeHitAreas,
  firstSystemTopY,
  getNeumeLyricAlignmentX,
  measureCanvas,
  positionComposedSystem,
  positionedMusicInk,
} from './system-layout-assembly';
import {
  measureSystemVertical,
  stackSystems,
  systemGap,
  systemHeight,
} from './system-vertical-layout';

/*
 * Public layout entry point. `layoutChant` is the only score layout
 * pipeline; the phases it calls live in:
 *
 * - `horizontal-system-composition.ts`: wrapping, spacing, lyric clearance,
 *   hyphen/custos reservations and clef/division events (one pass);
 * - `system-vertical-layout.ts`: vertical measurement and system stacking;
 * - `system-layout-assembly.ts`: rebuild at resolved origins, semantic IDs,
 *   lyrics, hyphens, hit clips, insertion slots and canvas bounds.
 *
 * Callers import types, constants and helpers from this module only.
 */

export {
  staffStartX,
  staffEndX,
  firstNeumeCenterX,
  firstSystemBottomStaffY,
  staffStep,
  staffPositionY,
  clefX,
  staffLineSpacing,
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
export type {
  AccidentalLayout,
  AccidentalNoteContext,
  ChantLayout,
  ChantSystemLayout,
  ClefChangeLayout,
  ClefLayout,
  HyphenLayout,
  LyricLayout,
  NeumeLayout,
  NoteLayout,
  ScoreSlotLayout,
  StaffLineLayout,
} from './chant-layout-types';
export {
  compactNeumeInkGap,
  intraSyllableInkGap,
  lyricJoinClearance,
  lyricJoinThreshold,
} from './horizontal-system-composition';
export {
  firstSystemTopY,
  getNeumeLyricAlignmentX,
  scoreWidth,
  svgBottomPadding,
  svgTopPadding,
  systemWidth,
} from './system-layout-assembly';

/**
 * Ordinary (unexpanded) system advance. Systems are stacked from measured
 * heights (Stage 11B), so this equals the actual advance only when every
 * earlier system kept the minimum height.
 */
export const systemVerticalAdvance = systemHeight + systemGap;

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
  return composeSystemsHorizontally({
    neumes: neumes.map(geometryInput),
    usableRightBoundary,
    noteClefs: neumes.map(() => ({ type: 'c', staffLine: 3 })),
  }).map((system) => ({
    startNeumeIndex: system.startNeumeIndex,
    neumes: neumes.slice(
      system.startNeumeIndex,
      system.startNeumeIndex + system.geometries.length,
    ),
  }));
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
  const positioned = composeSystemsHorizontally({
    neumes: neumes.map(geometryInput),
    usableRightBoundary: Number.POSITIVE_INFINITY,
  })[0];
  if (!positioned) return null;
  const following = positioned.geometries[insertionIndex];
  if (following) return following.notes[0]?.anchorX ?? null;
  const final = positioned.geometries.at(-1);
  return final
    ? final.bounds.x + final.advanceX + firstHeadHalfWidth('punctum')
    : firstNeumeCenterX;
}

/**
 * Lyric measurements for the whole document. Clearance and hyphen decisions
 * use them only when every syllable and the hyphen are measured: a partial
 * or stale font snapshot cannot establish safe adjacent clearances.
 */
function prepareLyricMetrics(
  document: ChantDocument,
  measure: MeasureLyricText | undefined,
) {
  const alignments = new Map(
    document.syllables.map((syllable) => [
      syllable.id,
      alignLyricText(syllable, lyricLanguage(document.lyricLanguage), measure),
    ]),
  );
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
  return { alignments, hyphenExtents, hyphenWidth, ready, requirements };
}

/**
 * Splits semantic score order into the walker's view: clef changes and
 * divisions following each neume index (-1 before the first neume) and the
 * effective clef of every neume.
 */
function prepareBoundaryEvents(
  document: ChantDocument,
  scoreOrder: readonly ScoreItem[],
) {
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
  return { followingEvents, noteClefs };
}

function groupAccidentalsByNeume(document: ChantDocument) {
  const accidentalsByNeume = new Map<string, WrittenAccidental[]>();
  for (const sign of writtenAccidentals(document) ?? []) {
    const id = sign.location.neume.id;
    const group = accidentalsByNeume.get(id) ?? [];
    group.push(sign);
    accidentalsByNeume.set(id, group);
  }
  return accidentalsByNeume;
}

/**
 * Builder inputs for every neume. Requirements contain only measured
 * anchors; the last anchor carries forward once in semantic order
 * (ADR 0008), leaving the lyricless prefix undefined.
 */
function prepareGeometryInputs(
  document: ChantDocument,
  requirements: ReadonlyMap<number, LyricRequirement>,
  accidentalsByNeume: ReadonlyMap<string, readonly WrittenAccidental[]>,
): GeometryInput[] {
  let activeSyllableId: string | undefined;
  return document.neumes.map((neume, index) => {
    const anchor = requirements.get(index);
    if (anchor) activeSyllableId = anchor.syllableId;
    return {
      ...geometryInput(neume),
      syllableId: activeSyllableId,
      accidentals: (accidentalsByNeume.get(neume.id) ?? []).map((s) => ({
        kind: s.entity.kind,
        staffPosition: s.owner.degree - s.location.offset,
        noteIndex: s.entity.placement ? s.location.noteIndex : null,
      })),
    };
  });
}

/** Whether any syllable is anchored to a neume on the system (Stage 11B). */
function systemHasLyricRow(
  system: PositionedSystem,
  document: ChantDocument,
  anchoredNeumeIds: ReadonlySet<string>,
) {
  return system.geometries.some(
    (geometry, offset) =>
      anchoredNeumeIds.has(
        document.neumes[system.startNeumeIndex + offset].id,
      ) && getNeumeLyricAlignmentX(geometry) !== null,
  );
}

/**
 * Derives score-absolute layout (ADR 0028): prepare semantic input, compose
 * horizontally once in the canonical local frame, measure and stack
 * systems, rebuild each system at its resolved origin, then attach lyrics,
 * hyphens, hit clips, insertion slots and canvas bounds.
 */
export function layoutChant(
  document: ChantDocument,
  measure?: MeasureLyricText,
): ChantLayout {
  // 1. Prepare semantic input.
  const lyricMetrics = prepareLyricMetrics(document, measure);
  const scoreOrder = deriveScoreOrder(document);
  if (!scoreOrder) throw new Error('Invalid division collection');
  const { followingEvents, noteClefs } = prepareBoundaryEvents(
    document,
    scoreOrder,
  );
  const accidentalsByNeume = groupAccidentalsByNeume(document);
  const inputs = prepareGeometryInputs(
    document,
    lyricMetrics.requirements,
    accidentalsByNeume,
  );

  // 2. Compose horizontally once; every later phase keeps these decisions.
  const composed = composeSystemsHorizontally({
    neumes: inputs,
    usableRightBoundary: staffEndX,
    lyrics: lyricMetrics.requirements,
    hyphenWidth: lyricMetrics.hyphenWidth,
    followingEvents,
    initialClef: document.clef,
    noteClefs,
  });

  // 3. Measure each composed system's vertical requirements and stack.
  const anchoredNeumeIds = new Set(
    document.syllables.map((syllable) => syllable.startsAtNeumeId),
  );
  const frames = stackSystems(
    composed.map((system) =>
      measureSystemVertical(
        positionedMusicInk(system, firstSystemBottomStaffY),
        systemHasLyricRow(system, document, anchoredNeumeIds),
      ),
    ),
    firstSystemTopY,
  );

  // 4. Rebuild each system at its resolved origin and attach semantic IDs.
  const systemLayouts = composed.map((system, index) =>
    buildSystemLayout(
      positionComposedSystem(
        system,
        frames[index].bottomStaffY,
        inputs.slice(
          system.startNeumeIndex,
          system.startNeumeIndex + system.geometries.length,
        ),
      ),
      frames[index],
      index,
      document.neumes,
      accidentalsByNeume,
    ),
  );

  // 5. Lyrics, hyphens and hit clips from the positioned geometry.
  const systems = attachLyrics(
    systemLayouts,
    document,
    lyricMetrics.alignments,
  );
  if (lyricMetrics.ready && lyricMetrics.hyphenExtents) {
    addContinuationHyphens(
      systems,
      lyricMetrics.hyphenExtents,
      lyricMetrics.hyphenWidth,
    );
    clipCompactNeumeHitAreas(systems);
  }

  // 6. Insertion slots and canvas.
  for (const system of systems)
    system.slots = buildScoreSlots(system, scoreOrder, document.neumes);
  return {
    title: document.title,
    ...measureCanvas(systems, lyricMetrics.ready, lyricMetrics.hyphenExtents),
    systems,
  };
}
