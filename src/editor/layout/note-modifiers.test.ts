import type { NoteModifiers } from '../domain/chant-document';
import { moraChoices, moraIndexes } from '../domain/mora';
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
    '%s: all supported scopes across intervals and line/space positions',
    (kind) => {
      for (const a of [1, 2, 3, 5, 12])
        for (const b of [1, 2, 3, 5, 12])
          for (const offset of [-2, 0, 1, 5]) {
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
            const positions = pitches.map((p) => staffPosition(p + offset));
            const plain = buildNeumeGeometry(kind, positions, 50, 140);
            for (const episema of [false, true]) {
              const signatures = new Set<string>();
              for (const choice of moraChoices(kind)) {
                const indexes = moraIndexes(choice.value);
                const modifiers = positions.map((_, i): NoteModifiers => ({
                  ...(indexes.includes(i) ? { mora: 1 } : {}),
                  ...(episema ? { episema: true } : {}),
                }));
                const marked = buildNeumeGeometry(
                  kind,
                  positions,
                  50,
                  140,
                  modifiers,
                );
                const signs = marked.ink.slice(plain.ink.length);
                const dots = signs.filter(
                  (s) => s.kind === 'rect' && s.radius === 2,
                );
                expect(dots).toHaveLength(indexes.length);
                expect(signs).toHaveLength(
                  indexes.length + (episema ? positions.length : 0),
                );
                const signature = JSON.stringify(dots.map((d) => d.bounds));
                expect(signatures.has(signature)).toBe(false);
                signatures.add(signature);
                expect(
                  marked.notes.map(
                    ({ modifierBounds: _bounds, ...note }) => note,
                  ),
                ).toEqual(plain.notes);
                expect(marked.lyricAnchorX).toBe(plain.lyricAnchorX);
                expect(marked.ink.slice(0, plain.ink.length)).toEqual(
                  plain.ink,
                );
                expect(marked.bounds.width).toBeLessThanOrEqual(
                  plain.bounds.width + 21,
                );
                expect(marked.advanceX - marked.bounds.width).toBe(
                  plain.advanceX - plain.bounds.width,
                );
                for (const [i, sign] of signs.entries()) {
                  // Clivis first mora occupies the actual empty area right of its
                  // upper head, inside the whole compound path's bounding rectangle.
                  const body =
                    kind === 'clivis' &&
                    choice.value === 'first' &&
                    sign.kind === 'rect' &&
                    sign.radius === 2
                      ? plain.notes.map((n) => n.head)
                      : plain.ink;
                  for (const other of [...body, ...signs.slice(0, i)])
                    expect(intersects(sign.bounds, other.bounds)).toBe(false);
                  for (const p of [0, 2, 4, 6])
                    expect(
                      intersects(sign.bounds, {
                        x: 0,
                        y: 140 - p * 12 - 0.5,
                        width: 1000,
                        height: 1,
                      }),
                    ).toBe(false);
                  expect(sign.bounds.x).toBeGreaterThanOrEqual(marked.bounds.x);
                  expect(sign.bounds.y).toBeGreaterThanOrEqual(marked.bounds.y);
                  expect(sign.bounds.x + sign.bounds.width).toBeLessThanOrEqual(
                    marked.bounds.x + marked.bounds.width,
                  );
                  expect(
                    sign.bounds.y + sign.bounds.height,
                  ).toBeLessThanOrEqual(marked.bounds.y + marked.bounds.height);
                }
                if (dots.length === 2)
                  expect(dots[0].bounds.x).toBe(dots[1].bounds.x);
              }
            }
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
      '. Punctum mora. Horizontal episema',
    );
    expect(getScoreAccessibleDescription(layout)).toContain(
      '40 notes with rhythmic modifiers',
    );
  });
});
