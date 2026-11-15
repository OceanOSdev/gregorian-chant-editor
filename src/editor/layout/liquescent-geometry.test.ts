import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type NoteAppearance,
} from '../domain/chant-document';
import type { LiquescentFigure } from '../domain/liquescence';
import { insertEditorNeume } from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { entryGeometryKind } from '../neume-entry-pitches';
import {
  buildNeumeGeometry,
  firstHeadHalfWidth,
  geometryKindFor,
  type GeometryKind,
  type LayoutBounds,
} from './neume-geometry';
import { liquescentMetrics } from './neumes/liquescent';
import { layoutChant } from './layout-chant';

const p = staffPosition;
const bottom = 140;
const figures: [LiquescentFigure, 1 | -1, Neume['kind']][] = [
  ['epiphonus', 1, 'podatus'],
  ['augmentative-pes', 1, 'podatus'],
  ['cephalicus', -1, 'clivis'],
];
// Line and space starts, observed (Δ1–Δ4) and extrapolated (Δ5–Δ9) intervals.
const cases = figures.flatMap(([figure, dir, base]) =>
  [1, 2, 3, 4, 5, 6, 9].flatMap((distance) =>
    [-2, -1, 0, 1, 2, 3].map(
      (start) =>
        [figure, base, [start, start + dir * distance], distance] as const,
    ),
  ),
);
const overlaps = (a: LayoutBounds, b: LayoutBounds) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;
const contains = (outer: LayoutBounds, inner: LayoutBounds) =>
  inner.x >= outer.x - 1e-9 &&
  inner.y >= outer.y - 1e-9 &&
  inner.x + inner.width <= outer.x + outer.width + 1e-9 &&
  inner.y + inner.height <= outer.y + outer.height + 1e-9;

describe('shared liquescent geometry (ADR 0027)', () => {
  it.each(cases)(
    '%s (%s) at %j keeps exact pitch anchors, ink containment and separate ordinary-size targets',
    (figure, _base, pitches) => {
      const g = buildNeumeGeometry(figure, pitches.map(p), 50, bottom);
      expect(g.notes).toHaveLength(2);
      g.notes.forEach((note, i) => {
        expect(note.anchorY).toBe(bottom - pitches[i] * 12);
        expect(contains(g.bounds, note.head.bounds)).toBe(true);
        expect(note.anchorX).toBeGreaterThanOrEqual(g.bounds.x);
        expect(note.anchorX).toBeLessThanOrEqual(g.bounds.x + g.bounds.width);
        // Ordinary-size controls: at least a head plus padding on each axis.
        // A diagonal second splits at its anchor midpoint (17.25 each).
        expect(note.hitBounds.width).toBeGreaterThanOrEqual(17);
        expect(note.hitBounds.height).toBeGreaterThanOrEqual(18);
        expect(
          note.hitBounds.x <= note.anchorX &&
            note.anchorX <= note.hitBounds.x + note.hitBounds.width &&
            note.hitBounds.y <= note.anchorY &&
            note.anchorY <= note.hitBounds.y + note.hitBounds.height,
        ).toBe(true);
      });
      expect(overlaps(g.notes[0].hitBounds, g.notes[1].hitBounds)).toBe(false);
      expect(JSON.stringify(g)).not.toMatch(/NaN|Infinity/);
      expect(g.advanceX).toBe(g.bounds.width + 33);
    },
  );

  it.each([1, 2, 3, 4, 5])(
    'Δ%s: epiphonus keeps the Podatus column; cephalicus is narrower than the Clivis; the augmentative pes is wider than the Podatus',
    (distance) => {
      const up = [p(0), p(distance)];
      const down = [p(distance), p(0)];
      const width = (kind: GeometryKind, positions: typeof up) =>
        buildNeumeGeometry(kind, positions, 0, bottom).bounds.width;
      expect(width('epiphonus', up)).toBe(width('podatus', up));
      expect(width('cephalicus', down)).toBeLessThan(width('clivis', down));
      expect(width('cephalicus', down)).toBe(12);
      expect(width('augmentative-pes', up)).toBeGreaterThan(
        width('podatus', up),
      );
      expect(width('augmentative-pes', up)).toBe(22.5);
      // Lyric anchors: column figures centre on the head; the offset pair on its anchors.
      expect(buildNeumeGeometry('epiphonus', up, 0, bottom).lyricAnchorX).toBe(
        6,
      );
      expect(
        buildNeumeGeometry('cephalicus', down, 0, bottom).lyricAnchorX,
      ).toBe(6);
      const aug = buildNeumeGeometry('augmentative-pes', up, 0, bottom);
      expect(aug.lyricAnchorX).toBe(
        (aug.notes[0].anchorX + aug.notes[1].anchorX) / 2,
      );
    },
  );

  it('draws the Dominican tail at a constant length below the upper pitch, from the upper head', () => {
    for (const distance of [1, 2, 3, 4, 6]) {
      const g = buildNeumeGeometry(
        'augmentative-pes',
        [p(0), p(distance)],
        0,
        bottom,
      );
      const upper = g.notes[1];
      const tailBottom = upper.head.bounds.y + upper.head.bounds.height;
      expect(
        Math.max(tailBottom, bottom + 5.6) -
          Math.max(
            upper.anchorY + liquescentMetrics.tailBelowUpperPitch,
            bottom + 5.6,
          ),
      ).toBe(0);
      expect(upper.anchorX - g.notes[0].anchorX).toBe(
        liquescentMetrics.headOffset,
      );
    }
  });

  it('keeps ordinary Podatus and Clivis geometry unchanged by the new discriminator', () => {
    for (const distance of [1, 2, 3, 4]) {
      const up = [p(0), p(distance)];
      expect(
        buildNeumeGeometry(
          geometryKindFor({
            id: 'x',
            kind: 'podatus',
            notes: up.map((s, i) => ({
              id: `${i}`,
              staffPosition: s,
            })) as never,
          }),
          up,
          0,
          bottom,
        ),
      ).toEqual(buildNeumeGeometry('podatus', up, 0, bottom));
    }
  });

  it.each(figures)(
    '%s places every first-note mark and accidental at Δ1–Δ4 without overlapping the other constituent',
    (figure, dir) => {
      const marks: NoteAppearance[] = [
        { mora: 1 },
        { episema: true },
        { verticalEpisema: true },
        { mora: 1, episema: true, verticalEpisema: true },
      ];
      for (const distance of [1, 2, 3, 4])
        for (const start of [0, 1])
          for (const mark of marks) {
            const positions = [p(start), p(start + dir * distance)];
            const g = buildNeumeGeometry(figure, positions, 50, bottom, [
              mark,
              {},
            ]);
            expect(g.notes[0].modifierBounds).toBeDefined();
            expect(g.notes[1].modifierBounds).toBeUndefined();
            // Each sign separately: their union may legitimately span both.
            for (const sign of g.ink.filter((part) => part.kind === 'rect'))
              expect(overlaps(sign.bounds, g.notes[1].head.bounds)).toBe(false);
          }
      for (const noteIndex of [null, 0, 1])
        for (const distance of [1, 3]) {
          const positions = [p(1), p(1 + dir * distance)];
          const g = buildNeumeGeometry(
            figure,
            positions,
            50,
            bottom,
            [],
            [
              {
                kind: 'flat',
                staffPosition: positions[noteIndex ?? 0],
                noteIndex,
              },
            ],
          );
          expect(g.accidentals).toHaveLength(1);
          expect(g.bounds.x).toBeGreaterThanOrEqual(50);
        }
    },
  );
});

