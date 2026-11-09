import { describe, expect, it } from 'vitest';
import { decodeDocument } from '../persistence/native-document';
import { staffPosition } from '../domain/chant-document';
import { buildNeumeGeometry } from './neume-geometry';
import { layoutChant, measureNeumeWidth } from './layout-chant';
import { getNoteModifierDescription } from '../rendering/note-accessible-label';
import { getScoreAccessibleDescription } from '../rendering/score-accessible-description';

const kinds = [
  ['punctum', [0]],
  ['podatus', [0, 1]],
  ['clivis', [2, 1]],
  ['scandicus', [0, 1, 2]],
  ['torculus', [1, 2, 0]],
  ['climacus', [3, 2, 1]],
  ['porrectus', [3, 1, 2]],
] as const;
const intersects = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

describe('measured rhythmic signs', () => {
  it.each(kinds)(
    '%s: every constituent, simultaneous marks, pitches and head contours',
    (kind, pitches) => {
      for (const offset of [-2, 0, 1, 5]) {
        const positions = pitches.map((n) => staffPosition(n + offset));
        const plain = buildNeumeGeometry(kind, positions, 50, 140);
        for (let index = 0; index < positions.length; index++) {
          const marked = buildNeumeGeometry(
            kind,
            positions,
            50,
            140,
            positions.map((_, i) =>
              i === index ? { mora: 2, episema: true } : {},
            ),
          );
          expect(
            marked.notes.map(({ modifierBounds: _bounds, ...note }) => note),
          ).toEqual(plain.notes);
          expect(marked.lyricAnchorX).toBe(plain.lyricAnchorX);
          expect(marked.ink.slice(0, plain.ink.length)).toEqual(plain.ink);
          const signs = marked.ink.slice(plain.ink.length);
          expect(signs).toHaveLength(3);
          for (const [i, part] of marked.ink.entries()) {
            expect(part.bounds.x).toBeGreaterThanOrEqual(marked.bounds.x);
            expect(part.bounds.x + part.bounds.width).toBeLessThanOrEqual(
              marked.bounds.x + marked.bounds.width,
            );
            expect(part.bounds.y).toBeGreaterThanOrEqual(marked.bounds.y);
            expect(part.bounds.y + part.bounds.height).toBeLessThanOrEqual(
              marked.bounds.y + marked.bounds.height,
            );
            if (i >= plain.ink.length) {
              for (const other of marked.ink.slice(0, i))
                expect(intersects(part.bounds, other.bounds)).toBe(false);
              for (const pitch of [0, 2, 4, 6])
                expect(
                  intersects(part.bounds, {
                    x: 0,
                    y: 140 - pitch * 12 - 0.5,
                    width: 1000,
                    height: 1,
                  }),
                ).toBe(false);
            }
          }
        }
        const all = buildNeumeGeometry(
          kind,
          positions,
          50,
          140,
          positions.map(() => ({ mora: 1, episema: true })),
        );
        expect(all.ink.length).toBe(plain.ink.length + 2 * positions.length);
        for (let i = plain.ink.length; i < all.ink.length; i++)
          for (const other of all.ink.slice(0, i))
            expect(intersects(all.ink[i].bounds, other.bounds)).toBe(false);
      }
    },
  );
  it.each(kinds)(
    '%s: marked interval matrix retains every sign with bounded horizontal growth',
    (kind) => {
      for (const a of [1, 2, 3, 5, 12])
        for (const b of [1, 2, 3, 5, 12]) {
          const pitches =
            kind === 'punctum'
              ? [2]
              : kind === 'podatus'
                ? [0, a]
                : kind === 'clivis'
                  ? [a, 0]
                  : kind === 'scandicus'
                    ? [0, a, a + b]
                    : kind === 'torculus'
                      ? [0, a, a - b]
                      : kind === 'climacus'
                        ? [a + b, b, 0]
                        : [a, 0, b];
          const positions = pitches.map(staffPosition);
          const plain = buildNeumeGeometry(kind, positions, 0, 140);
          const marked = buildNeumeGeometry(
            kind,
            positions,
            0,
            140,
            positions.map(() => ({ mora: 2, episema: true })),
          );
          expect(marked.ink.length).toBe(
            plain.ink.length + 3 * positions.length,
          );
          expect(marked.bounds.width).toBeLessThanOrEqual(
            plain.bounds.width + 30,
          );
          for (let i = plain.ink.length; i < marked.ink.length; i++)
            for (const other of marked.ink.slice(0, i))
              expect(intersects(marked.ink[i].bounds, other.bounds)).toBe(
                false,
              );
        }
    },
  );
  it('keeps ordinary single dots compact and preserves all unmarked geometry', () => {
    const positions = [staffPosition(2)];
    const plain = buildNeumeGeometry('punctum', positions, 0, 140);
    expect(buildNeumeGeometry('punctum', positions, 0, 140, [{}])).toEqual(
      plain,
    );
    const dotted = buildNeumeGeometry('punctum', positions, 0, 140, [
      { mora: 1 },
    ]);
    expect(dotted.bounds.width - plain.bounds.width).toBe(9);
  });
  it('wraps complete ink with mixed events and continuation lyrics, exposing outside-staff signs', () => {
    const document = decodeDocument(
      JSON.stringify({
        format: 'gregorian-chant-editor',
        version: 2,
        document: {
          title: 'Signs',
          lyricLanguage: 'la',
          clef: { type: 'c', staffLine: 3 },
          neumes: Array.from({ length: 40 }, (_, i) => ({
            id: 'n' + i,
            kind: 'punctum',
            notes: [
              {
                id: 'note' + i,
                staffPosition: i === 0 ? 20 : i % 7,
                mora: 1,
                episema: true,
              },
            ],
          })),
          syllables: Array.from({ length: 40 }, (_, i) => ({
            id: 's' + i,
            text: i % 2 ? 'le' : 'Al',
            startsAtNeumeId: 'n' + i,
            boundaryBefore: i === 0 ? 'word' : 'continuation',
          })),
          divisions: [{ id: 'bar', kind: 'minor', beforeNeumeId: 'n8' }],
          clefChanges: [
            {
              id: 'change',
              clef: { type: 'f', staffLine: 2 },
              beforeNeumeId: 'n15',
              beforeDivisionId: null,
            },
          ],
        },
      }),
    );
    const layout = layoutChant(document);
    expect(layout.systems.length).toBeGreaterThan(1);
    expect(
      layout.systems.flatMap((s) => s.neumes).map((n) => n.neumeId),
    ).toEqual(document.neumes.map((n) => n.id));
    for (const system of layout.systems)
      for (const [i, n] of system.neumes.entries()) {
        expect(n.bounds.y).toBeGreaterThanOrEqual(layout.y);
        expect(n.bounds.y + n.bounds.height).toBeLessThanOrEqual(
          layout.y + layout.height,
        );
        expect(n.bounds.x + n.bounds.width).toBeLessThanOrEqual(
          system.staffLines[0].x2,
        );
        if (i)
          expect(n.bounds.x).toBeGreaterThan(
            system.neumes[i - 1].bounds.x + system.neumes[i - 1].bounds.width,
          );
      }
    expect(measureNeumeWidth(document.neumes[0])).toBe(21);
    expect(getNoteModifierDescription(document.neumes[0].notes[0])).toBe(
      '. Single punctum mora. Horizontal episema',
    );
    expect(getScoreAccessibleDescription(layout)).toContain(
      '40 notes with rhythmic modifiers',
    );
  });
});
