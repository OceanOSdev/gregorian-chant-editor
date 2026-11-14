import { describe, expect, it } from 'vitest';
import {
  monotonicNotes,
  staffPosition,
  type ChantDocument,
  type NoteModifiers,
} from '../domain/chant-document';
import { blankDocument } from '../persistence/native-document';
import { buildNeumeGeometry, type InkShape } from './neume-geometry';
import { layoutChant } from './layout-chant';
import { extendedScandicusElements } from './neumes/scandicus-extended';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { insertEditorNeume } from '../interaction/insert-editor-neume';

const positions = (pitches: readonly number[]) => pitches.map(staffPosition);

/** Strictly monotonic contours from a first pitch and successive intervals. */
function contour(
  kind: 'scandicus' | 'climacus',
  first: number,
  intervals: readonly number[],
): number[] {
  const sign = kind === 'scandicus' ? 1 : -1;
  return intervals.reduce(
    (pitches, interval) => [
      ...pitches,
      (pitches.at(-1) ?? first) + sign * interval,
    ],
    [first],
  );
}
function* intervalSets(length: number, max = 3): Generator<number[]> {
  if (length === 0) {
    yield [];
    return;
  }
  for (const rest of intervalSets(length - 1, max))
    for (let i = 1; i <= max; i++) yield [...rest, i];
}

