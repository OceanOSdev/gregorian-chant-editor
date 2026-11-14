import { describe, expect, it } from 'vitest';
import {
  fourNotes,
  type Neume,
  staffPosition,
  type ChantDocument,
  type CompoundDirectionalKind,
  type NoteAppearance,
} from '../domain/chant-document';
import { blankDocument } from '../persistence/native-document';
import {
  buildNeumeGeometry,
  interNeumeInkGap,
  type NeumeGeometry,
} from './neume-geometry';
import { compactNeumeInkGap, layoutChant } from './layout-chant';
import type { MeasureLyricText } from './lyric-text-metrics';
import { normalizeNeumeAfterNoteDeletion } from '../domain/neume';
import { buildPunctum } from './neumes/punctum';
import { buildPorrectus } from './neumes/porrectus';
import { buildPodatusOrClivis } from './neumes/podatus-clivis';
import { buildClimacus } from './neumes/climacus';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { insertEditorNeume } from '../interaction/insert-editor-neume';

const kinds = [
  'torculus-resupinus',
  'porrectus-flexus',
  'scandicus-flexus',
  'climacus-resupinus',
] as const satisfies readonly CompoundDirectionalKind[];
const directions: Record<CompoundDirectionalKind, readonly number[]> = {
  'torculus-resupinus': [1, -1, 1],
  'porrectus-flexus': [-1, 1, -1],
  'scandicus-flexus': [1, 1, -1],
  'climacus-resupinus': [-1, -1, 1],
};
const representative: Record<CompoundDirectionalKind, number[][]> = {
  // Specimens from the reference record (C clef on line 4, d = 0).
  'torculus-resupinus': [
    [2, 3, 2, 3],
    [2, 4, 3, 4],
    [2, 6, 3, 4],
    [2, 3, 1, 4],
  ],
  'porrectus-flexus': [
    [4, 2, 3, 1],
    [6, 5, 6, 3],
    [4, 3, 4, 3],
    [5, 2, 4, 0],
  ],
  'scandicus-flexus': [
    [2, 3, 4, 2],
    [1, 3, 4, 3],
    [3, 4, 6, 4],
    [2, 3, 6, 2],
  ],
  'climacus-resupinus': [
    [4, 3, 2, 3],
    [6, 5, 3, 4],
    [4, 2, 1, 5],
    [5, 4, 3, 4],
  ],
};
/** Every contour with steps of ±1..maxStep and first pitch -2..6. */
function* contours(
  kind: CompoundDirectionalKind,
  maxStep = 4,
): Generator<number[]> {
  for (let first = -2; first <= 6; first++)
    for (let a = 1; a <= maxStep; a++)
      for (let b = 1; b <= maxStep; b++)
        for (let c = 1; c <= maxStep; c++) {
          const [d0, d1, d2] = directions[kind];
          const p1 = first + d0 * a;
          const p2 = p1 + d1 * b;
          yield [first, p1, p2, p2 + d2 * c];
        }
}
const build = (
  kind: CompoundDirectionalKind,
  pitches: readonly number[],
  modifiers: readonly NoteAppearance[] = [],
  x = 50,
) => buildNeumeGeometry(kind, pitches.map(staffPosition), x, 140, modifiers);
const bitCount = (mask: number) =>
  [0, 1, 2, 3].filter((i) => mask & (1 << i)).length;
const right = (b: { x: number; width: number }) => b.x + b.width;
const positions = (pitches: readonly number[]) => pitches.map(staffPosition);

