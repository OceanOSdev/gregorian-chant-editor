import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { importGabc } from '../interchange/gabc';
import {
  layoutChant,
  staffEndX,
  getSystemNeumePlacement,
} from './layout-chant';
import { lyricGraphemes } from '../domain/lyric-alignment';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { placePunctumTool } from '../state/editor-tool';
const measure = (text: string) => {
  const n = lyricGraphemes(text).length;
  return {
    width: n * 10,
    boundaries: Array.from({ length: n + 1 }, (_, i) => i * 10),
  };
};
const spaced = (score: ChantDocument) =>
  layoutChant(score, measure, { lyricSpacing: true });
const lyrics = (layout: ReturnType<typeof layoutChant>) =>
  layout.systems.flatMap((s) => s.lyrics);

describe('experimental lyric-aware engraving', () => {
  it('enforces distinct-word clearance and preserves the semantic score', () => {
    const score = importGabc(
      'name: Long words;\n%%\n(c4) benedictus(f) magnificavit(g) misericordiam(h) benedictus(i) magnificavit(j)',
    );
    const before = structuredClone(score);
    const layout = spaced(score);
    for (const system of layout.systems)
      for (let i = 1; i < system.lyrics.length; i++) {
        const a = system.lyrics[i - 1],
          b = system.lyrics[i];
        expect(
          b.x -
            (b.alignment.width ?? 0) / 2 -
            a.x -
            (a.alignment.width ?? 0) / 2,
        ).toBeGreaterThanOrEqual(14);
      }
    expect(layout.systems.length).toBeGreaterThan(
      layoutChant(score).systems.length,
    );
    expect(score).toEqual(before);
  });
  it('joins close syllables, generates distant hyphens, and never hyphenates between words', () => {
    const score = importGabc(
      'name: Words;\n%%\n(c4) Kyrie(f)eleison(g) e(h)lei(i)son(j)',
    );
    score.lyricLanguage = 'und';
    const layout = spaced(score);
    const close = lyrics(layout).slice(0, 2);
    expect(close[1].x - 35 - close[0].x - 25).toBeLessThan(12);
    const marks = layout.systems.flatMap((s) => s.hyphens ?? []);
    expect(marks.length).toBeGreaterThan(0);
    // No mark in the gap leading into the separately authored word “e”.
    const left = lyrics(layout)[1],
      right = lyrics(layout)[2];
    expect(marks.some((m) => m.x > left.x && m.x < right.x)).toBe(false);
    expect(score.syllables.every((s) => !s.text.includes('-'))).toBe(true);
  });
  it('preserves melisma spacing and adds outgoing hyphens on every continued system', () => {
    const music = Array.from({ length: 35 }, () => 'f').join('/');
    const score = importGabc(`name: Melisma;\n%%\n(c4) Ky(${music})rie(g)`);
    const a = layoutChant(score, measure),
      b = spaced(score);
    expect(b.systems.length).toBe(a.systems.length);
    expect(
      b.systems.slice(0, -1).every((s) => (s.hyphens?.length ?? 0) === 1),
    ).toBe(true);
    expect(b.systems.at(-1)?.hyphens?.length).toBe(0);
  });
  it('guarantees progress for oversized syllables and expands the SVG instead of clipping', () => {
    const score = importGabc(
      `name: Oversize;\n%%\n(c4) ${'a'.repeat(200)}(f) next(g)`,
    );
    const layout = spaced(score);
    expect(layout.systems).toHaveLength(2);
    const text = lyrics(layout)[0];
    expect(text.x - 1000).toBeGreaterThanOrEqual(64);
    expect(text.x + 1000).toBeLessThan(layout.width);
    expect(layout.width).toBeGreaterThan(staffEndX);
  });
  it('uses the visible measured layout when committing graphical insertion', () => {
    const score = importGabc(
      'name: Placement;\n%%\n(c4) benedictus(f) magnificavit(g) misericordiam(h) benedictus(i) magnificavit(j)',
    );
    const layout = spaced(score);
    const system = layout.systems[1];
    expect(system).toBeDefined();
    const point = {
      x: 230,
      y: Math.max(...system.staffLines.map((l) => l.y)) - 24,
    };
    const intent = getSystemNeumePlacement(point, 'punctum', system);
    expect(intent).not.toBeNull();
    let session = createEditorSession(score);
    session = reduceEditorSession(session, {
      type: 'arm',
      tool: placePunctumTool(),
    });
    session = reduceEditorSession(session, {
      type: 'place',
      kind: 'punctum',
      point,
      measure,
      lyricSpacing: true,
      ids: {
        neumeId: 'new-neume',
        noteIds: ['new-note', 'unused-1', 'unused-2'],
      },
    });
    expect(
      session.history.present.neumes.findIndex((n) => n.id === 'new-neume'),
    ).toBe(intent?.preferredNeumeInsertionIndex);
    expect(session.history.past).toHaveLength(1);
  });
  it('expands vertical bands for extreme notes without overlapping lyrics or neighboring systems', () => {
    const score = importGabc('name: Range;\n%%\n(c4) Ky(f)rie(g)');
    score.neumes[0].notes[0].staffPosition = staffPosition(35);
    score.neumes[1].notes[0].staffPosition = staffPosition(-20);
    const layout = spaced(score),
      system = layout.systems[0];
    expect(system.neumes.every((n) => n.bounds.y >= 12)).toBe(true);
    expect(
      Math.max(...system.neumes.map((n) => n.bounds.y + n.bounds.height)),
    ).toBeLessThan(system.lyrics[0].y);
    expect(system.lyrics[0].y).toBeLessThan(layout.height);
  });
});