function contains(
  shape: InkShape | undefined,
  rect: InkShape['bounds'],
  x: number,
  y: number,
) {
  // Straight-edged "M.. L.. Z" hit polygons; the Climacus virga's H/V path is
  // exactly its rectangular hit bounds.
  if (shape?.kind === 'path' && !/[HV]/.test(shape.d)) {
    const points = [...shape.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }
  return (
    x > rect.x &&
    x < rect.x + rect.width &&
    y > rect.y &&
    y < rect.y + rect.height
  );
}

// Representative contours: adjacent, skipped and mixed intervals, line and
// space starts, ledger extremes, and Mocquereau Fig. 34's printed contours.
const representative = {
  scandicus: [
    [2, 3, 4, 5],
    [1, 2, 3, 4],
    [2, 3, 4, 6], // Mocquereau Fig. 34, first figure: +1 +1 +2
    [0, 2, 4, 6],
    [-3, -1, 0, 3],
    [2, 3, 4, 5, 6],
    [1, 2, 3, 4, 6], // Mocquereau Fig. 34, second figure: +1 +1 +1 +2
    [-2, 0, 1, 4, 5],
    [-2, -1, 0, 2, 3],
    [1, 3, 4, 6, 9],
    [4, 5, 7, 8, 10],
  ],
  climacus: [
    [5, 4, 3, 2],
    [6, 5, 4, 3], // Demetria p. 40, "La-sol-fa-mi"
    [6, 4, 3, 1],
    [8, 5, 3, 0],
    [6, 5, 4, 3, 2],
    [5, 4, 3, 2, 0],
    [7, 4, 3, 1, -2],
    [3, 2, 1, -1, -3],
  ],
} as const;

describe('extended Scandicus staircase (Mocquereau Fig. 34)', () => {
  it('groups four notes as Pes + Pes and five as Pes + Punctum + Pes', () => {
    expect(extendedScandicusElements(4)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(extendedScandicusElements(5)).toEqual([[0, 1], [2], [3, 4]]);
    for (const count of [0, 1, 2, 3, 6])
      expect(() => extendedScandicusElements(count)).toThrow();
  });

  it('reuses the approved Podatus and Punctum ink in successive columns without connectors', () => {
    let checked = 0;
    for (const count of [4, 5])
      for (let first = -3; first <= 7; first++)
        for (const intervals of intervalSets(count - 1)) {
          const pitches = contour('scandicus', first, intervals);
          const g = buildNeumeGeometry(
            'scandicus',
            positions(pitches),
            100,
            140,
          );
          const elements = extendedScandicusElements(count);
          expect(g.notes).toHaveLength(count);
          expect(g.ink).toHaveLength(elements.length);
          elements.forEach((indexes, column) => {
            const element = buildNeumeGeometry(
              indexes.length === 2 ? 'podatus' : 'punctum',
              positions(indexes.map((i) => pitches[i])),
              100 + column * 12,
              140,
            );
            expect(g.ink[column]).toEqual(element.ink[0]);
            indexes.forEach((noteIndex, i) => {
              const note = g.notes[noteIndex];
              expect(note.head).toEqual(element.notes[i].head);
              expect(note.anchorX).toBe(element.notes[i].anchorX);
              expect(note.anchorY).toBe(140 - pitches[noteIndex] * 12);
            });
          });
          // One lyric anchor at the first note; advance follows the ink.
          expect(g.lyricAnchorX).toBe(g.notes[0].anchorX);
          expect(g.advanceX).toBe(g.bounds.width + 33);
          checked++;
        }
    expect(checked).toBe(11 * (3 ** 3 + 3 ** 4));
  });
});

describe('extended Climacus', () => {
  it('extends the approved virga and diamond tail to every later note', () => {
    let checked = 0;
    for (const count of [4, 5])
      for (let first = -1; first <= 10; first++)
        for (const intervals of intervalSets(count - 1)) {
          const pitches = contour('climacus', first, intervals);
          const g = buildNeumeGeometry(
            'climacus',
            positions(pitches),
            100,
            140,
          );
          const three = buildNeumeGeometry(
            'climacus',
            positions(pitches.slice(0, 3)),
            100,
            140,
          );
          // One virga plus one detached diamond per later note; the first two
          // diamonds and the virga are exactly the three-note geometry.
          expect(g.notes).toHaveLength(count);
          expect(g.ink).toHaveLength(count);
          expect(g.ink.slice(0, 3)).toEqual(three.ink);
          g.notes.slice(0, 3).forEach((note, i) => {
            expect(note.head).toEqual(three.notes[i].head);
            expect(note.anchorX).toBe(three.notes[i].anchorX);
          });
          g.notes.forEach((note, i) => {
            expect(note.anchorY).toBe(140 - pitches[i] * 12);
            if (i) expect(note.anchorX).toBeGreaterThan(g.notes[i - 1].anchorX);
          });
          expect(g.lyricAnchorX).toBe(three.lyricAnchorX);
          checked++;
        }
    expect(checked).toBe(12 * (3 ** 3 + 3 ** 4));
  });
});

describe.each(['scandicus', 'climacus'] as const)(
  'extended %s pointer ownership and signs',
  (kind) => {
    it.each(representative[kind].map((p) => [p]))(
      '%j gives every note its own nonoverlapping pointer region containing its head',
      (pitches) => {
        const g = buildNeumeGeometry(kind, positions(pitches), 100, 140);
        const owners = (x: number, y: number) =>
          g.notes.filter((n) => contains(n.hitShape, n.hitBounds, x, y)).length;
        g.notes.forEach((note) =>
          expect(
            contains(note.hitShape, note.hitBounds, note.anchorX, note.anchorY),
          ).toBe(true),
        );
        for (
          let x = g.bounds.x - 8;
          x <= g.bounds.x + g.bounds.width + 8;
          x += 0.75
        )
          for (
            let y = g.bounds.y - 18;
            y <= g.bounds.y + g.bounds.height + 18;
            y += 0.75
          )
            expect(owners(x, y)).toBeLessThanOrEqual(1);
      },
    );

    it.each(representative[kind].map((p) => [p]))(
      '%j renders and owns every horizontal x vertical episema mask with and without the approved final mora',
      (pitches) => {
        const count = pitches.length;
        const plain = buildNeumeGeometry(kind, positions(pitches), 100, 140);
        const isHorizontal = (s: InkShape) =>
          s.kind === 'rect' && s.bounds.width === 12 && s.bounds.height === 2;
        const isVertical = (s: InkShape) =>
          s.kind === 'rect' && s.rasterization === 'vertical-episema';
        const inside = (
          a: InkShape['bounds'],
          b: InkShape['bounds'] | undefined,
        ) =>
          !!b &&
          a.x >= b.x - 1e-9 &&
          a.y >= b.y - 1e-9 &&
          a.x + a.width <= b.x + b.width + 1e-9 &&
          a.y + a.height <= b.y + b.height + 1e-9;
        const overlaps = (a: InkShape['bounds'], b: InkShape['bounds']) =>
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        let checked = 0;
        const isDot = (s: InkShape) =>
          s.kind === 'rect' && s.bounds.width === 4 && s.bounds.height === 4;
        const last = count - 1;
        // Owner-approved matrix for longer groups (ADR 0024): none or final.
        for (let mask = 0; mask < 2 ** (count * 2); mask++)
          for (const mora of [false, true]) {
            const marks = pitches.map((_, i): NoteModifiers => ({
              ...(mask & (1 << i) ? { episema: true } : {}),
              ...(mask & (1 << (i + count)) ? { verticalEpisema: true } : {}),
              ...(mora && i === last ? { mora: 1 } : {}),
            }));
            const g = buildNeumeGeometry(
              kind,
              positions(pitches),
              100,
              140,
              marks,
            );
            const shiftedPlain = buildNeumeGeometry(
              kind,
              positions(pitches),
              100 + g.notes[0].anchorX - plain.notes[0].anchorX,
              140,
            );
            expect(g.bounds.x).toBe(100);
            expect(g.ink.slice(0, plain.ink.length)).toEqual(shiftedPlain.ink);
            const signs = g.ink.slice(plain.ink.length);
            const horizontal = marks.filter((m) => m.episema).length;
            const vertical = marks.filter((m) => m.verticalEpisema).length;
            expect(signs).toHaveLength(horizontal + vertical + Number(mora));
            expect(signs.filter(isHorizontal)).toHaveLength(horizontal);
            expect(signs.filter(isVertical)).toHaveLength(vertical);
            expect(signs.filter(isDot)).toHaveLength(Number(mora));
            // Signs never cover notation heads or each other.
            for (const sign of signs) {
              for (const note of g.notes)
                expect(overlaps(sign.bounds, note.head.bounds)).toBe(false);
              for (const other of signs)
                if (other !== sign)
                  expect(overlaps(sign.bounds, other.bounds)).toBe(false);
            }
            g.notes.forEach((note, i) => {
              const m = marks[i];
              expect(note.head).toEqual(shiftedPlain.notes[i].head);
              expect(Boolean(note.modifierBounds)).toBe(
                Boolean(m.episema || m.verticalEpisema || m.mora),
              );
              if (m.mora) {
                // Trailing dot right of the final head, in or beside its row.
                const dot = signs.find(isDot);
                expect(dot).toBeDefined();
                if (!dot) return;
                expect(inside(dot.bounds, note.modifierBounds)).toBe(true);
                expect(dot.bounds.x).toBeGreaterThanOrEqual(
                  note.x + note.width - 4,
                );
                expect(
                  Math.abs(dot.bounds.y + 2 - note.anchorY),
                ).toBeLessThanOrEqual(12);
              }
              if (m.episema)
                expect(
                  signs.some(
                    (s) =>
                      isHorizontal(s) &&
                      s.bounds.x === note.anchorX - 6 &&
                      inside(s.bounds, note.modifierBounds),
                  ),
                ).toBe(true);
              if (m.verticalEpisema)
                expect(
                  signs.some(
                    (s) =>
                      isVertical(s) &&
                      Math.abs(s.bounds.x + 0.75 - note.anchorX) <= 15 &&
                      inside(s.bounds, note.modifierBounds),
                  ),
                ).toBe(true);
            });
            for (const ink of g.ink) {
              expect(ink.bounds.x).toBeGreaterThanOrEqual(g.bounds.x);
              expect(ink.bounds.y).toBeGreaterThanOrEqual(g.bounds.y);
              expect(ink.bounds.x + ink.bounds.width).toBeLessThanOrEqual(
                g.bounds.x + g.bounds.width,
              );
              expect(ink.bounds.y + ink.bounds.height).toBeLessThanOrEqual(
                g.bounds.y + g.bounds.height,
              );
            }
            expect(g.advanceX).toBe(g.bounds.width + 33);
            checked++;
          }
        expect(checked).toBe(2 ** (count * 2) * 2);
      },
    );

    it('rejects an authored quilisma on a longer group instead of drawing three notes', () => {
      for (const pitches of representative[kind])
        for (let index = 0; index < pitches.length; index++)
          expect(() =>
            buildNeumeGeometry(
              kind,
              positions(pitches),
              100,
              140,
              pitches.map((_, i) => (i === index ? { form: 'quilisma' } : {})),
            ),
          ).toThrow(/form/);
    });

    it('matches ghost and committed geometry, keeps groups whole across systems and anchors lyrics on the first note', () => {
      const pitches = representative[kind].at(-1) ?? [];
      const many = (count: number): ChantDocument => ({
        ...blankDocument(),
        neumes: Array.from({ length: count }, (_, i) => {
          const notes = monotonicNotes(
            pitches.map((p, j) => ({
              id: `g${i}-${j}`,
              staffPosition: staffPosition(p),
            })),
          );
          if (!notes) throw Error('tuple');
          return { id: `g${i}`, kind, notes };
        }),
        syllables: Array.from({ length: count }, (_, i) => ({
          id: `s${i}`,
          text: 'ste',
          boundaryBefore: 'word' as const,
          startsAtNeumeId: `g${i}`,
        })),
      });
      const doc = many(28);
      const layout = layoutChant(doc);
      expect(layout.systems.length).toBeGreaterThan(1);
      for (const system of layout.systems) {
        for (const neume of system.neumes) {
          expect(neume.notes).toHaveLength(pitches.length);
          expect(neume.bounds.x + neume.bounds.width).toBeLessThanOrEqual(
            system.staffLines[0].x2,
          );
          const lyric = system.lyrics.find(
            (l) => l.syllableId === 's' + neume.neumeId.slice(1),
          );
          expect(lyric?.anchorX).toBe(neume.lyricAnchorX);
          expect(neume.lyricAnchorX).toBe(neume.notes[0].anchorX);
        }
        for (const entry of [`${kind}-4`, `${kind}-5`] as const) {
          const point = { x: 320, y: system.staffLines[2].y };
          const placement = resolveGraphicalNeumePlacement(
            layout,
            entry,
            point,
          );
          if (!placement) throw Error('placement');
          const inserted = insertEditorNeume(doc, placement, {
            neumeId: 'new',
            noteIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
          });
          const committed = layoutChant(inserted)
            .systems.flatMap((s) => s.neumes)
            .find((n) => n.neumeId === 'new');
          if (!committed) throw Error('committed');
          const added = inserted.neumes.find((n) => n.id === 'new');
          expect(added?.kind).toBe(kind);
          expect(added?.notes.map((n) => n.staffPosition)).toEqual(
            placement.staffPositions,
          );
          const ghost = placement.preview;
          expect(ghost.notes).toHaveLength(committed.notes.length);
          expect(ghost.bounds.width).toBe(committed.bounds.width);
          expect(ghost.bounds.height).toBe(committed.bounds.height);
          const dx = committed.bounds.x - ghost.bounds.x;
          const dy = committed.bounds.y - ghost.bounds.y;
          ghost.notes.forEach((n, i) => {
            expect(n.anchorX + dx).toBeCloseTo(committed.notes[i].anchorX, 9);
            expect(n.anchorY + dy).toBeCloseTo(committed.notes[i].anchorY, 9);
          });
        }
      }
    });
  },
);
