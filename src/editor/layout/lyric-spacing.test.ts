import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import { lyricGraphemes } from '../domain/lyric-alignment';
import {
  updateLyricAlignment,
  updateLyricLanguage,
} from '../commands/update-lyric-alignment';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import {
  layoutChant,
  staffEndX,
  staffStartX,
  wrapNeumes,
} from './layout-chant';
import { buildNeumeGeometry, firstHeadHalfWidth } from './neume-geometry';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import type { MeasureLyricText } from './lyric-text-metrics';

const measure: MeasureLyricText = (text) => {
  const count = lyricGraphemes(text).length;
  return {
    width: count * 10,
    boundaries: Array.from({ length: count + 1 }, (_, i) => i * 10),
  };
};
function fixture(texts: string[], count = texts.length): ChantDocument {
  return {
    title: 'Spacing',
    clefChanges: [],
    divisions: [],
    lyricLanguage: 'und',
    clef: { type: 'c', staffLine: 3 },
    syllables: texts.map((text, i) => ({
      id: `s${i}`,
      text,
      startsAtNeumeId: `n${i}`,
      boundaryBefore: 'word',
    })),
    neumes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: staffPosition(2) }],
    })),
  };
}
const notes = (d: ChantDocument) =>
  layoutChant(d, measure).systems.flatMap((s) => s.neumes);

