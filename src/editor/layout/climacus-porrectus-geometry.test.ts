import approvedJson from '../../../docs/verification/climacus-porrectus/specimen-recipes.json?raw';
import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ClimacusNeume,
  type PorrectusNeume,
  type Neume,
} from '../domain/chant-document';
import { moveNoteVertically } from '../commands/move-note';
import { moveNeumeVertically } from '../commands/move-neume';
import { deleteNote } from '../commands/delete-note';
import {
  createDocumentHistory,
  applyDocumentEdit,
  undoDocumentEdit,
  redoDocumentEdit,
} from '../state/document-history';
import { getSurvivingFocusNoteId } from '../interaction/multi-system-editing';
import { reconcileSelection, selectNote } from '../state/selection';
import {
  buildNeumeGeometry,
  getInkBounds,
  type LayoutBounds,
} from './neume-geometry';
import {
  layoutChant,
  layoutGraphicalPlacementPreview,
  measureNeumeWidth,
  wrapNeumes,
} from './layout-chant';

type Kind = 'climacus' | 'porrectus';
interface ApprovedRecipe {
  kind: 'Climacus' | 'Porrectus';
  intervals: [number, number];
  ink: string[];
  selections: string[];
  anchors: [number, number][];
  bounds: LayoutBounds;
  hitBounds: LayoutBounds[];
  hitShapes?: string[];
  lyricAnchorX: number;
  advanceX: number;
}
const approved = JSON.parse(approvedJson) as ApprovedRecipe[];
const kinds = ['climacus', 'porrectus'] as const;

function three(
  kind: Kind,
  a: number,
  b: number,
  first = 0,
  id: string = kind,
): ClimacusNeume | PorrectusNeume {
  return {
    id,
    kind,
    lyricSyllableId: 'lyric',
    notes: [
      { id: `${id}-0`, staffPosition: staffPosition(first) },
      { id: `${id}-1`, staffPosition: staffPosition(first - a) },
      {
        id: `${id}-2`,
        staffPosition: staffPosition(
          first - a + (kind === 'climacus' ? -b : b),
        ),
      },
    ],
  };
}
function documentWith(neumes: Neume[]): ChantDocument {
  return {
    title: 'Engraving review',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'lyric', text: 'Al-' }],
    neumes,
  };
}
function expectPath(actual: string, expected: string) {
  const tokens = (d: string) =>
    d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const a = tokens(actual),
    b = tokens(expected);
  expect(a).toHaveLength(b.length);
  for (let i = 0; i < a.length; i++) {
    if (/^[A-Za-z]$/.test(a[i])) expect(a[i]).toBe(b[i]);
    else expect(Number(a[i])).toBeCloseTo(Number(b[i]), 10);
  }
}

