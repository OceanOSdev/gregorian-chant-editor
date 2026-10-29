import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type PodatusNeume,
  type ClivisNeume,
} from '../domain/chant-document';
import { moveNoteVertically } from '../commands/move-note';
import { moveNeumeVertically } from '../commands/move-neume';
import { deleteNote } from '../commands/delete-note';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history';
import {
  firstHeadHalfWidth,
  buildNeumeGeometry,
  getInkBounds,
} from './neume-geometry';
import {
  getNeumeLyricAlignmentX,
  layoutChant,
  measureNeumeWidth,
  wrapNeumes,
} from './layout-chant';

function twoNote(
  kind: 'podatus' | 'clivis',
  distance: number,
  id: string = kind,
): PodatusNeume | ClivisNeume {
  return {
    id,
    kind,

    notes: [
      { id: `${id}-first`, staffPosition: staffPosition(0) },
      {
        id: `${id}-second`,
        staffPosition: staffPosition(kind === 'podatus' ? distance : -distance),
      },
    ],
  };
}
function documentWith(neumes: readonly Neume[]): ChantDocument {
  return {
    title: 'Engraving',
    clef: { type: 'c', staffLine: 3 },
    syllables: neumes.length
      ? [
          {
            id: 'lyric',
            text: 'Ky',
            startsAtNeumeId: neumes[0].id,
            boundaryBefore: 'word',
          },
        ]
      : [],
    neumes: [...neumes],
  };
}

