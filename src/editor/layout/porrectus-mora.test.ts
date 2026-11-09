import { describe, expect, it } from 'vitest';
import type { NoteModifiers } from '../domain/chant-document';
import { staffPosition } from '../domain/chant-document';
import { decodeDocument, encodeDocument } from '../persistence/native-document';
import specimen from '../../../docs/verification/note-modifiers/porrectus-mora/editor-cases.chant.json?raw';
import { buildNeumeGeometry, type LayoutBounds } from './neume-geometry';
import { layoutChant } from './layout-chant';

const bottom = 140;
const patterns = [
  [4, 2, 4],
  [3, 0, 4],
  [5, 4, 5],
  [4, 3, 4],
  [6, 1, 3],
  [3, 1, 6],
];
const intersects = (a: LayoutBounds, b: LayoutBounds) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
function build(pitches: number[], modifiers: NoteModifiers[]) {
  return buildNeumeGeometry(
    'porrectus',
    pitches.map(staffPosition),
    50,
    bottom,
    modifiers,
  );
}

describe('Porrectus trailing mora', () => {
  it.each(patterns.map((pitches) => [pitches] as const))(
    '%j retains every independent or combined sign across line/space transpositions',
    (pitches) => {
      for (const offset of [-2, 0, 1, 3]) {
        const positions = pitches.map((p) => p + offset);
        const plain = build(positions, []);
        const intents: NoteModifiers[][] = [
          ...[0, 1, 2].flatMap((index) =>
            [1, 2].flatMap((mora) =>
              [false, true].map((episema) =>
                positions.map((_, i): NoteModifiers =>
                  i === index
                    ? {
                        mora: mora === 1 ? 1 : 2,
                        ...(episema ? { episema: true } : {}),
                      }
                    : {},
                ),
              ),
            ),
          ),
          positions.map(() => ({ mora: 1 })),
          positions.map(() => ({ mora: 2, episema: true })),
        ];
        for (const intent of intents) {
          const before = structuredClone(intent);
          const marked = build(positions, intent);
          const signs = marked.ink.slice(plain.ink.length);
          const dots = signs.filter((s) => s.kind === 'rect' && s.radius === 2);
          expect(dots.length).toBe(
            intent.reduce((sum, n) => sum + (n.mora ?? 0), 0),
          );
          expect(intent).toEqual(before);
          expect(marked.ink.slice(0, plain.ink.length)).toEqual(plain.ink);
          expect(
            marked.notes.map(({ modifierBounds: _bounds, ...note }) => note),
          ).toEqual(plain.notes);
          expect(marked.lyricAnchorX).toBe(plain.lyricAnchorX);
          expect(marked.bounds.width).toBeLessThanOrEqual(
            plain.bounds.width + 21,
          );
          expect(marked.advanceX - marked.bounds.width).toBe(
            plain.advanceX - plain.bounds.width,
          );
          for (const dot of dots)
            expect(dot.bounds.x).toBeGreaterThanOrEqual(
              plain.bounds.x + plain.bounds.width + 3,
            );
          for (const [index, sign] of signs.entries()) {
            for (const other of [...plain.ink, ...signs.slice(0, index)])
              expect(intersects(sign.bounds, other.bounds)).toBe(false);
            for (const p of [0, 2, 4, 6])
              expect(
                intersects(sign.bounds, {
                  x: 0,
                  y: bottom - p * 12 - 0.5,
                  width: 1000,
                  height: 1,
                }),
              ).toBe(false);
            expect(sign.bounds.x + sign.bounds.width).toBeLessThanOrEqual(
              marked.bounds.x + marked.bounds.width,
            );
            expect(sign.bounds.y).toBeGreaterThanOrEqual(marked.bounds.y);
            expect(sign.bounds.y + sign.bounds.height).toBeLessThanOrEqual(
              marked.bounds.y + marked.bounds.height,
            );
          }
        }
      }
    },
  );
  it.each([0, 2, 4, 6])(
    'puts an adjacent-ascent second note on line %s in the space below',
    (second) => {
      const marked = build(
        [second + 3, second, second + 1],
        [{}, { mora: 1 }, {}],
      );
      const dot = marked.notes[1].modifierBounds;
      expect(dot?.y).toBe(bottom - second * 12 + 12 - 2);
    },
  );
  it('keeps a space-level second dot at pitch and a wider-ascent line dot above', () => {
    expect(
      build([4, 3, 4], [{}, { mora: 1 }, {}]).notes[1].modifierBounds?.y,
    ).toBe(bottom - 3 * 12 - 2);
    expect(
      build([4, 2, 4], [{}, { mora: 1 }, {}]).notes[1].modifierBounds?.y,
    ).toBe(bottom - 2 * 12 - 12 - 2);
  });
  it('adds seven units for each ordinary single dot, including the first ribbon note', () => {
    for (const pitches of patterns) {
      const plain = build(pitches, []);
      for (const index of [0, 1, 2]) {
        const marked = build(
          pitches,
          pitches.map((_, i) => (i === index ? { mora: 1 } : {})),
        );
        expect(marked.bounds.width - plain.bounds.width).toBe(7);
      }
    }
  });
  it('keeps coincident outer-note dots on the same row without dropping either authored sign', () => {
    const plain = build([3, 1, 3], []);
    const marked = build([3, 1, 3], [{ mora: 1 }, { mora: 1 }, { mora: 1 }]);
    const first = marked.notes[0].modifierBounds;
    const third = marked.notes[2].modifierBounds;
    expect(first?.y).toBe(third?.y);
    expect(third?.x).toBe((first?.x ?? 0) + 7);
    expect(marked.ink.length - plain.ink.length).toBe(3);
  });
  it('retains note IDs and exact v2 values through shared layout, wrapping and serialization', () => {
    const document = decodeDocument(specimen);
    const snapshot = structuredClone(document);
    const layout = layoutChant(document);
    expect(layout.systems.length).toBeGreaterThan(1);
    const neumes = layout.systems.flatMap((s) => s.neumes);
    expect(neumes.map((n) => n.neumeId)).toEqual(
      document.neumes.map((n) => n.id),
    );
    for (const [i, n] of neumes.entries()) {
      expect(n.notes.map((note) => note.noteId)).toEqual(
        document.neumes[i].notes.map((note) => note.id),
      );
      expect(n.notes.map((note) => note.mora)).toEqual(
        document.neumes[i].notes.map((note) => note.mora),
      );
    }
    expect(decodeDocument(encodeDocument(document))).toEqual(snapshot);
    expect(document).toEqual(snapshot);
  });
});
