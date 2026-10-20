import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { insertEditorNeume } from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { buildNeumeGeometry, firstHeadHalfWidth } from './neume-geometry';
import {
  layoutChant,
  layoutGraphicalPlacementPreview,
  type GraphicalNeumeKind,
} from './layout-chant';

function documentWith(count = 0): ChantDocument {
  return {
    title: 'Intent',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 's1', text: 'Ky' },
      { id: 's2', text: 'ri' },
      { id: 'empty', text: '' },
    ],
    neumes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      lyricSyllableId: 's1',
      notes: [{ id: `a${i}`, staffPosition: staffPosition(2) }],
    })),
  };
}
const contours = [
  ['punctum', [2]],
  ['podatus', [2, 3]],
  ['clivis', [2, 1]],
  ['scandicus', [2, 3, 4]],
  ['torculus', [2, 4, 3]],
  ['climacus', [2, 1, 0]],
  ['porrectus', [2, 0, 1]],
] as const;
function resolve(
  document: ChantDocument,
  x = 300,
  y = 100,
  kind: GraphicalNeumeKind = 'punctum',
  syllable = 's1',
) {
  const intent = resolveGraphicalNeumePlacement(
    document,
    layoutChant(document),
    syllable,
    kind,
    { x, y },
  );
  if (!intent) throw new Error('Expected insertion intent');
  return intent;
}