describe('approved engraving geometry', () => {
  it('uses the approved Variant C contour within the unchanged Punctum cell', () => {
    const g = buildNeumeGeometry('punctum', [staffPosition(0)], 0, 0);
    expect(g.ink).toEqual([
      {
        kind: 'path',
        d: 'M0,-4 C0,-5.4 3,-6 6,-6 C9,-6 12,-5.4 12,-4 V5.6 C12,5.9 11.85,6 11.6,6 C9.8,6 8,4.8 6,4.8 C4,4.8 2.2,6 0.4,6 C0.15,6 0,5.9 0,5.6 Z',
        bounds: { x: 0, y: -6, width: 12, height: 12 },
      },
    ]);
    expect(g.notes[0]).toMatchObject({ anchorX: 6, anchorY: 0 });
    expect(g.notes[0].head).toBe(g.ink[0]);
    expect(g.notes[0].hitBounds).toEqual({
      x: -6,
      y: -12,
      width: 24,
      height: 24,
    });
    expect(g.lyricAnchorX).toBe(6);
    expect(g.advanceX).toBe(45);
  });

  it('keeps the adjacent Pes opening and continuous right edge in ONE contour', () => {
    const g = buildNeumeGeometry(
      'podatus',
      [staffPosition(0), staffPosition(1)],
      0,
      0,
    );
    expect(g.ink).toEqual([
      {
        kind: 'path',
        bounds: { x: 0, y: -20, width: 12, height: 26 },
        d: 'M0,-18 C0,-19.4 3,-20 6,-20 C9,-20 12,-19.4 12,-18 V5.6 C12,5.9 11.85,6 11.6,6 C9.8,6 8,4.8 6,4.8 C4,4.8 2.2,6 0.4,6 C0.15,6 0,5.9 0,5.6 V-6 H10.5 L9,-9 6,-10 0,-9 Z',
      },
    ]);
    expect(g.notes.map((n) => [n.anchorX, n.anchorY])).toEqual([
      [6, 0],
      [6, -12],
    ]);
    expect(g.notes[1]).toMatchObject({ y: -20, height: 14 });
    const [lower, upper] = g.notes;
    expect(upper.hitBounds.y + upper.hitBounds.height).toBe(lower.hitBounds.y);
    expect(lower.hitBounds.y).toBe(-6);
  });

  it('fits adjacent Clivis heads together without a separate bridge or AA edge', () => {
    const g = buildNeumeGeometry(
      'clivis',
      [staffPosition(0), staffPosition(-1)],
      0,
      0,
    );
    expect(g.ink).toEqual([
      {
        kind: 'path',
        bounds: { x: 0, y: -6, width: 24, height: 33 },
        d: 'M0,-4 C0,-5.4 3,-6 6,-6 C9,-6 12,-5.4 12,-4 V6 H18 C21,6 24,6.6 24,8 V17.6 C24,17.9 23.85,18 23.6,18 C21.8,18 20,16.8 18,16.8 C16,16.8 14.2,18 12.4,18 C12.15,18 12,17.9 12,17.6 H12 V7.5 L10.5,6 C9,6 8,4.8 6,4.8 C4,4.8 3,6 1.5,6 V27 H0 Z',
      },
    ]);
    const [first, second] = g.notes;
    expect(first.hitBounds.x + first.hitBounds.width).toBe(12);
    expect(second.hitBounds.x).toBe(12);
    expect(g.lyricAnchorX).toBe(12);
    expect(g).not.toHaveProperty('connectors');
  });

  it.each([1, 2, 3, 4, 5, 6, 8, 12])(
    'uses the approved stem at Δ%s without an interval cutoff',
    (distance) => {
      const g = buildNeumeGeometry(
        'clivis',
        [staffPosition(0), staffPosition(-distance)],
        0,
        0,
      );
      const ink = g.ink[0];
      if (ink.kind !== 'path') throw new Error('Clivis must have a silhouette');
      const stem = distance <= 2 ? 27 : distance === 3 ? 39 : 45;
      expect(ink.d).toContain(`1.5,6 V${stem} H0 Z`);
      expect(g.bounds.width).toBe(distance === 1 ? 24 : 22.5);
      expect(g.notes[1].anchorY).toBe(distance * 12);
      expect(g.lyricAnchorX).toBe(distance === 1 ? 12 : 11.25);
    },
  );

  it.each(['podatus', 'clivis'] as const)(
    'measures and builds %s committed geometry identically over line/space and wide intervals',
    (kind) => {
      for (const first of [-1, 0, 1, 6])
        for (const distance of [1, 2, 3, 4, 5, 6, 8, 12]) {
          const positions = [
            staffPosition(first),
            staffPosition(first + (kind === 'podatus' ? distance : -distance)),
          ] as const;
          const neume = twoNote(kind, distance);
          neume.notes[0].staffPosition = positions[0];
          neume.notes[1].staffPosition = positions[1];
          const before = Array.from({ length: 21 }, (_, i) =>
            twoNote(i % 2 ? 'podatus' : 'clivis', (i % 5) + 1, `existing-${i}`),
          );
          for (const insertionIndex of [0, 7, 21]) {
            const neumes = [
              ...before.slice(0, insertionIndex),
              neume,
              ...before.slice(insertionIndex),
            ];
            const prospective = layoutChant(documentWith(neumes));
            const committed = prospective.systems.flatMap((s) => s.neumes)[
              insertionIndex
            ];
            const {
              neumeId: _id,

              kind: _kind,
              notes,
              ...geometry
            } = committed;
            const preview = buildNeumeGeometry(
              kind,
              positions,
              committed.notes[0].anchorX - firstHeadHalfWidth(kind),
              committed.notes[0].anchorY + positions[0] * 12,
            );
            expect(preview).toEqual({
              ...geometry,
              notes: notes.map(({ noteId: _note, ...n }) => n),
            });
            expect(measureNeumeWidth(neume)).toBe(committed.bounds.width);
            expect(preview?.ink).toHaveLength(1);
            const ink = committed.ink[0];
            if (ink.kind !== 'path')
              throw new Error('Compound must have a path');
            expect(ink.d.match(/M/g)).toHaveLength(1);
            expect(ink.d.match(/Z/g)).toHaveLength(1);
            for (const n of notes) {
              expect(n.x).toBeGreaterThanOrEqual(committed.bounds.x);
              expect(n.y).toBeGreaterThanOrEqual(committed.bounds.y);
              expect(n.y + n.height).toBeLessThanOrEqual(
                committed.bounds.y + committed.bounds.height,
              );
            }
          }
        }
    },
  );

  it.each([
    [
      'podatus',
      1,
      'M0,-18 C0,-19.4 3,-20 6,-20 C9,-20 12,-19.4 12,-18 V5.6 C12,5.9 11.85,6 11.6,6 C9.8,6 8,4.8 6,4.8 C4,4.8 2.2,6 0.4,6 C0.15,6 0,5.9 0,5.6 V-6 H10.5 L9,-9 6,-10 0,-9 Z',
    ],
    [
      'podatus',
      3,
      'M0,-40 C0,-41.4 3,-42 6,-42 C9,-42 12,-41.4 12,-40 V5.6 C12,5.9 11.85,6 11.6,6 C9.8,6 8,4.8 6,4.8 C4,4.8 2.2,6 0.4,6 C0.15,6 0,5.9 0,5.6 V-6 H10.5 V-30 Q9,-32 0,-32 Z',
    ],
    [
      'clivis',
      1,
      'M0,-4 C0,-5.4 3,-6 6,-6 C9,-6 12,-5.4 12,-4 V6 H18 C21,6 24,6.6 24,8 V17.6 C24,17.9 23.85,18 23.6,18 C21.8,18 20,16.8 18,16.8 C16,16.8 14.2,18 12.4,18 C12.15,18 12,17.9 12,17.6 H12 V7.5 L10.5,6 C9,6 8,4.8 6,4.8 C4,4.8 3,6 1.5,6 V27 H0 Z',
    ],
    [
      'clivis',
      2,
      'M0,-4 C0,-5.4 3,-6 6,-6 C9,-6 12,-5.4 12,-4 V18 H16.5 C19.5,18 22.5,18.6 22.5,20 V29.6 C22.5,29.9 22.35,30 22.1,30 C20.3,30 18.5,28.8 16.5,28.8 C14.5,28.8 12.7,30 10.9,30 C10.65,30 10.5,29.9 10.5,29.6 H10.5 V6 C9,6 8,4.8 6,4.8 C4,4.8 3,6 1.5,6 V27 H0 Z',
    ],
    [
      'clivis',
      3,
      'M0,-4 C0,-5.4 3,-6 6,-6 C9,-6 12,-5.4 12,-4 V30 H16.5 C19.5,30 22.5,30.6 22.5,32 V41.6 C22.5,41.9 22.35,42 22.1,42 C20.3,42 18.5,40.8 16.5,40.8 C14.5,40.8 12.7,42 10.9,42 C10.65,42 10.5,41.9 10.5,41.6 H10.5 V6 C9,6 8,4.8 6,4.8 C4,4.8 3,6 1.5,6 V39 H0 Z',
    ],
    [
      'clivis',
      4,
      'M0,-4 C0,-5.4 3,-6 6,-6 C9,-6 12,-5.4 12,-4 V42 H16.5 C19.5,42 22.5,42.6 22.5,44 V53.6 C22.5,53.9 22.35,54 22.1,54 C20.3,54 18.5,52.8 16.5,52.8 C14.5,52.8 12.7,54 10.9,54 C10.65,54 10.5,53.9 10.5,53.6 H10.5 V6 C9,6 8,4.8 6,4.8 C4,4.8 3,6 1.5,6 V45 H0 Z',
    ],
  ] as const)(
    'matches the approved %s Δ%s specimen',
    (kind, distance, path) => {
      const g = buildNeumeGeometry(
        kind,
        [
          staffPosition(0),
          staffPosition(kind === 'podatus' ? distance : -distance),
        ],
        0,
        0,
      );
      expect(g.ink[0]).toMatchObject({ kind: 'path', d: path });
      expect(g.notes.every((n) => n.head.kind === 'path')).toBe(true);
    },
  );

  it.each(['podatus', 'clivis'] as const)(
    'preserves %s bounds, advance, hit regions and lyric anchors',
    (kind) => {
      for (const distance of [1, 2, 3, 4, 5, 8]) {
        const g = buildNeumeGeometry(
          kind,
          [
            staffPosition(0),
            staffPosition(kind === 'podatus' ? distance : -distance),
          ],
          0,
          0,
        );
        const podatus = kind === 'podatus';
        const adjacent = distance === 1;
        const secondX = podatus ? 0 : adjacent ? 12 : 10.5;
        const secondY = distance * (podatus ? -12 : 12);
        const top = podatus ? (adjacent ? -20 : secondY - 6) : -6;
        const bottom = podatus
          ? 6
          : Math.max(
              distance <= 2 ? 27 : distance === 3 ? 39 : 45,
              secondY + 6,
            );
        const width = podatus ? 12 : secondX + 12;
        expect(g.bounds).toEqual({ x: 0, y: top, width, height: bottom - top });
        expect(g.advanceX).toBe(width + 33);
        expect(g.lyricAnchorX).toBe(podatus ? 6 : adjacent ? 12 : 11.25);
        expect(g.notes.map((n) => [n.anchorX, n.anchorY])).toEqual([
          [6, 0],
          [secondX + 6, secondY],
        ]);
        expect(g.notes.map((n) => n.hitBounds)).toEqual(
          podatus
            ? [
                {
                  x: -6,
                  y: adjacent ? -6 : -12,
                  width: 24,
                  height: adjacent ? 18 : 24,
                },
                {
                  x: -6,
                  y: adjacent ? -26 : secondY - 12,
                  width: 24,
                  height: adjacent ? 20 : 24,
                },
              ]
            : [
                {
                  x: -6,
                  y: -12,
                  width: adjacent ? 18 : 24,
                  height: adjacent ? 25.5 : 24,
                },
                {
                  x: adjacent ? 12 : secondX - 6,
                  y: secondY - 12,
                  width: adjacent ? 18 : 24,
                  height: 24,
                },
              ],
        );
        for (const n of g.notes) {
          if (n.head.kind !== 'path')
            throw new Error('Refined heads must use paths');
          expect(n.head.d).toContain('C');
        }
      }
    },
  );

  it('keeps the refined head overlays fitted to their exposed edges and attachments', () => {
    for (const distance of [1, 3]) {
      const pes = buildNeumeGeometry(
        'podatus',
        [staffPosition(0), staffPosition(distance)],
        0,
        0,
      );
      const flexa = buildNeumeGeometry(
        'clivis',
        [staffPosition(0), staffPosition(-distance)],
        0,
        0,
      );
      const [lower, upper] = pes.notes.map((n) => n.head);
      const [first, second] = flexa.notes.map((n) => n.head);
      if (
        lower.kind !== 'path' ||
        upper.kind !== 'path' ||
        first.kind !== 'path' ||
        second.kind !== 'path'
      )
        throw new Error('Expected refined head paths');
      expect(lower.d).toMatch(/^M0,-6 H12 V5.6 C/);
      expect(upper.d).toContain(
        distance === 1 ? 'H10.5 L9,-9 6,-10 0,-9 Z' : 'H10.5 Q9,-32 0,-32 Z',
      );
      expect(first.d).toContain('C9,6 8,4.8 6,4.8 C4,4.8 3,6 1.5,6 H0 Z');
      expect(first.d).toContain(distance === 1 ? 'V7.5 L10.5,6' : 'V6 H10.5');
      expect(second.d).toContain(
        distance === 1
          ? 'M12,6 H18 C21,6 24,6.6 24,8'
          : 'M10.5,30 H16.5 C19.5,30 22.5,30.6 22.5,32',
      );
    }
  });

  it('retains ten Podatus per system and the existing following-neume gap', () => {
    const neumes = Array.from({ length: 11 }, (_, i) =>
      twoNote('podatus', (i % 5) + 1, `pes-${i}`),
    );
    const layout = layoutChant(documentWith(neumes));
    expect(layout.systems.map((s) => s.neumes.length)).toEqual([10, 1]);
    const first = layout.systems[0].neumes;
    for (let i = 1; i < first.length; i++)
      expect(
        first[i].bounds.x - first[i - 1].bounds.x - first[i - 1].bounds.width,
      ).toBe(33);
    expect(first[9].bounds.x + first[9].bounds.width).toBe(641);
  });

  it('keeps musical anchors fixed when asymmetric ink bounds expand', () => {
    const g = buildNeumeGeometry(
      'clivis',
      [staffPosition(0), staffPosition(-2)],
      0,
      0,
    );
    const ink = [
      ...g.ink,
      {
        kind: 'rect' as const,
        radius: 0,
        bounds: { x: -10, y: 0, width: 10, height: 1 },
      },
    ];
    const expanded = { ...g, ink, bounds: getInkBounds(ink) };
    expect(expanded.bounds.x + expanded.bounds.width / 2).not.toBe(
      g.lyricAnchorX,
    );
    expect(getNeumeLyricAlignmentX(expanded)).toBe(11.25);
  });

  it('does not expand wide Pes hit targets into the empty interval gap', () => {
    const g = buildNeumeGeometry(
      'podatus',
      [staffPosition(0), staffPosition(8)],
      0,
      0,
    );
    expect(g.notes.map((n) => n.hitBounds.height)).toEqual([24, 24]);
    expect(g.notes[0].hitBounds.y).toBe(-12);
    expect(g.notes[1].hitBounds.y + g.notes[1].hitBounds.height).toBeLessThan(
      -12,
    );
  });

  it('translates all ink and nominal anchors with the system without changing metrics', () => {
    for (const kind of ['podatus', 'clivis'] as const) {
      const positions = [
        staffPosition(0),
        staffPosition(kind === 'podatus' ? 1 : -1),
      ];
      const a = buildNeumeGeometry(kind, positions, 0, 0);
      const b = buildNeumeGeometry(kind, positions, 17.5, 244);
      expect(b.bounds).toEqual({
        ...a.bounds,
        x: a.bounds.x + 17.5,
        y: a.bounds.y + 244,
      });
      expect(b.lyricAnchorX).toBe(a.lyricAnchorX + 17.5);
      expect(b.advanceX).toBe(a.advanceX);
      expect(b.notes.map((n) => [n.anchorX, n.anchorY])).toEqual(
        a.notes.map((n) => [n.anchorX + 17.5, n.anchorY + 244]),
      );
    }
  });

  it('reflows an interval change at an exact fit, preserving IDs and atomic history', () => {
    const compound: Neume = {
      id: 'compound',
      kind: 'torculus',
      notes: [
        { id: 'compound-0', staffPosition: staffPosition(0) },
        { id: 'compound-1', staffPosition: staffPosition(1) },
        { id: 'compound-2', staffPosition: staffPosition(-1) },
      ],
    };
    // These widths place the final wide Clivis exactly at x=656.
    const prefix = [
      ...Array.from({ length: 6 }, (_, i) =>
        twoNote('clivis', 1, `adjacent-${i}`),
      ),
      compound,
    ];
    const original = documentWith([...prefix, twoNote('clivis', 2, 'tail')]);
    const layout = layoutChant(original);
    const tail = layout.systems[0].neumes.at(-1);
    expect(layout.systems).toHaveLength(1);
    if (!tail) throw new Error('Missing tail neume');
    expect(tail.bounds.x + tail.bounds.width).toBe(656);
    const edited = applyDocumentEdit(createDocumentHistory(original), (doc) =>
      moveNoteVertically(doc, 'tail-first', -1),
    );
    expect(edited.past).toHaveLength(1);
    const after = layoutChant(edited.present);
    expect(after.systems).toHaveLength(2);
    expect(after.systems[1].neumes[0].notes.map((n) => n.noteId)).toEqual([
      'tail-first',
      'tail-second',
    ]);
    expect(layoutChant(undoDocumentEdit(edited).present)).toEqual(layout);
    expect(
      layoutChant(redoDocumentEdit(undoDocumentEdit(edited)).present),
    ).toEqual(after);
    expect(wrapNeumes(original.neumes)[0].neumes).toHaveLength(
      original.neumes.length,
    );
    const transposed = moveNeumeVertically(original, 'tail', 1);
    expect(layoutChant(transposed).systems[0].neumes.at(-1)?.bounds.width).toBe(
      tail?.bounds.width,
    );
    const normalized = layoutChant(deleteNote(original, 'tail-first'))
      .systems.flatMap((s) => s.neumes)
      .at(-1);
    expect(normalized).toMatchObject({
      neumeId: 'tail',
      kind: 'punctum',
      notes: [{ noteId: 'tail-second' }],
    });
    expect(normalized?.bounds.width).toBe(12);
  });
});