describe('exhaustive bounded compound geometry', () => {
  it.each(kinds)(
    '%s draws four constituents for every contour and mark combination without exceptions',
    { timeout: 120_000 },
    (kind) => {
      let cases = 0;
      let mismatches = 0;
      for (const pitches of contours(kind, 3)) {
        const plainInk = build(kind, pitches).ink.length;
        for (const mora of [false, true])
          for (let h = 0; h < 16; h++)
            for (let v = 0; v < 16; v++) {
              const modifiers = pitches.map((_, i): NoteAppearance => ({
                ...(mora && i === 3 ? { mora: 1 } : {}),
                ...(h & (1 << i) ? { episema: true } : {}),
                ...(v & (1 << i) ? { verticalEpisema: true } : {}),
              }));
              // Throws on any omitted local placement.
              const geometry = build(kind, pitches, modifiers);
              cases++;
              const signs = (mora ? 1 : 0) + bitCount(h) + bitCount(v);
              // Count plain checks; one expect keeps the matrix fast.
              if (
                geometry.notes.length !== 4 ||
                geometry.notes.some(
                  (note, i) => note.anchorY !== 140 - pitches[i] * 12,
                ) ||
                geometry.ink.length !== plainInk + signs ||
                geometry.advanceX !== geometry.bounds.width + 33
              )
                mismatches++;
            }
      }
      expect(mismatches).toBe(0);
      expect(cases).toBe(9 * 27 * 2 * 256);
    },
  );

  it.each(kinds)(
    '%s anchors lyrics on the first head and gives each constituent its own pointer band',
    (kind) => {
      for (const pitches of contours(kind)) {
        const g = build(kind, pitches);
        expect(g.lyricAnchorX).toBe(g.notes[0].anchorX);
        expect(g.notes[0].anchorX).toBe(56);
        // Horizontal ownership: no rectangular target extends into a later
        // column owned by a different element.
        const [n0, n1, n2, n3] = g.notes;
        if (kind === 'torculus-resupinus')
          expect(right(n0.hitBounds)).toBeLessThanOrEqual(n1.hitBounds.x);
        if (kind === 'scandicus-flexus') {
          expect(right(n0.hitBounds)).toBeLessThanOrEqual(n2.hitBounds.x);
          expect(right(n1.hitBounds)).toBeLessThanOrEqual(n2.hitBounds.x);
        }
        if (kind === 'porrectus-flexus') {
          expect(right(n1.hitBounds)).toBeLessThanOrEqual(n3.hitBounds.x);
          expect(right(n2.hitBounds)).toBeLessThanOrEqual(n3.hitBounds.x);
        }
        if (kind === 'climacus-resupinus')
          expect(right(n2.hitBounds)).toBeLessThanOrEqual(n3.hitBounds.x);
      }
    },
  );
});

