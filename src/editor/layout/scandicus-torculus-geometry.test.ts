import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type ScandicusNeume,
  type TorculusNeume,
} from '../domain/chant-document';
import { deleteNote } from '../commands/delete-note';
import { deleteNeume } from '../commands/delete-neume';
import { moveNoteVertically } from '../commands/move-note';
import { moveNeumeVertically } from '../commands/move-neume';
import { getSurvivingFocusNoteId } from '../interaction/multi-system-editing';
import {
  reconcileSelection,
  selectNeume,
  selectNote,
} from '../state/selection';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history';
import {
  firstHeadHalfWidth,
  buildNeumeGeometry,
  type LayoutBounds,
} from './neume-geometry';
import {
  layoutChant,
  layoutGraphicalPlacementPreview,
  measureNeumeWidth,
  wrapNeumes,
} from './layout-chant';

const kinds = ['scandicus', 'torculus'] as const;
const intervals = [1, 2, 3, 4, 5, 6, 12];
function three(
  kind: (typeof kinds)[number],
  a: number,
  b: number,
  first = 0,
  id: string = kind,
): ScandicusNeume | TorculusNeume {
  return {
    id,
    kind,
    lyricSyllableId: 'lyric',
    notes: [
      { id: `${id}-0`, staffPosition: staffPosition(first) },
      { id: `${id}-1`, staffPosition: staffPosition(first + a) },
      {
        id: `${id}-2`,
        staffPosition: staffPosition(
          first + a + (kind === 'scandicus' ? b : -b),
        ),
      },
    ],
  };
}
function documentWith(neumes: readonly Neume[]): ChantDocument {
  return {
    title: 'Three-note engraving',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'lyric', text: 'a' }],
    neumes: [...neumes],
  };
}
function contains(bounds: LayoutBounds, x: number, y: number) {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}