describe('caret and local ghost insertion intent', () => {
  it.each(contours)(
    'shows the actual %s shape and snapped contour without IDs',
    (kind, positions) => {
      const document = documentWith(10);
      const original = structuredClone(document);
      const layout = layoutChant(document);
      const intent = resolve(document, 655, 100, kind);
      expect(intent.staffPositions).toEqual(positions);
      const ghost = intent.preview;
      expect(ghost.notes.map((note) => (124 - note.anchorY) / 12)).toEqual(
        positions,
      );
      expect(ghost.bounds.x).toBeGreaterThanOrEqual(64);
      expect(ghost.bounds.x + ghost.bounds.width).toBeLessThanOrEqual(653);
      const expected = buildNeumeGeometry(
        kind,
        positions.map(staffPosition),
        ghost.notes[0].anchorX - firstHeadHalfWidth(kind),
        124,
      );
      expect(ghost.ink).toEqual(expected.ink);
      expect(ghost.notes).toEqual(expected.notes);
      expect(ghost).not.toHaveProperty('scoreHeight');
      expect(ghost).not.toHaveProperty('systems');
      function noIds(value: unknown) {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
          expect(['id', 'noteId', 'neumeId', 'lyricSyllableId']).not.toContain(
            key,
          );
          noIds(child);
        }
      }
      noIds(ghost);
      expect(document).toEqual(original);
      expect(layoutChant(document)).toEqual(layout);
      const committed = insertEditorNeume(document, 's1', intent, {
        neumeId: 'new',
        noteIds: ['new1', 'new2', 'new3'],
      });
      expect(layoutChant(committed).systems).toHaveLength(2);
      expect(
        committed.neumes.at(-1)?.notes.map((note) => note.staffPosition),
      ).toEqual(positions);
      expect(layout.systems).toHaveLength(1);
    },
  );
  it.each(contours)(
    'keeps %s pitch feedback accurate on low, line, space and high positions',
    (kind, positions) => {
      const document = documentWith(10);
      for (const first of [-1, 0, 3, 7]) {
        const intent = resolve(document, 400, 124 - first * 12, kind);
        expect(
          intent.preview.notes.map((note) => (124 - note.anchorY) / 12),
        ).toEqual(positions.map((position) => position + first - 2));
        expect(intent.preview.caret).toEqual(
          resolve(document, 400, 100, kind).preview.caret,
        );
      }
    },
  );
  it('uses the semantic gap midpoint, including first and final boundaries', () => {
    const document = documentWith(2);
    expect(resolve(document, 64).preview.caret).toEqual({
      systemIndex: 0,
      x: 207.5,
      top: 40,
      bottom: 136,
    });
    expect(resolve(document, 240).preview.caret.x).toBe(252.5);
    expect(resolve(document, 656).preview.caret.x).toBe(297.5);
    expect(resolve(documentWith(), 300).preview.caret.x).toBe(230);
  });
  it('moves the ghost inside a boundary without moving its caret or committed score', () => {
    const document = documentWith(10);
    const layout = layoutChant(document);
    const a = resolve(document, 399, 100, 'torculus');
    const b = resolve(document, 400, 100, 'torculus');
    expect(a.insertionIndex).toBe(b.insertionIndex);
    expect(a.preview.caret).toEqual(b.preview.caret);
    expect(b.preview.notes[0].anchorX - a.preview.notes[0].anchorX).toBe(1);
    expect(a.preview.notes[0].anchorY).toBe(b.preview.notes[0].anchorY);
    expect(layoutChant(document)).toEqual(layout);
  });
  it('uses clamped semantic boundaries across systems while keeping the ghost local', () => {
    const document = documentWith(30);
    document.neumes.forEach((n, i) => {
      n.lyricSyllableId = i < 5 ? 's1' : 's2';
    });
    const layout = layoutChant(document);
    const intent = resolve(document, 655, 588, 'torculus');
    expect(intent.insertionIndex).toBe(5);
    expect(intent.preview.pointerSystemIndex).toBe(2);
    expect(intent.preview.caret).toEqual({
      systemIndex: 0,
      x: 432.5,
      top: 40,
      bottom: 136,
    });
    expect(intent.preview.notes[0].anchorY).toBe(588);
    expect(
      insertEditorNeume(document, 's1', intent, {
        neumeId: 'new',
        noteIds: ['new1', 'new2', 'new3'],
      }).neumes[5].id,
    ).toBe('new');
    const empty = resolve(document, 300, 100, 'punctum', 'empty');
    expect(empty.insertionIndex).toBe(30);
    expect(empty.preview.caret.systemIndex).toBe(2);
    expect(layoutChant(document)).toEqual(layout);
  });
  it('represents a boundary shared by systems on the hovered system', () => {
    const document = documentWith(20);
    const end = resolve(document, 655);
    const start = resolve(document, 64, 344);
    expect(end.insertionIndex).toBe(10);
    expect(start.insertionIndex).toBe(10);
    expect(end.preview.caret.systemIndex).toBe(0);
    expect(start.preview.caret.systemIndex).toBe(1);
  });
  it('does not open a gap for crowded ghosts or move existing notation', () => {
    const document = documentWith(10);
    const layout = layoutChant(document);
    for (const x of [64, 229, 231, 274, 276, 409, 411, 650, 655]) {
      const intent = resolve(document, x, 100, 'porrectus');
      expect(intent.preview.pointerSystemIndex).toBe(0);
      expect(intent.preview.caret.systemIndex).toBe(0);
      expect(layoutChant(document)).toEqual(layout);
    }
  });
  it('moves existing notes and their lyrics only on commit', () => {
    const document = documentWith(10);
    document.neumes[9].lyricSyllableId = 's2';
    const before = layoutChant(document);
    const intent = resolve(document, 220, 100, 'torculus');
    expect(before.systems).toHaveLength(1);
    expect(
      before.systems[0].lyrics.some((lyric) => lyric.syllableId === 's2'),
    ).toBe(true);
    expect(layoutChant(document)).toEqual(before);
    const committed = insertEditorNeume(document, 's1', intent, {
      neumeId: 'new',
      noteIds: ['new1', 'new2', 'new3'],
    });
    expect(
      layoutChant(committed).systems[1].lyrics.some(
        (lyric) => lyric.syllableId === 's2',
      ),
    ).toBe(true);
    expect(committed.neumes.filter((n) => n.id !== 'new')).toEqual(
      document.neumes,
    );
  });
  it('rejects invalid intent without hypothetical layout or IDs', () => {
    const document = documentWith(2);
    const layout = layoutChant(document);
    for (const x of [-1, NaN, Infinity])
      expect(
        resolveGraphicalNeumePlacement(document, layout, 's1', 'punctum', {
          x,
          y: 100,
        }),
      ).toBeNull();
    expect(
      resolveGraphicalNeumePlacement(document, layout, 's1', 'punctum', {
        x: 300,
        y: 230,
      }),
    ).toBeNull();
    for (const insertionIndex of [-1, 3, NaN, 0.5])
      expect(
        layoutGraphicalPlacementPreview(
          layout,
          {
            kind: 'punctum',
            staffPositions: [staffPosition(2)],
            insertionIndex,
          },
          { x: 300, y: 100 },
        ),
      ).toBeNull();
  });
});