describe('approved Gate A profiles reuse the accepted recipes', () => {
  it('Torculus resupinus: leading Punctum joined at the foot of a derived Porrectus stem', () => {
    // Third note above, equal to and below the first.
    for (const pitches of [
      [2, 4, 3, 5],
      [2, 4, 2, 5],
      [2, 4, 0, 3],
      [2, 3, 2, 3],
      [0, 6, 1, 4],
    ]) {
      const g = build('torculus-resupinus', pitches);
      const punctum = buildPunctum(positions([pitches[0]]), 50, 140);
      expect(g.ink[0]).toEqual(punctum.ink[0]);
      const stroke = g.ink[1];
      // The stroke's left stem starts exactly at the Punctum's right edge.
      expect(stroke.bounds.x).toBe(right(punctum.bounds));
      // Stem extent is derived from the actual rise: it reaches the
      // Punctum's underside, never the ordinary fixed descending stem.
      const punctumBottom = g.notes[0].anchorY + 6;
      const rise = (pitches[1] - pitches[0]) * 12;
      const expected = buildPorrectus(
        positions(pitches.slice(1)),
        62,
        140,
        rise + 6,
      );
      expect(stroke).toEqual(expected.ink[0]);
      if (stroke.kind !== 'path') throw Error('stroke path');
      // The left stem closes exactly at the Punctum's underside...
      expect(stroke.d).toContain(`V${punctumBottom} H62 Z`);
      // ...while the ribbon may still pass below it when n2 <= n0.
      expect(stroke.bounds.y + stroke.bounds.height).toBe(
        Math.max(punctumBottom, g.notes[2].anchorY + 9),
      );
    }
    // Without the parameter the approved Porrectus is unchanged.
    expect(buildPorrectus(positions([4, 2, 3]), 50, 140)).toEqual(
      buildNeumeGeometry('porrectus', positions([4, 2, 3]), 50, 140),
    );
  });

  it('Porrectus flexus: unchanged Porrectus with a right-stemmed Clivis terminal', () => {
    for (const pitches of representative['porrectus-flexus']) {
      const g = build('porrectus-flexus', pitches);
      const porrectus = buildPorrectus(positions(pitches.slice(0, 3)), 50, 140);
      expect(g.ink[0]).toEqual(porrectus.ink[0]);
      g.notes.slice(0, 3).forEach((n, i) => {
        expect(n.head).toEqual(porrectus.notes[i].head);
        expect(n.anchorX).toBe(porrectus.notes[i].anchorX);
      });
      const terminalRight = right(porrectus.notes[2].head.bounds);
      const adjacent = pitches[2] - pitches[3] === 1;
      const join = g.ink[1];
      expect(join.bounds.x).toBe(terminalRight - 1.5);
      expect(join.bounds.y).toBe(g.notes[2].anchorY);
      expect(g.notes[3].head.bounds.x).toBe(
        terminalRight - (adjacent ? 0 : 1.5),
      );
      // The join reaches the fourth head.
      expect(join.bounds.y + join.bounds.height).toBeGreaterThanOrEqual(
        g.notes[3].head.bounds.y,
      );
    }
  });

  it('Scandicus flexus: the approved Podatus followed by the approved Clivis', () => {
    for (const pitches of representative['scandicus-flexus']) {
      const g = build('scandicus-flexus', pitches);
      const pes = buildPodatusOrClivis(
        'podatus',
        positions(pitches.slice(0, 2)),
        50,
        140,
      );
      const clivis = buildPodatusOrClivis(
        'clivis',
        positions(pitches.slice(2)),
        62,
        140,
      );
      expect(g.ink).toEqual([...pes.ink, ...clivis.ink]);
      expect(g.notes.map((n) => n.head)).toEqual(
        [...pes.notes, ...clivis.notes].map((n) => n.head),
      );
    }
  });

  it('Climacus resupinus: the unchanged three-note Climacus and a detached Punctum', () => {
    for (const pitches of representative['climacus-resupinus']) {
      const g = build('climacus-resupinus', pitches);
      const climacus = buildClimacus(positions(pitches.slice(0, 3)), 50, 140);
      expect(g.ink.slice(0, 3)).toEqual(climacus.ink);
      expect(g.notes.slice(0, 3)).toEqual(climacus.notes);
      const punctum = g.ink[3];
      // Detached: a clear gap after the last diamond, no connector.
      expect(g.ink).toHaveLength(4);
      expect(punctum.bounds.x - right(climacus.notes[2].head.bounds)).toBe(6);
      expect(punctum.bounds.width).toBe(12);
    }
  });

  it('places a final mora once, right of the final constituent', () => {
    for (const kind of kinds)
      for (const pitches of representative[kind]) {
        const plain = build(kind, pitches);
        const g = build(kind, pitches, [{}, {}, {}, { mora: 1 }]);
        const dot = g.ink.at(-1);
        expect(g.ink).toHaveLength(plain.ink.length + 1);
        expect(dot?.bounds.width).toBe(4);
        expect(dot?.bounds.x).toBeGreaterThanOrEqual(
          right(g.notes[3].head.bounds),
        );
        expect(g.notes[3].modifierBounds).toEqual(dot?.bounds);
      }
  });
});

