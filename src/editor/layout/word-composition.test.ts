import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import { buildNeumeGeometry } from './neume-geometry';
import { layoutChant, compactNeumeInkGap, staffEndX } from './layout-chant';
import type { MeasureLyricText } from './lyric-text-metrics';
const measure: MeasureLyricText = (text) => ({
  width: text.length * 10,
  boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 10),
});
function fixture(anchors = [0, 3, 4, 5, 6], count = 8): ChantDocument {
  return {
    title: 'Alleluia',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: staffPosition(2) }],
    })),
    syllables: ['Al', 'le', 'lu', 'ia', 'ah']
      .slice(0, anchors.length)
      .map((text, i) => ({
        id: `s${i}`,
        text,
        startsAtNeumeId: `n${anchors[i]}`,
        boundaryBefore: i === 0 || i === 4 ? 'word' : 'continuation',
      })),
  };
}
describe('word-aware composition', () => {
  it('joins eligible syllables and marks musical separation, preserving word gaps and melismas', () => {
    const d = fixture();
    const snapshot = JSON.stringify(d);
    const l = layoutChant(d, measure);
    const s = l.systems[0];
    expect(s.hyphens).toHaveLength(1);
    expect(s.hyphens?.[0].outgoing).toBe(false);
    expect(
      s.neumes[1].bounds.x - s.neumes[0].bounds.x - s.neumes[0].bounds.width,
    ).toBe(33);
    expect(
      s.neumes[4].bounds.x - s.neumes[3].bounds.x - s.neumes[3].bounds.width,
    ).toBeLessThan(33);
    expect(
      Number(s.lyrics[4].left) - Number(s.lyrics[3].right),
    ).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(d)).toBe(snapshot);
  });
  it('uses actual edges rather than melisma count and leaves lyricless scores identical', () => {
    const d = fixture([0, 2]);
    const wide: MeasureLyricText = (t) =>
      t === 'Al' ? { width: 100, boundaries: [0, 50, 100] } : measure(t);
    expect(layoutChant(d, wide).systems[0].hyphens).toHaveLength(0);
    const music = { ...d, syllables: [] };
    expect(layoutChant(music, measure)).toEqual(layoutChant(music));
  });
  it('falls back for missing, partial and invalid punctuation metrics', () => {
    const d = fixture();
    for (const m of [
      undefined,
      (t: string) => (t === '-' ? null : measure(t)),
      (t: string) => (t === 'lu' ? null : measure(t)),
      (t: string) =>
        t === '-' ? { width: NaN, boundaries: [0, NaN] } : measure(t),
    ]) {
      const l = layoutChant(d, m);
      expect(l.systems.flatMap((s) => s.neumes)).toEqual(
        layoutChant(d).systems.flatMap((s) => s.neumes),
      );
      expect(l.systems.flatMap((s) => s.hyphens ?? [])).toHaveLength(0);
    }
  });
  it('reserves outgoing marks, never incoming marks or melisma-only breaks', () => {
    const d = fixture([0, 11], 16);
    const l = layoutChant(d, measure);
    expect(l.systems[0].hyphens).toHaveLength(1);
    expect(l.systems[0].hyphens?.[0].outgoing).toBe(true);
    expect(Number(l.systems[0].hyphens?.[0].x) + 5).toBeLessThanOrEqual(
      staffEndX,
    );
    expect(l.systems.slice(1).flatMap((s) => s.hyphens ?? [])).toHaveLength(0);
    for (const doc of [
      { ...d, syllables: d.syllables.slice(0, 1) },
      {
        ...d,
        syllables: d.syllables.map((s) => ({
          ...s,
          boundaryBefore: 'word' as const,
        })),
      },
    ])
      expect(
        layoutChant(doc, measure).systems.flatMap((s) => s.hyphens ?? []),
      ).toHaveLength(0);
    expect(layoutChant(d, measure)).toEqual(l);
  });
  it('terminates on oversized text and exposes its outgoing mark', () => {
    const d = fixture([0, 1]);
    d.syllables[0] = { ...d.syllables[0], text: 'a'.repeat(500) };
    const l = layoutChant(d, measure);
    expect(l.systems[0].neumes).toHaveLength(1);
    expect(l.width).toBeGreaterThan(720);
    const h = l.systems[0].hyphens?.[0];
    expect(h?.outgoing).toBe(true);
    expect(Number(h?.x) + 5).toBeLessThan(l.x + l.width);
  });
  it('keeps outgoing reservation stable across break positions and font metrics', () => {
    for (const next of [1, 7, 9, 10, 11, 19, 23]) {
      for (const unit of [6, 10, 20]) {
        const d = fixture([0, next], next + 2);
        const font: MeasureLyricText = (text) => ({
          width: text.length * unit,
          boundaries: Array.from(
            { length: text.length + 1 },
            (_, i) => i * unit,
          ),
        });
        const l = layoutChant(d, font);
        expect(l).toEqual(layoutChant(d, font));
        for (const system of l.systems)
          for (const mark of system.hyphens ?? []) {
            if (mark.outgoing)
              expect(mark.x + unit / 2).toBeLessThanOrEqual(staffEndX);
          }
      }
    }
  });
  it('reserves only missing room for an unusually wide measured hyphen', () => {
    const d = fixture([0, 2]);
    const font: MeasureLyricText = (text) =>
      text === '-'
        ? {
            width: 120,
            boundaries: [0, 120],
            inkBounds: { left: -3, right: 125 },
          }
        : measure(text);
    const s = layoutChant(d, font).systems[0];
    const a = s.lyrics[0],
      b = s.lyrics[1],
      h = s.hyphens?.[0];
    expect(h?.outgoing).toBe(false);
    expect(Number(b.left) - Number(a.right)).toBeGreaterThanOrEqual(132);
    expect(Number(h?.x) - 63).toBeGreaterThan(Number(a.right));
    expect(Number(h?.x) + 65).toBeLessThan(Number(b.left));
  });
  const kinds: Neume['kind'][] = [
    'punctum',
    'podatus',
    'clivis',
    'scandicus',
    'torculus',
    'climacus',
    'porrectus',
  ];
  const contours = [
    [2],
    [2, 4],
    [4, 2],
    [1, 2, 4],
    [2, 4, 3],
    [4, 3, 2],
    [4, 2, 3],
  ];
  it.each(kinds)(
    'preserves %s ink and anchors with disjoint external pointer ownership',
    (kind) => {
      const d = fixture([0, 1]);
      const contour = contours[kinds.indexOf(kind)];
      d.neumes = d.neumes.slice(0, 2).map((n, i) => ({
        ...n,
        kind,
        notes: contour.map((p, j) => ({
          id: `note${i}-${j}`,
          staffPosition: staffPosition(p),
        })),
      })) as Neume[];
      const s = layoutChant(d, measure).systems[0];
      const [a, b] = s.neumes;
      expect(b.bounds.x - a.bounds.x - a.bounds.width).toBeGreaterThanOrEqual(
        compactNeumeInkGap,
      );
      expect(a.hitClip?.right).toBe(b.hitClip?.left);
      expect(Number(a.hitClip?.right)).toBeGreaterThan(
        a.bounds.x + a.bounds.width,
      );
      expect(Number(b.hitClip?.left)).toBeLessThan(b.bounds.x);
      for (const n of s.neumes) {
        const original = buildNeumeGeometry(
          kind,
          contour.map(staffPosition),
          n.bounds.x,
          124,
        );
        expect(n.ink).toEqual(original.ink);
        expect(n.lyricAnchorX).toBe(original.lyricAnchorX);
        expect(n.notes.map((x) => x.hitShape)).toEqual(
          original.notes.map((x) => x.hitShape),
        );
      }
    },
  );
});
