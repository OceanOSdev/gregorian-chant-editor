import { describe, expect, it } from 'vitest';
import {
  pesSubpunctisNotes,
  staffPosition,
  type ChantDocument,
  type NoteModifiers,
} from '../domain/chant-document';
import { blankDocument } from '../persistence/native-document';
import { buildNeumeGeometry, type InkShape } from './neume-geometry';
import { layoutChant } from './layout-chant';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { insertEditorNeume } from '../interaction/insert-editor-neume';

const contours = [
  [2, 4, 3, 2],
  [2, 3, 2, 1],
  [1, 4, 3, 1],
  [0, 3, 2, 0],
  [2, 6, 3, -1],
  [2, 5, 4, 3, 2],
  [2, 4, 3, 2, 1],
  [3, 6, 5, 4, 3],
  [-2, 1, 0, -1, -3],
  [5, 9, 8, 6, 3],
  // Kyrie XI (Orbis factor), Liber Usualis p. 46: jkJH'G and fgFD'C in c4.
  [6, 7, 6, 4, 3],
  [2, 3, 2, 0, -1],
];
const positions = (pitches: readonly number[]) => pitches.map(staffPosition);

function contains(
  shape: InkShape | undefined,
  rect: InkShape['bounds'],
  x: number,
  y: number,
) {
  if (shape?.kind === 'path') {
    // Hit polygons are straight-edged "M.. L.. Z" paths.
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

describe('pes subpunctis measured geometry', () => {
  it.each(contours)(
    '%j reuses the approved Podatus and Climacus diamonds without new connectors',
    (...pitches) => {
      const g = buildNeumeGeometry(
        'pes-subpunctis',
        positions(pitches),
        100,
        140,
      );
      const pes = buildNeumeGeometry(
        'podatus',
        positions(pitches.slice(0, 2)),
        100,
        140,
      );
      expect(g.notes).toHaveLength(pitches.length);
      // One Podatus body plus one detached diamond per tail note: no apex
      // virga stem, duplicate apex or connector to the diamonds.
      expect(g.ink).toHaveLength(1 + pitches.length - 2);
      expect(g.ink[0]).toEqual(pes.ink[0]);
      g.notes.slice(0, 2).forEach((note, i) => {
        expect(note.head).toEqual(pes.notes[i].head);
        expect(note.anchorX).toBe(pes.notes[i].anchorX);
        expect(note.anchorY).toBe(pes.notes[i].anchorY);
      });
      expect(g.lyricAnchorX).toBe(pes.lyricAnchorX);
      // The first two tail diamonds match Climacus diamonds hung from the apex.
      const climacus = buildNeumeGeometry(
        'climacus',
        positions(pitches.slice(1, 4)),
        100,
        140,
      );
      g.notes.slice(2, 4).forEach((note, i) => {
        expect(note.head.bounds).toEqual(climacus.notes[i + 1].head.bounds);
        expect(note.anchorX).toBe(climacus.notes[i + 1].anchorX);
        expect(note.anchorY).toBe(climacus.notes[i + 1].anchorY);
      });
      // Diamonds advance right and down; the first starts clear of the column.
      const tail = g.notes.slice(2);
      expect(tail[0].head.bounds.x).toBeGreaterThan(100 + 12);
      tail.forEach((note, i) => {
        expect(note.anchorY).toBe(140 - pitches[i + 2] * 12);
        if (i) expect(note.anchorX).toBeGreaterThan(tail[i - 1].anchorX);
      });
      expect(g.advanceX).toBe(g.bounds.width + 33);
    },
  );

  it.each(contours)(
    '%j gives every note its own nonoverlapping pointer region containing its head',
    (...pitches) => {
      const g = buildNeumeGeometry(
        'pes-subpunctis',
        positions(pitches),
        100,
        140,
      );
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

  it('places every horizontal/vertical episema combination within measured bounds', () => {
    for (const pitches of [
      contours[0],
      contours[5],
      contours[10],
      contours[11],
    ]) {
      const count = pitches.length;
      for (let mask = 0; mask < 2 ** (count * 2); mask += count === 5 ? 7 : 1) {
        const marks = pitches.map((_, i): NoteModifiers => ({
          ...(mask & (1 << i) ? { episema: true } : {}),
          ...(mask & (1 << (i + count)) ? { verticalEpisema: true } : {}),
        }));
        const g = buildNeumeGeometry(
          'pes-subpunctis',
          positions(pitches),
          100,
          140,
          marks,
        );
        const signs = marks.reduce(
          (sum, m) => sum + Number(!!m.episema) + Number(!!m.verticalEpisema),
          0,
        );
        expect(g.ink).toHaveLength(1 + count - 2 + signs);
        g.notes.forEach((note, i) =>
          expect(Boolean(note.modifierBounds)).toBe(
            Boolean(marks[i].episema || marks[i].verticalEpisema),
          ),
        );
        for (const ink of g.ink) {
          expect(ink.bounds.x).toBeGreaterThanOrEqual(g.bounds.x);
          expect(ink.bounds.x + ink.bounds.width).toBeLessThanOrEqual(
            g.bounds.x + g.bounds.width,
          );
        }
      }
    }
  });

  it('derives a final-note mora position for the pending owner review without enabling it', () => {
    // Evidence for the mora gate only: commands and decoding still reject it.
    for (const pitches of [contours[0], contours[5], contours[11]]) {
      const marks = pitches.map((_, i): NoteModifiers =>
        i === pitches.length - 1 ? { mora: 1 } : {},
      );
      const g = buildNeumeGeometry(
        'pes-subpunctis',
        positions(pitches),
        100,
        140,
        marks,
      );
      const last = g.notes[pitches.length - 1];
      expect(last.modifierBounds).toBeDefined();
      expect(last.modifierBounds?.x).toBeGreaterThan(last.x + last.width - 4);
    }
  });

  it('matches ghost and committed geometry, keeps groups whole across systems and anchors lyrics on the first note', () => {
    const many = (count: number): ChantDocument => ({
      ...blankDocument(),
      neumes: Array.from({ length: count }, (_, i) => {
        const notes = pesSubpunctisNotes(
          [2, 5, 4, 3, 2].map((p, j) => ({
            id: `g${i}-${j}`,
            staffPosition: staffPosition(p),
          })),
        );
        if (!notes) throw Error('tuple');
        return { id: `g${i}`, kind: 'pes-subpunctis', notes };
      }),
      syllables: Array.from({ length: count }, (_, i) => ({
        id: `s${i}`,
        text: 'ste',
        boundaryBefore: 'word' as const,
        startsAtNeumeId: `g${i}`,
      })),
    });
    const doc = many(24);
    const layout = layoutChant(doc);
    expect(layout.systems.length).toBeGreaterThan(1);
    for (const system of layout.systems) {
      for (const neume of system.neumes) {
        expect(neume.notes).toHaveLength(5);
        expect(neume.bounds.x + neume.bounds.width).toBeLessThanOrEqual(
          system.staffLines[0].x2,
        );
        const lyric = system.lyrics.find(
          (l) => l.syllableId === 's' + neume.neumeId.slice(1),
        );
        expect(lyric?.anchorX).toBe(neume.lyricAnchorX);
        expect(neume.lyricAnchorX).toBe(neume.notes[0].anchorX);
      }
      for (const kind of ['pes-subbipunctis', 'pes-subtripunctis'] as const) {
        const point = { x: 320, y: system.staffLines[2].y };
        const placement = resolveGraphicalNeumePlacement(layout, kind, point);
        if (!placement) throw Error('placement');
        const inserted = insertEditorNeume(doc, placement, {
          neumeId: 'new',
          noteIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
        });
        const committed = layoutChant(inserted)
          .systems.flatMap((s) => s.neumes)
          .find((n) => n.neumeId === 'new');
        if (!committed) throw Error('committed');
        const ghost = placement.preview;
        expect(
          inserted.neumes
            .find((n) => n.id === 'new')
            ?.notes.map((n) => n.staffPosition),
        ).toEqual(placement.staffPositions);
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
});