describe('combined music and lyric placement', () => {
  it('preserves complete music-only geometry for every supported kind', () => {
    const contours = [
      [2],
      [2, 4],
      [4, 2],
      [1, 2, 4],
      [2, 4, 3],
      [4, 3, 2],
      [4, 2, 3],
    ];
    const kinds = [
      'punctum',
      'podatus',
      'clivis',
      'scandicus',
      'torculus',
      'climacus',
      'porrectus',
    ] as const;
    // Runtime geometry matrix; domain tuple validity is covered independently.
    const d = fixture([], 28);
    d.neumes = d.neumes.map((n, i) =>
      Object.assign(n, {
        kind: kinds[i % 7],
        notes: contours[i % 7].map((p, j) => ({
          id: `note${i}-${j}`,
          staffPosition: staffPosition(p),
        })),
      }),
    ) as Neume[];
    const layout = layoutChant(d, measure);
    const music = wrapNeumes(d.neumes);
    expect(layout).toEqual(layoutChant(d));
    expect(layout.systems.map((s) => s.startNeumeIndex)).toEqual(
      music.map((s) => s.startNeumeIndex),
    );
    layout.systems.forEach((s, i) => {
      let left = 150 - firstHeadHalfWidth(music[i].neumes[0].kind);
      s.neumes.forEach((n, j) => {
        const semantic = music[i].neumes[j];
        const geometry = buildNeumeGeometry(
          semantic.kind,
          semantic.notes.map((n) => n.staffPosition),
          left,
          124 + i * 244,
        );
        expect(n).toEqual({
          ...geometry,
          neumeId: semantic.id,
          kind: semantic.kind,
          notes: geometry.notes.map((n, k) => ({
            ...n,
            noteId: semantic.notes[k].id,
          })),
        });
        left = geometry.bounds.x + geometry.advanceX;
      });
    });
    expect(layout.height).toBe(220 + (music.length - 1) * 244);
  });
  it('adds only necessary clearance, distinguishing words from continuations', () => {
    const d = fixture(['abcdefghij', 'abcdefghij']);
    const words = layoutChant(d, measure).systems[0];
    expect(words.lyrics[1].left).toBe(Number(words.lyrics[0].right) + 5);
    const continuation = layoutChant(
      {
        ...d,
        syllables: d.syllables.map((s, i) => ({
          ...s,
          boundaryBefore: i ? 'continuation' : 'word',
        })),
      },
      measure,
    ).systems[0];
    expect(continuation.lyrics[1].left).toBe(
      Number(continuation.lyrics[0].right) + 1,
    );
    expect(
      words.neumes[1].bounds.x -
        words.neumes[0].bounds.x -
        words.neumes[0].bounds.width,
    ).toBeGreaterThanOrEqual(33);
  });
  it.each([1, 2, 3])(
    'keeps %i intervening melismatic neumes music-spaced',
    (gap) => {
      const d = fixture(['a'.repeat(30), 'b'.repeat(12)], gap + 3);
      d.syllables = d.syllables.map((s, i) => ({
        ...s,
        startsAtNeumeId: `n${i ? gap + 1 : 0}`,
      }));
      const actual = notes(d),
        baseline = notes({ ...d, syllables: [] });
      for (let i = 1; i <= gap; i++)
        expect(actual[i].bounds.x - actual[i - 1].bounds.x).toBe(
          baseline[i].bounds.x - baseline[i - 1].bounds.x,
        );
      expect(actual.at(-1)?.bounds.x).toBe(
        Number(actual.at(-2)?.bounds.x) + 45,
      );
    },
  );
  it('respects exact right-edge fit, then wraps the next whole neume', () => {
    const d = fixture(['a', 'b', 'c'], 3);
    const exact: MeasureLyricText = (text) =>
      text === 'a'
        ? { width: 10, boundaries: [0, 10] }
        : { width: 476, boundaries: [0, 476] };
    const l = layoutChant(d, exact);
    expect(l.systems[0].lyrics.at(-1)?.right).toBe(staffEndX - 20);
    expect(l.systems[0].custodes.at(-1)?.bounds.x).toBe(staffEndX - 10);
    expect(l.systems[0].neumes).toHaveLength(2);
    expect(l.systems[1].startNeumeIndex).toBe(2);
  });
  it('handles first-syllable left bearings without moving text off its anchor', () => {
    const d = fixture(['b'.repeat(20) + 'a']);
    d.lyricLanguage = 'la';
    const l = layoutChant(d, measure),
      s = l.systems[0];
    expect(s.lyrics[0].left).toBe(staffStartX);
    expect(s.lyrics[0].anchorX).toBe(s.neumes[0].lyricAnchorX);
    expect(s.lyrics[0].x + Number(s.lyrics[0].alignment.width) / 2).toBe(
      s.lyrics[0].right,
    );
    expect(l.width).toBe(720);
  });
  it.each(['left', 'right', 'both'] as const)(
    'exposes %s overhang with isolated oversized progress and fixed wrapping bounds',
    (direction) => {
      const d = fixture(['b'.repeat(300)], 24);
      d.syllables = d.syllables.map((s) => ({
        ...s,
        alignment:
          direction === 'both'
            ? undefined
            : direction === 'left'
              ? { start: 299, end: 300 }
              : { start: 0, end: 1 },
      }));
      const l = layoutChant(d, measure),
        lyric = l.systems[0].lyrics[0];
      expect(l.systems[0].neumes).toHaveLength(1);
      expect(l.systems[1].startNeumeIndex).toBe(1);
      expect(l.systems[1].neumes.length).toBeLessThan(24);
      expect(l.x).toBeLessThanOrEqual(Number(lyric.left) - 12);
      expect(l.x + l.width).toBeGreaterThanOrEqual(Number(lyric.right) + 12);
      expect(l.systems[0].neumes[0].lyricAnchorX).toBe(150);
      expect(l.systems.every((s) => s.neumes.length > 0)).toBe(true);
    },
  );
  it('uses deterministic music-only placement for missing/partial/invalid/zero metrics', () => {
    const d = fixture(['abcdefghij', 'abcdefghij'], 14);
    const baseline = layoutChant(d).systems.map((s) => s.neumes);
    for (const m of [
      undefined,
      () => null,
      () => ({ width: 0, boundaries: Array(11).fill(0) }),
      () => ({ width: NaN, boundaries: [] }),
      (t: string) => (t === 'abcdefghij' ? null : measure(t)),
    ]) {
      const l = layoutChant(d, m);
      expect(l.systems.map((s) => s.neumes)).toEqual(baseline);
      expect(l.width).toBe(720);
    }
    expect(layoutChant(fixture([]), measure).systems).toHaveLength(1);
  });
  it('falls back for a partial snapshot then deterministically reflows when complete', () => {
    const d = fixture(['abcdefghij', 'klmnopqrst'], 14);
    const partial = layoutChant(d, (t) =>
      t === 'klmnopqrst' ? null : measure(t),
    );
    expect(partial.systems.map((s) => s.neumes)).toEqual(
      layoutChant(d).systems.map((s) => s.neumes),
    );
    const measured = layoutChant(d, measure);
    expect(measured.systems[0].neumes[1].bounds.x).toBeGreaterThan(
      partial.systems[0].neumes[1].bounds.x,
    );
    expect(layoutChant(d, measure)).toEqual(measured);
  });
  it('clears the painted overhang of a long same-word syllable without adding word space', () => {
    const long = 'lealsdkfjaasdfhasdf';
    const d = fixture(['Al', long, 'lu', 'ia', 'bla']);
    d.syllables = d.syllables.map((s, i) => ({
      ...s,
      boundaryBefore: i ? 'continuation' : 'word',
    }));
    const withInk: MeasureLyricText = (text) => {
      const m = measure(text);
      return m && text === long
        ? { ...m, inkBounds: { left: -3, right: m.width + 20 } }
        : m;
    };
    const plain = layoutChant(d, measure).systems[0];
    const actual = layoutChant(d, withInk).systems[0];
    expect(actual.lyrics[1].left).toBe(Number(actual.lyrics[0].right) + 1);
    expect(actual.lyrics[2].left).toBe(Number(actual.lyrics[1].right) + 1);
    expect(actual.neumes[2].bounds.x).toBeGreaterThan(plain.neumes[2].bounds.x);
    expect(actual.lyrics[1].alignment.offset).toBe(
      plain.lyrics[1].alignment.offset,
    );
    expect(actual.lyrics[1].anchorX).toBe(actual.neumes[1].lyricAnchorX);
  });
  it('wraps when advance fits exactly but the final same-word glyph overhang does not', () => {
    const d = fixture(['Al', 'lealsdkfjaasdfhasdf']);
    d.syllables = d.syllables.map((s, i) => ({
      ...s,
      boundaryBefore: i ? 'continuation' : 'word',
    }));
    const advances: MeasureLyricText = (text) => {
      const count = lyricGraphemes(text).length;
      const width = text.length > 5 ? 495 : count * 10;
      return {
        width,
        boundaries: Array.from(
          { length: count + 1 },
          (_, i) => (i * width) / count,
        ),
      };
    };
    const withInk: MeasureLyricText = (text) => {
      const m = advances(text);
      return m && text.length > 5
        ? { ...m, inkBounds: { left: 0, right: m.width + 1 } }
        : m;
    };
    const plain = layoutChant(d, advances);
    expect(plain.systems[0].neumes).toHaveLength(2);
    expect(plain.systems[0].lyrics[1].right).toBe(staffEndX);
    const actual = layoutChant(d, withInk);
    expect(actual.systems[0].neumes).toHaveLength(1);
    expect(actual.systems[1].startNeumeIndex).toBe(1);
    expect(actual.systems[1].lyrics[0].right).toBeLessThanOrEqual(staffEndX);
    expect(actual.systems[1].hyphens).toHaveLength(0);
  });
  it('uses isolated scrollable overflow when painted bounds alone make a unit oversized', () => {
    const d = fixture(['Al', 'lealsdkfjaasdfhasdf', 'lu', 'ia', 'bla']);
    const m: MeasureLyricText = (text) => {
      const measured = measure(text);
      return measured && text.length > 5
        ? { ...measured, inkBounds: { left: -500, right: 1000 } }
        : measured;
    };
    const l = layoutChant(d, m);
    expect(l.systems[1].neumes).toHaveLength(1);
    expect(l.systems[2].startNeumeIndex).toBe(2);
    expect(l.x).toBeLessThan(0);
    expect(l.width).toBeGreaterThan(720);
    const lyric = l.systems[1].lyrics[0];
    expect(l.x).toBeLessThanOrEqual(Number(lyric.left) - 12);
    expect(l.x + l.width).toBeGreaterThanOrEqual(Number(lyric.right) + 12);
  });
  it('reflows alignment/language edits with semantic identities and atomic undo/redo', () => {
    const d = fixture(
      ['b'.repeat(20) + 'a', 'c'.repeat(20) + 'a', 'd'.repeat(20) + 'a'],
      12,
    );
    let session = createEditorSession(d);
    const baseline = layoutChant(d, measure);
    session = reduceEditorSession(session, {
      type: 'engraving-edit',
      edit: (d) => updateLyricLanguage(d, 'la'),
    });
    expect(session.history.past).toHaveLength(1);
    expect(session.history.present.neumes).toBe(d.neumes);
    expect(layoutChant(session.history.present, measure)).not.toEqual(baseline);
    const changed = layoutChant(session.history.present, measure);
    session = reduceEditorSession(session, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(layoutChant(session.history.present, measure)).toEqual(baseline);
    session = reduceEditorSession(session, {
      type: 'history',
      direction: 'redo',
      focusedNoteId: null,
    });
    expect(layoutChant(session.history.present, measure)).toEqual(changed);
    const manual = updateLyricAlignment(session.history.present, 's0', {
      start: 0,
      end: 1,
    });
    expect(layoutChant(manual, measure)).not.toEqual(changed);
  });
  it('resolves repeated pointer commits with the measured snapshot on the latest semantic document', () => {
    const d = fixture(Array(12).fill('abcdefghij'), 20);
    let session = reduceEditorSession(createEditorSession(d), {
      type: 'arm',
      tool: { kind: 'place-punctum' },
    });
    const point = { x: 300, y: 124 + 244 };
    const measured = resolveGraphicalNeumePlacement(
      layoutChant(d, measure),
      'punctum',
      point,
    );
    const provisional = resolveGraphicalNeumePlacement(
      layoutChant(d),
      'punctum',
      point,
    );
    expect(measured?.insertionIndex).not.toBe(provisional?.insertionIndex);
    for (let i = 0; i < 2; i++) {
      const current = session.history.present;
      const expected = resolveGraphicalNeumePlacement(
        layoutChant(current, measure),
        'punctum',
        point,
      );
      session = reduceEditorSession(session, {
        type: 'place',
        kind: 'punctum',
        point,
        measureLyrics: measure,
        ids: {
          neumeId: `added${i}`,
          noteIds: [`added-note${i}`, `unused${i}`, `unused-b${i}`],
        },
      });
      expect(
        session.history.present.neumes[expected?.insertionIndex ?? -1].id,
      ).toBe(`added${i}`);
    }
    expect(session.history.past).toHaveLength(2);
  });
});