describe('preview and committed parity', () => {
  const document: ChantDocument = {
    accidentals: [],
    clefChanges: [],
    divisions: [],
    lyricLanguage: 'la',
    title: 'Parity',
    clef: { type: 'c', staffLine: 3 },
    syllables: [],
    neumes: [],
  };
  it.each([
    ['epiphonus', [2, 3]],
    ['augmentative-pes', [2, 3]],
    ['cephalicus', [2, 1]],
  ] as const)(
    '%s ghost and committed layout use one builder',
    (entry, positions) => {
      const intent = resolveGraphicalNeumePlacement(
        layoutChant(document),
        entry,
        {
          x: 300,
          y: 100,
        },
      );
      if (!intent) throw new Error('Expected insertion intent');
      expect(intent.staffPositions).toEqual(positions);
      const kind = entryGeometryKind(entry);
      const ghost = intent.preview;
      expect(ghost.ink).toEqual(
        buildNeumeGeometry(
          kind,
          positions.map(p),
          ghost.notes[0].anchorX - firstHeadHalfWidth(kind),
          124,
        ).ink,
      );
      const committed = insertEditorNeume(document, intent, {
        neumeId: 'new',
        noteIds: ['a', 'b', 'c'],
      });
      const neume = committed.neumes[0];
      expect(geometryKindFor(neume)).toBe(kind);
      const laid = layoutChant(committed).systems[0].neumes[0];
      expect(laid.liquescentFigure).toBe(entry);
      const bottomY = Math.max(
        ...layoutChant(committed).systems[0].staffLines.map((l) => l.y),
      );
      const rebuilt = buildNeumeGeometry(
        kind,
        positions.map(p),
        laid.bounds.x,
        bottomY,
      );
      expect(laid.ink).toEqual(rebuilt.ink);
      expect(laid.notes.map((n) => n.hitBounds)).toEqual(
        rebuilt.notes.map((n) => n.hitBounds),
      );
    },
  );
});