describe('approved Climacus and Porrectus engraving', () => {
  it.each(approved)(
    '$kind ($intervals) matches the independent approved contours and targets',
    (r) => {
      const kind = r.kind.toLowerCase() as Kind;
      const candidate = three(kind, ...r.intervals);
      const g = buildNeumeGeometry(
        kind,
        candidate.notes.map((n) => n.staffPosition),
        0,
        0,
      );
      expect(g.bounds).toEqual(r.bounds);
      expect(g.advanceX).toBe(r.advanceX);
      expect(g.lyricAnchorX).toBe(r.lyricAnchorX);
      expect(g.notes.map((n) => [n.anchorX, n.anchorY])).toEqual(r.anchors);
      expect(g.notes.map((n) => n.hitBounds)).toEqual(r.hitBounds);
      expect(g.ink).toHaveLength(r.ink.length);
      g.ink.forEach((s, i) => {
        if (s.kind !== 'path') throw Error('Expected path');
        expectPath(s.d, r.ink[i]);
      });
      g.notes.forEach((n, i) => {
        if (n.head.kind !== 'path') throw Error('Expected selection contour');
        expectPath(n.head.d, r.selections[i]);
        if (r.hitShapes) {
          if (n.hitShape?.kind !== 'path') throw Error('Expected path target');
          expectPath(n.hitShape.d, r.hitShapes[i]);
          expect(n.hitShape.bounds).toEqual(n.hitBounds);
        } else expect(n.hitShape).toBeUndefined();
      });
    },
  );

  it.each(kinds)(
    '%s preserves nominal anchors, transposition widths and ID-free geometry over interval matrices',
    (kind) => {
      for (const a of [1, 2, 3, 4, 5, 6, 8])
        for (const b of [1, 2, 3, 4, 5, 6, 8]) {
          const candidate = three(kind, a, b);
          const origin = buildNeumeGeometry(
            kind,
            candidate.notes.map((n) => n.staffPosition),
            0,
            0,
          );
          const shifted = buildNeumeGeometry(
            kind,
            three(kind, a, b, 1).notes.map((n) => n.staffPosition),
            17.5,
            244,
          );
          expect(origin.notes).toHaveLength(3);
          expect(origin.bounds).toEqual(getInkBounds(origin.ink));
          expect(origin.advanceX).toBe(origin.bounds.width + 33);
          expect(origin.lyricAnchorX).toBe(6);
          expect(shifted.bounds).toEqual({
            ...origin.bounds,
            x: origin.bounds.x + 17.5,
            y: origin.bounds.y + 232,
          });
          expect(shifted.advanceX).toBe(origin.advanceX);
          expect(shifted.notes.map((n) => [n.anchorX, n.anchorY])).toEqual(
            origin.notes.map((n) => [n.anchorX + 17.5, n.anchorY + 232]),
          );
          expect(origin.notes.map((n) => n.anchorY)).toEqual(
            candidate.notes.map((n) => 0 - 12 * n.staffPosition),
          );
          for (const n of origin.notes) {
            expect(n).not.toHaveProperty('noteId');
            expect(n.hitBounds.width).toBeGreaterThan(0);
            expect(n.hitBounds.height).toBeGreaterThan(0);
          }
          if (kind === 'porrectus')
            expect(origin.notes[0].hitBounds.y).toBe(-14);
        }
    },
  );

  it.each(kinds)(
    '%s preview equals committed geometry including targets after multi-system reflow',
    (kind) => {
      const prefix = Array.from({ length: 20 }, (_, i) =>
        three(i % 2 ? 'climacus' : 'porrectus', 1, 2, 3, `existing-${i}`),
      );
      for (const a of [1, 2, 5, 6])
        for (const b of [1, 2, 5, 6])
          for (const insertionIndex of [0, 6, 20]) {
            const candidate = three(kind, a, b, 3);
            const preview = layoutGraphicalPlacementPreview(prefix, {
              kind,
              staffPositions: [
                candidate.notes[0].staffPosition,
                candidate.notes[1].staffPosition,
                candidate.notes[2].staffPosition,
              ],
              insertionIndex,
            });
            const layout = layoutChant(
              documentWith([
                ...prefix.slice(0, insertionIndex),
                candidate,
                ...prefix.slice(insertionIndex),
              ]),
            );
            const committed = layout.systems.flatMap((s) => s.neumes)[
              insertionIndex
            ];
            const {
              neumeId: _id,
              lyricSyllableId: _lyric,
              notes,
              ...geometry
            } = committed;
            expect(preview).toEqual({
              ...geometry,
              notes: notes.map(({ noteId: _note, ...n }) => n),
              scoreHeight: layout.height,
            });
            expect(layout.systems[0].lyrics[0].x).toBe(230);
            expect(
              layout.systems.slice(1).every((s) => s.lyrics.length === 0),
            ).toBe(true);
          }
    },
  );

  it.each(kinds)(
    '%s exact-fit interval growth preserves IDs, selection, surviving focus and undo/redo',
    (kind) => {
      // Five prefix advances plus the tail's painted width exactly span
      // x=224..656. Interval growth must therefore reparent the tail.
      const prefixRecipes: readonly (readonly [Kind, number, number])[] =
        kind === 'climacus'
          ? [
              ['climacus', 1, 1],
              ['climacus', 1, 1],
              ['climacus', 2, 1],
              ['climacus', 2, 1],
              ['climacus', 2, 1],
            ]
          : [
              ['porrectus', 2, 2],
              ['porrectus', 2, 1],
              ['porrectus', 2, 1],
              ['climacus', 2, 1],
              ['climacus', 2, 1],
            ];
      const prefix = prefixRecipes.map(([k, a, b], i) =>
        three(k, a, b, 3, `prefix-${i}`),
      );
      const tail = three(kind, 1, 1, 3, 'tail');
      const original = documentWith([...prefix, tail]);
      const laidOut = layoutChant(original)
        .systems.flatMap((s) => s.neumes)
        .at(-1);
      if (!laidOut) throw Error('Missing tail');
      const boundary = laidOut.bounds.x + laidOut.bounds.width;
      expect(boundary).toBe(656);
      expect(layoutChant(original).systems).toHaveLength(1);
      expect(wrapNeumes(original.neumes, boundary)).toHaveLength(1);
      expect(wrapNeumes(original.neumes, boundary - 0.01)).toHaveLength(2);
      const edited = applyDocumentEdit(createDocumentHistory(original), (d) =>
        moveNoteVertically(d, 'tail-0', 1),
      );
      expect(edited.past).toHaveLength(1);
      expect(wrapNeumes(edited.present.neumes, boundary)).toHaveLength(2);
      expect(layoutChant(edited.present).systems[1].neumes[0].neumeId).toBe(
        'tail',
      );
      expect(edited.present.neumes.at(-1)?.notes.map((n) => n.id)).toEqual(
        tail.notes.map((n) => n.id),
      );
      expect(reconcileSelection(edited.present, selectNote('tail-1'))).toEqual(
        selectNote('tail-1'),
      );
      expect(getSurvivingFocusNoteId(edited.present, 'tail-0')).toBe('tail-0');
      expect(undoDocumentEdit(edited).present).toEqual(original);
      expect(redoDocumentEdit(undoDocumentEdit(edited)).present).toEqual(
        edited.present,
      );
      expect(
        measureNeumeWidth(moveNeumeVertically(original, 'tail', 1).neumes[5]),
      ).toBe(measureNeumeWidth(tail));
      const normalized = deleteNote(original, 'tail-0').neumes[5];
      expect(normalized.kind).toBe(kind === 'climacus' ? 'clivis' : 'podatus');
      expect(normalized.notes.map((n) => n.id)).toEqual(['tail-1', 'tail-2']);
    },
  );
});