describe('ordinary Scandicus and Torculus engraving', () => {
  it('preserves conventional separate Punctum + adjacent Pes without an invented stroke', () => {
    const g = buildNeumeGeometry(
      'scandicus',
      [0, 1, 2].map(staffPosition),
      0,
      0,
    );
    const first = buildNeumeGeometry('punctum', [staffPosition(0)], 0, 0);
    const pes = buildNeumeGeometry('podatus', [1, 2].map(staffPosition), 12, 0);
    expect(g.ink).toEqual([...first.ink, ...pes.ink]);
    expect(g.notes.map((n) => n.head)).toEqual(
      [...first.notes, ...pes.notes].map((n) => n.head),
    );
    expect(g.bounds).toEqual({ x: 0, y: -32, width: 24, height: 38 });
    expect(g.notes.map((n) => [n.anchorX, n.anchorY])).toEqual([
      [6, 0],
      [18, -12],
      [18, -24],
    ]);
    expect(g.notes[2]).toMatchObject({ y: -32, height: 14, anchorY: -24 });
    expect(g.ink).toHaveLength(2);
  });

  it.each([2, 3, 5, 12])(
    'retains an unmodified first Punctum when the first interval is adjacent and the second is %s',
    (b) => {
      const g = buildNeumeGeometry(
        'scandicus',
        [0, 1, 1 + b].map(staffPosition),
        0,
        0,
      );
      expect(g.ink).toHaveLength(2);
      expect(g.ink[0]).toEqual(
        buildNeumeGeometry('punctum', [staffPosition(0)], 0, 0).ink[0],
      );
      expect(g.notes[1].head).not.toEqual(g.ink[1]);
    },
  );

  it('fits the distinctive hooked middle member and upper terminal without a standalone Punctum substitution', () => {
    const g = buildNeumeGeometry(
      'scandicus',
      [0, 2, 3].map(staffPosition),
      0,
      0,
    );
    expect(g.notes[1].head).toEqual({
      kind: 'path',
      bounds: { x: 10.5, y: -30, width: 12, height: 15 },
      d: 'M10.5,-27 C13.5,-28 18.5,-30 21,-30 H22.5 V-18 C18.5,-20 13.5,-18 12,-15 H10.5 Z',
    });
    expect(g.notes[2].head).toEqual({
      kind: 'path',
      bounds: { x: 10.5, y: -44, width: 12, height: 14 },
      d: 'M10.5,-42 C10.5,-43.4 13.5,-44 16.5,-44 C19.5,-44 22.5,-43.4 22.5,-42 V-30 H21 Q18.5,-32 10.5,-32 Z',
    });
    expect(g.ink).toHaveLength(1);
  });

  it('integrates both adjacent Torculus contacts into the glyph and head overlays', () => {
    const g = buildNeumeGeometry(
      'torculus',
      [0, 1, 0].map(staffPosition),
      0,
      0,
    );
    expect(g.ink).toHaveLength(1);
    expect(g.notes.map((n) => n.head.bounds)).toEqual([
      { x: 0, y: -7.5, width: 12, height: 13.5 },
      { x: 12, y: -18, width: 12, height: 13.5 },
      { x: 24, y: -6, width: 12, height: 12 },
    ]);
    const [first, middle] = g.notes.map((n) => n.head);
    if (first.kind !== 'path' || middle.kind !== 'path')
      throw new Error('Expected head paths');
    expect(first.d).toContain('H10.5 L12,-7.5 V5.6');
    expect(middle.d).toContain('V-4.5 L22.5,-6 C21,-6');
    for (const part of [...g.ink, ...g.notes.map((n) => n.head)]) {
      if (part.kind !== 'path') throw new Error('Expected fitted paths');
      expect(part.d.match(/M/g)).toHaveLength(1);
      expect(part.d.match(/Z/g)).toHaveLength(1);
      expect(part.d).not.toMatch(/[hv]/);
    }
  });

  it.each(kinds)(
    '%s has exact interval-dependent bounds, anchors and independent head controls',
    (kind) => {
      for (const a of intervals)
        for (const b of intervals)
          for (const first of [0, 1]) {
            const positions = [
              first,
              first + a,
              first + a + (kind === 'scandicus' ? b : -b),
            ].map(staffPosition);
            const g = buildNeumeGeometry(kind, positions, 17.5, 244);
            const u = -12 * a,
              v = kind === 'scandicus' ? -12 * (a + b) : 12 * (b - a);
            const h = a === 1 ? 12 : 10.5;
            const z = kind === 'scandicus' ? h : h + (b === 1 ? 12 : 10.5);
            const top = kind === 'scandicus' ? v - (b === 1 ? 8 : 6) : u - 6;
            const bottom = kind === 'scandicus' ? 6 : Math.max(6, v + 6);
            const y = 244 - 12 * first;
            expect(g.bounds).toEqual({
              x: 17.5,
              y: y + top,
              width: z + 12,
              height: bottom - top,
            });
            expect(g.advanceX).toBe(z + 45);
            expect(g.lyricAnchorX).toBe(23.5);
            expect(g.notes.map((n) => [n.anchorX, n.anchorY])).toEqual([
              [23.5, y],
              [23.5 + h, y + u],
              [23.5 + z, y + v],
            ]);
            expect(g.ink).toHaveLength(kind === 'scandicus' && a === 1 ? 2 : 1);
            for (const n of g.notes) {
              expect(n.head.bounds).toEqual({
                x: n.x,
                y: n.y,
                width: n.width,
                height: n.height,
              });
              expect(n.hitBounds.width).toBeGreaterThan(0);
              expect(n.hitBounds.height).toBeGreaterThan(0);
              expect(contains(n.hitBounds, n.anchorX, n.anchorY)).toBe(true);
              expect(
                g.notes.filter((target) =>
                  contains(target.hitBounds, n.anchorX, n.anchorY),
                ),
              ).toEqual([n]);
              expect(n.head.kind).toBe('path');
              expect(n).not.toHaveProperty('noteId');
            }
          }
    },
  );

  it.each(kinds)(
    '%s shared geometry matches committed layout across insertion boundaries and systems',
    (kind) => {
      const before = Array.from({ length: 24 }, (_, i) =>
        three(i % 2 ? 'scandicus' : 'torculus', 1, 1, 1, `existing-${i}`),
      );
      for (const a of [1, 2, 5, 6])
        for (const b of [1, 2, 5, 6])
          for (const insertionIndex of [0, 7, 24]) {
            const candidate = three(kind, a, b, 1);
            const staffPositions = [
              candidate.notes[0].staffPosition,
              candidate.notes[1].staffPosition,
              candidate.notes[2].staffPosition,
            ] as const;
            const prospective = layoutChant(
              documentWith([
                ...before.slice(0, insertionIndex),
                candidate,
                ...before.slice(insertionIndex),
              ]),
            );
            const committed = prospective.systems.flatMap((s) => s.neumes)[
              insertionIndex
            ];
            const {
              neumeId: _id,
              lyricSyllableId: _lyric,
              kind: _kind,
              notes,
              ...geometry
            } = committed;
            const preview = buildNeumeGeometry(
              kind,
              staffPositions,
              committed.notes[0].anchorX - firstHeadHalfWidth(kind),
              committed.notes[0].anchorY + staffPositions[0] * 12,
            );
            expect(preview).toEqual({
              ...geometry,
              notes: notes.map(({ noteId: _note, ...n }) => n),
            });
            expect(measureNeumeWidth(candidate)).toBe(committed.bounds.width);
            expect(prospective.systems[0].lyrics[0].x).toBe(230);
            expect(
              prospective.systems.slice(1).every((s) => s.lyrics.length === 0),
            ).toBe(true);
          }
    },
  );

  it.each(kinds)(
    '%s wraps at painted extents and preserves IDs, selection, focus targets and history through interval edits',
    (kind) => {
      const neumes = Array.from({ length: 9 }, (_, i) =>
        three(kind, 2, 1, 0, `n-${i}`),
      );
      const original = documentWith(neumes);
      const laidOut = layoutChant(original);
      const tail = laidOut.systems[0].neumes.at(-1);
      if (!tail) throw new Error('Missing tail');
      const boundary = tail.bounds.x + tail.bounds.width;
      const prefix = neumes.slice(0, laidOut.systems[0].neumes.length);
      expect(wrapNeumes(prefix, boundary)).toHaveLength(1);
      expect(wrapNeumes(prefix, boundary - 0.01)).toHaveLength(2);
      const target = prefix[prefix.length - 1];
      const edited = applyDocumentEdit(
        createDocumentHistory(documentWith(prefix)),
        (d) => moveNoteVertically(d, target.notes[0].id, 1),
      );
      expect(edited.past).toHaveLength(1);
      expect(wrapNeumes(edited.present.neumes, boundary)).toHaveLength(2);
      expect(edited.present.neumes.at(-1)?.notes.map((n) => n.id)).toEqual(
        target.notes.map((n) => n.id),
      );
      expect(
        reconcileSelection(edited.present, selectNote(target.notes[1].id)),
      ).toEqual(selectNote(target.notes[1].id));
      expect(
        reconcileSelection(edited.present, selectNeume(target.id)),
      ).toEqual(selectNeume(target.id));
      expect(getSurvivingFocusNoteId(edited.present, target.notes[0].id)).toBe(
        target.notes[0].id,
      );
      expect(undoDocumentEdit(edited).present).toEqual(documentWith(prefix));
      expect(redoDocumentEdit(undoDocumentEdit(edited)).present).toEqual(
        edited.present,
      );
      expect(
        measureNeumeWidth(
          moveNeumeVertically(original, target.id, 1).neumes.find(
            (n) => n.id === target.id,
          ) ?? target,
        ),
      ).toBe(tail.bounds.width);
      expect(
        deleteNeume(original, target.id).neumes.some((n) => n.id === target.id),
      ).toBe(false);
      const normalized = deleteNote(original, target.notes[0].id).neumes.find(
        (n) => n.id === target.id,
      );
      expect(normalized?.kind).toBe(
        kind === 'scandicus' ? 'podatus' : 'clivis',
      );
      expect(normalized?.notes.map((n) => n.id)).toEqual(
        target.notes.slice(1).map((n) => n.id),
      );
    },
  );

  it.each(kinds)(
    '%s keeps its local ghost on the committed staff until wrapping is committed',
    (kind) => {
      // The complete prefix ends exactly at x=656.
      const prefix = [
        three('scandicus', 2, 1, 2, 'prefix-wide'),
        ...Array.from({ length: 5 }, (_, i) =>
          three('scandicus', 1, 1, 2, `prefix-${i}`),
        ),
        three('torculus', 1, 1, 2, 'prefix-torculus'),
        three('scandicus', 2, 1, 2, 'prefix-tail'),
      ];
      const before = layoutChant(documentWith(prefix));
      expect(before.systems).toHaveLength(1);
      const candidate = three(kind, 1, 1, 2);
      const preview = layoutGraphicalPlacementPreview(
        before,
        {
          kind,
          staffPositions: [
            candidate.notes[0].staffPosition,
            candidate.notes[1].staffPosition,
            candidate.notes[2].staffPosition,
          ],
          insertionIndex: prefix.length,
        },
        { x: 655, y: 100 },
      );
      const committed = layoutChant(documentWith([...prefix, candidate]));
      expect(committed.systems).toHaveLength(2);
      expect(before.systems).toHaveLength(1);
      expect(preview).not.toHaveProperty('scoreHeight');
      expect(preview?.notes[0].anchorY).toBe(100);
      expect(preview?.bounds.x).toBeLessThan(656);
      expect(preview).not.toHaveProperty('neumeId');
      expect(preview?.notes.every((n) => !('noteId' in n))).toBe(true);
    },
  );

  it('retains equal-outer Torculus middle-deletion rejection and rejected pitch edits', () => {
    const original = documentWith([three('torculus', 1, 1)]);
    expect(deleteNote(original, 'torculus-1')).toBe(original);
    expect(moveNoteVertically(original, 'torculus-1', -1)).toBe(original);
  });
});
