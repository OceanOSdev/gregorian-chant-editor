import type { PitchContext, WrittenAccidental } from '../domain/accidentals';
import type {
  AccidentalNoteContext,
  ChantLayout,
  ChantSystemLayout,
  HyphenLayout,
  LyricLayout,
  NeumeLayout,
  ScoreSlotLayout,
} from './chant-layout-types';
import type { ChantDocument, Neume } from '../domain/chant-document';
import { buildClefGeometry } from './clef-geometry';
import { buildCustosGeometry } from './custos-geometry';
import { scoreBoundaryAt, type ScoreItem } from '../domain/divisions';
import { buildDivisionGeometry, divisionGap } from './division-geometry';
import {
  hyphenClearance,
  lyricJoinThreshold,
  type GeometryInput,
  type PositionedSystem,
} from './horizontal-system-composition';
import { liquescentFigure } from '../domain/liquescence';
import { lyricLanguage } from '../domain/lyric-alignment';
import {
  alignLyricText,
  lyricFontSize,
  lyricTextExtents,
} from './lyric-text-metrics';
import {
  buildNeumeGeometry,
  interNeumeInkGap,
  type LayoutBounds,
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
import {
  offStaffCanvasMargin,
  type SystemFrame,
} from './system-vertical-layout';

/*
 * Consumer side of horizontal composition. Each phase consumes composed
 * geometry and never revisits a horizontal decision (ADR 0028):
 *
 * 1. `positionedMusicInk` — the ink `measureSystemVertical` measures, before
 *    stacking;
 * 2. `positionComposedSystem` — after stacking, translate a system to its
 *    resolved origin;
 * 3. `buildSystemLayout` — staff, clef and semantic IDs on the geometry;
 * 4. `attachLyrics`, `addContinuationHyphens`, `clipCompactNeumeHitAreas`;
 * 5. `buildScoreSlots` — semantic insertion boundaries per system;
 * 6. `measureCanvas` — score-absolute viewBox.
 *
 * Mutation: `attachLyrics` returns new systems (fresh lyric and hyphen
 * arrays); `addContinuationHyphens` pushes into those `hyphens` arrays and
 * `clipCompactNeumeHitAreas` sets `hitClip` on those neumes, in place. All
 * mutated objects are created by this layout call, never semantic input.
 */

export const scoreWidth = 720;
export const systemWidth = scoreWidth;
export const svgTopPadding = 0;
export const svgBottomPadding = 0;
export const firstSystemTopY = svgTopPadding;

type LyricExtents = NonNullable<ReturnType<typeof lyricTextExtents>>;

/** A system whose lyric and hyphen rows are still being attached. */
interface AssembledSystem extends Omit<
  ChantSystemLayout,
  'lyrics' | 'hyphens'
> {
  lyrics: LyricLayout[];
  hyphens: HyphenLayout[];
}

/**
 * Complete renderable musical ink of a composed system: staff, leading clef,
 * clef changes, divisions, custodes and every neume's complete bounds (body,
 * ledger runs, rhythmic signs and accidentals). Pointer padding, outlines and
 * ghosts are not ink and never trigger vertical expansion.
 */
export function positionedMusicInk(
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
 *
 * `inputs` are the system's own geometry inputs, in system order.
 */
export function positionComposedSystem(
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

function accidentalNoteContext(c: PitchContext): AccidentalNoteContext {
  return {
    noteId: c.note.id,
    noteIndex: c.noteIndex,
    neumeId: c.neume.id,
    neumeIndex: c.neumeIndex,
    neumeKind: c.neume.kind,
  };
}

/** Attaches semantic IDs, note appearances and accidental ownership. */
function layoutCommittedNeume(
  neume: Neume,
  geometry: NeumeGeometry,
  writtenAccidentals: readonly WrittenAccidental[],
): NeumeLayout {
  const { accidentals: glyphs, ...body } = geometry;
  const figure = liquescentFigure(neume);
  return {
    ...body,
    neumeId: neume.id,

    kind: neume.kind,
    ...(figure ? { liquescentFigure: figure } : {}),
    notes: body.notes.map((note, index) => ({
      ...note,
      noteId: neume.notes[index].id,
      ...(neume.notes[index].form ? { form: neume.notes[index].form } : {}),
      ...(neume.notes[index].mora ? { mora: neume.notes[index].mora } : {}),
      ...(neume.notes[index].episema ? { episema: true as const } : {}),
      ...(neume.notes[index].verticalEpisema
        ? { verticalEpisema: true as const }
        : {}),
    })),
    ...(glyphs?.length
      ? {
          accidentals: glyphs.map((glyph, i) => ({
            ...glyph,
            accidentalId: writtenAccidentals[i].entity.id,
            owner: accidentalNoteContext(writtenAccidentals[i].owner),
            placement: writtenAccidentals[i].entity.placement
              ? accidentalNoteContext(writtenAccidentals[i].location)
              : null,
          })),
        }
      : {}),
  };
}

/**
 * The system frame, staff, leading clef and semantically identified
 * geometry of one positioned system; lyrics, hyphens and slots come later.
 */
export function buildSystemLayout(
  {
    startNeumeIndex,
    geometries,
    divisions,
    leadingClef,
    leadingClefChangeId,
    clefChanges,
    custodes,
  }: PositionedSystem,
  frame: SystemFrame,
  index: number,
  neumes: readonly Neume[],
  accidentalsByNeume: ReadonlyMap<string, readonly WrittenAccidental[]>,
): ChantSystemLayout {
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
      // Extend the staff past trailing events that overflow staffEndX.
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
      const neume = neumes[startNeumeIndex + offset];
      return layoutCommittedNeume(
        neume,
        geometry,
        accidentalsByNeume.get(neume.id) ?? [],
      );
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
}

/**
 * Places each syllable under its anchor neume's vowel-alignment x on that
 * neume's system, at the system's shared lyric baseline. The vertical lyric
 * row was reserved by `systemHasLyricRow` (`layout-chant.ts`) with the same
 * rule (anchor neume on the system with a finite alignment x); change both
 * together. Returns new systems; the inputs are not modified.
 */
export function attachLyrics(
  systems: readonly ChantSystemLayout[],
  document: ChantDocument,
  alignments: ReadonlyMap<string, ReturnType<typeof alignLyricText>>,
): AssembledSystem[] {
  const neumesById = new Map(
    systems.flatMap((system) =>
      system.neumes.map(
        (neume) =>
          [neume.neumeId, { neume, systemIndex: system.index }] as const,
      ),
    ),
  );

  const lyricsBySystem = systems.map(() => [] as LyricLayout[]);

  for (const syllable of document.syllables) {
    const first = neumesById.get(syllable.startsAtNeumeId);
    if (!first) continue;
    const alignmentX = getNeumeLyricAlignmentX(first.neume);
    if (alignmentX === null) continue;

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
      y: systems[first.systemIndex].lyricBaselineY,
      fontSize: lyricFontSize,
    });
  }

  return systems.map((system) => ({
    ...system,
    lyrics: lyricsBySystem[system.index] ?? [],
    hyphens: [] as HyphenLayout[],
  }));
}

export function getNeumeLyricAlignmentX(
  neume: Pick<NeumeGeometry, 'lyricAnchorX'>,
): number | null {
  return Number.isFinite(neume.lyricAnchorX) ? neume.lyricAnchorX : null;
}

/**
 * Draws a hyphen for every continuation whose measured gap exceeds the join
 * threshold: centered in the gap on one system, or as an outgoing mark after
 * the source system's last ink when the word breaks across systems.
 *
 * `composeSystemsHorizontally` reserved room for exactly these hyphens
 * (`placeCandidate` for separated continuations, `reservedRight` for outgoing
 * marks) with the same `lyricJoinThreshold` and `hyphenClearance`; the rules
 * must agree or a hyphen is drawn without room. Pushes into each system's
 * `hyphens` array in place.
 */
export function addContinuationHyphens(
  systems: readonly AssembledSystem[],
  hyphenExtents: LyricExtents,
  hyphenWidth: number,
) {
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
          ...before.system.clefChanges.map((c) => c.bounds.x + c.bounds.width),
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
}

/**
 * Splits external pointer padding at the midpoint between compactly spaced
 * neumes. Ink, anchors and internal note ownership remain untouched;
 * midpoint intervals are disjoint. Sets `hitClip` on the neume layouts in
 * place.
 */
export function clipCompactNeumeHitAreas(systems: readonly AssembledSystem[]) {
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

/**
 * Score insertion slots of one system. Slots use the same occupied geometry
 * as drawing. Each side of every bar is a distinct semantic boundary, even at
 * leading/trailing and empty music; slots avoid custodes.
 */
export function buildScoreSlots(
  system: ChantSystemLayout,
  scoreOrder: readonly ScoreItem[],
  neumes: readonly Neume[],
): ScoreSlotLayout[] {
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
        ? neumes.length
        : neumes.findIndex((n) => n.id === boundary.beforeNeumeId);
    let x =
      next?.type === 'division' || next?.type === 'clef'
        ? next.bounds.x - divisionGap / 2
        : previous?.type === 'division' || previous?.type === 'clef'
          ? previous.bounds.x + previous.bounds.width + divisionGap / 2
          : next
            ? previous
              ? (previous.bounds.x + previous.bounds.width + next.bounds.x) / 2
              : next.bounds.x - interNeumeInkGap / 2
            : previous
              ? previous.bounds.x + previous.bounds.width + interNeumeInkGap / 2
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
  return slots;
}

/**
 * Score-absolute canvas. Normal systems still wrap at staffEndX,
 * irrespective of this canvas; only measured lyrics widen the text-derived
 * extent, and ink widens it within the containment margin.
 */
export function measureCanvas(
  systems: readonly ChantSystemLayout[],
  lyricsMeasured: boolean,
  hyphenExtents: LyricExtents | null,
): Pick<ChantLayout, 'x' | 'y' | 'width' | 'height'> {
  const edges = lyricsMeasured
    ? systems.flatMap((system) => system.lyrics)
    : [];
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
    x: canvasLeft,
    y: canvasTop,
    width: canvasRight - canvasLeft,
    height: canvasBottom - canvasTop,
  };
}