describe.each(kinds)('%s in score layout', (kind) => {
  it('matches ghost and committed geometry, keeps groups whole across systems and anchors lyrics on the first note', () => {
    const pitches = representative[kind][1];
    const count = 26;
    const doc: ChantDocument = {
      ...blankDocument(),
      neumes: Array.from({ length: count }, (_, i) => {
        const notes = fourNotes(
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
    };
    const layout = layoutChant(doc);
    expect(layout.systems.length).toBeGreaterThan(1);
    for (const system of layout.systems) {
      for (const neume of system.neumes) {
        expect(neume.notes).toHaveLength(4);
        expect(neume.bounds.x + neume.bounds.width).toBeLessThanOrEqual(
          system.staffLines[0].x2,
        );
        const lyric = system.lyrics.find(
          (l) => l.syllableId === 's' + neume.neumeId.slice(1),
        );
        expect(lyric?.anchorX).toBe(neume.lyricAnchorX);
        expect(neume.lyricAnchorX).toBe(neume.notes[0].anchorX);
      }
      const placement = resolveGraphicalNeumePlacement(layout, kind, {
        x: 320,
        y: system.staffLines[2].y,
      });
      if (!placement) throw Error('placement');
      const inserted = insertEditorNeume(doc, placement, {
        neumeId: 'new',
        noteIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      });
      const committed = layoutChant(inserted)
        .systems.flatMap((s) => s.neumes)
        .find((n) => n.neumeId === 'new');
      if (!committed) throw Error('committed');
      const ghost: NeumeGeometry = placement.preview;
      expect(ghost.notes).toHaveLength(4);
      expect(ghost.bounds.width).toBe(committed.bounds.width);
      expect(ghost.bounds.height).toBe(committed.bounds.height);
      const dx = committed.bounds.x - ghost.bounds.x;
      const dy = committed.bounds.y - ghost.bounds.y;
      ghost.notes.forEach((n, i) => {
        expect(n.anchorX + dx).toBeCloseTo(committed.notes[i].anchorX, 9);
        expect(n.anchorY + dy).toBeCloseTo(committed.notes[i].anchorY, 9);
      });
    }
  });
});

describe('left vertical-episema fallback in score layout (owner review of PR #80)', () => {
  // [0,1,2,1] with every horizontal episema and a vertical one on the Pes's
  // upper note: no ordinary candidate fits, so the tick sits left of the ink.
  const pitches = [0, 1, 2, 1];
  const fallback: NoteAppearance[] = [
    { episema: true },
    { episema: true, verticalEpisema: true },
    { episema: true },
    { episema: true },
  ];
  const plain: NoteAppearance[] = pitches.map(() => ({ episema: true }));
  const tick = (g: NeumeGeometry) =>
    g.ink.filter((s) => s.kind === 'rect' && s.bounds.width === 1.5);
  const measure =
    (unit: number): MeasureLyricText =>
    (text) => ({
      width: text.length * unit,
      boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * unit),
    });
  const score = (
    marks: readonly NoteAppearance[],
    previousText: string,
    boundaryBefore: 'word' | 'continuation',
  ): ChantDocument => {
    const notes = fourNotes(
      pitches.map((p, i) => ({
        id: `sf${i}`,
        staffPosition: staffPosition(p),
        ...marks[i],
      })),
    );
    if (!notes) throw Error('tuple');
    return {
      ...blankDocument(),
      neumes: [
        {
          id: 'p',
          kind: 'punctum',
          notes: [{ id: 'p0', staffPosition: staffPosition(3) }],
        },
        { id: 'sf', kind: 'scandicus-flexus', notes },
      ],
      syllables: [
        {
          id: 's1',
          text: previousText,
          boundaryBefore: 'word',
          startsAtNeumeId: 'p',
        },
        { id: 's2', text: 'b', boundaryBefore, startsAtNeumeId: 'sf' },
      ],
    };
  };
  const pair = (doc: ChantDocument, unit: number) => {
    const [previous, current] = layoutChant(doc, measure(unit)).systems[0]
      .neumes;
    return { previous, current };
  };

  it('keeps every sign right of the requested origin, as for prefix accidentals', () => {
    const g = build('scandicus-flexus', pitches, fallback, 100);
    // The fallback tick is genuinely left of the note heads...
    expect(tick(g)[0].bounds.x).toBeLessThan(g.notes[0].head.bounds.x);
    // ...but the group's left ink edge is the origin.
    expect(g.bounds.x).toBe(100);
    expect(tick(g)[0].bounds.x).toBe(100);
    // With a prefix accidental as well, neither overhangs or collides.
    const signed = buildNeumeGeometry(
      'scandicus-flexus',
      positions(pitches),
      100,
      140,
      fallback,
      [{ kind: 'flat', staffPosition: 1, noteIndex: null }],
    );
    expect(signed.bounds.x).toBe(100);
    const flat = signed.accidentals?.[0]?.ink.bounds;
    if (!flat) throw Error('accidental');
    for (const t of tick(signed))
      expect(
        t.bounds.x >= flat.x + flat.width ||
          t.bounds.y + t.bounds.height <= flat.y,
      ).toBe(true);
  });

  it('keeps the compact same-word ink gap to the previous neume', () => {
    const { previous, current } = pair(score(fallback, 'a', 'continuation'), 2);
    const gap = current.bounds.x - (previous.bounds.x + previous.bounds.width);
    expect(gap).toBe(compactNeumeInkGap);
    expect(
      Math.min(...tick(current).map((t) => t.bounds.x)),
    ).toBeGreaterThanOrEqual(
      previous.bounds.x + previous.bounds.width + compactNeumeInkGap,
    );
  });

  it('keeps the ordinary inter-neume ink gap', () => {
    const { previous, current } = pair(score(fallback, 'a', 'word'), 2);
    expect(current.bounds.x - (previous.bounds.x + previous.bounds.width)).toBe(
      interNeumeInkGap,
    );
  });

  it('applies lyric reflow shifts exactly as for the same figure without the tick', () => {
    for (const [text, boundary, unit] of [
      ['A', 'continuation', 10],
      ['Glooooooooria', 'continuation', 10],
      ['Glooooooooria', 'word', 10],
    ] as const) {
      const marked = pair(score(fallback, text, boundary), unit).current;
      const unmarked = pair(score(plain, text, boundary), unit).current;
      // Lyric-driven placement is decided by the anchor; the overhang must
      // not move the music or its lyric left of the computed shift.
      expect(marked.lyricAnchorX).toBe(unmarked.lyricAnchorX);
      expect(marked.notes.map((n) => n.anchorX)).toEqual(
        unmarked.notes.map((n) => n.anchorX),
      );
    }
  });

  it('keeps first-system placement at the ordinary group origin', () => {
    const first = (marks: readonly NoteAppearance[]) =>
      layoutChant({
        ...score(marks, 'a', 'word'),
        neumes: score(marks, 'a', 'word').neumes.slice(1),
        syllables: [],
      }).systems[0].neumes[0];
    expect(first(fallback).bounds.x).toBe(first(plain).bounds.x);
  });
});

describe('compound deletion never reaches the pre-existing sign exceptions', () => {
  // The 72 pre-existing exceptions (identical on master) are all five-note
  // Scandicus staircases; compound deletion yields only three-note kinds.
  it.each(kinds)('%s survivors render with every surviving mark', (kind) => {
    let normalized = 0;
    for (const pitches of contours(kind, 3))
      for (let v = 0; v < 16; v++) {
        const neume = {
          id: 'g',
          kind,
          notes: pitches.map((p, i) => ({
            id: `n${i}`,
            staffPosition: staffPosition(p),
            episema: true,
            ...(v & (1 << i) ? { verticalEpisema: true } : {}),
            ...(i === 3 ? { mora: 1 } : {}),
          })),
        } as Neume;
        for (let index = 0; index < 4; index++) {
          const result = normalizeNeumeAfterNoteDeletion(neume, `n${index}`);
          if (!result || result === neume) continue;
          normalized++;
          expect(result.notes).toHaveLength(3);
          expect(() =>
            buildNeumeGeometry(
              result.kind,
              result.notes.map((n) => n.staffPosition),
              50,
              140,
              result.notes,
            ),
          ).not.toThrow();
        }
      }
    expect(normalized).toBeGreaterThan(0);
  });
});
