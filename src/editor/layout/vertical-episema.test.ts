import { describe, expect, it } from 'vitest';
import type { Neume, NoteAppearance } from '../domain/chant-document';
import { staffPosition } from '../domain/chant-document';
import { moraChoices, moraIndexes } from '../domain/mora';
import { buildNeumeGeometry } from './neume-geometry';
import { layoutChant, layoutGraphicalPlacementPreview } from './layout-chant';
import { blankDocument, decodeDocument } from '../persistence/native-document';

const kinds: Neume['kind'][] = [
  'punctum',
  'podatus',
  'clivis',
  'scandicus',
  'torculus',
  'climacus',
  'porrectus',
];
describe('bounded vertical episema placement', () => {
  it.each(kinds)(
    '%s retains every tick without changing existing ink or anchors',
    (kind) => {
      for (const a of [1, 2, 3, 5, 12])
        for (const b of [1, 2, 3, 5, 12])
          for (const offset of [-4, -1, 0, 1, 5, 8]) {
            const pitches =
              kind === 'punctum'
                ? [0]
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
            const forms: NoteAppearance[][] = [positions.map(() => ({}))];
            if (kind === 'punctum')
              forms.push([{ form: 'virga' }], [{ form: 'inclinatum' }]);
            if (kind === 'podatus') forms.push([{ form: 'quilisma' }, {}]);
            if (kind === 'scandicus')
              forms.push([{}, { form: 'quilisma' }, {}]);
            for (const appearance of forms)
              for (const horizontal of [false, true])
                for (const scope of moraChoices(kind)) {
                  const modifiers = appearance.map(
                    (form, i): NoteAppearance => ({
                      ...form,
                      ...(horizontal ? { episema: true } : {}),
                      ...(moraIndexes(scope.value).includes(i)
                        ? { mora: 1 }
                        : {}),
                    }),
                  );
                  const before = buildNeumeGeometry(
                    kind,
                    positions,
                    50,
                    140,
                    modifiers,
                  );
                  expect(
                    before.ink.some(
                      (part) => part.kind === 'rect' && part.rasterization,
                    ),
                  ).toBe(false);
                  const after = buildNeumeGeometry(
                    kind,
                    positions,
                    50,
                    140,
                    modifiers.map((n) => ({ ...n, verticalEpisema: true })),
                  );
                  expect(after.ink.slice(0, before.ink.length)).toEqual(
                    before.ink,
                  );
                  expect(after.ink.length - before.ink.length).toBe(
                    positions.length,
                  );
                  expect(after.lyricAnchorX).toBe(before.lyricAnchorX);
                  for (const [index, sign] of after.ink
                    .slice(before.ink.length)
                    .entries()) {
                    const anchor = before.notes[index];
                    expect(sign.kind === 'rect' && sign.rasterization).toBe(
                      'vertical-episema',
                    );
                    expect(sign.bounds.width).toBe(1.5);
                    expect(sign.bounds.height).toBe(7);
                    for (const position of [0, 2, 4, 6]) {
                      const staffY = 140 - position * 12;
                      expect(
                        sign.bounds.y >= staffY + 4 ||
                          sign.bounds.y + sign.bounds.height <= staffY - 4,
                      ).toBe(true);
                    }

                    expect(
                      Math.abs(sign.bounds.x + 0.75 - anchor.anchorX),
                    ).toBeLessThanOrEqual(15);
                    expect(
                      Math.min(
                        Math.abs(sign.bounds.y - anchor.anchorY),
                        Math.abs(sign.bounds.y + 7 - anchor.anchorY),
                      ),
                    ).toBeLessThanOrEqual(30);
                    expect(sign.bounds.x).toBeGreaterThanOrEqual(
                      after.bounds.x,
                    );
                    expect(
                      sign.bounds.x + sign.bounds.width,
                    ).toBeLessThanOrEqual(after.bounds.x + after.bounds.width);
                    expect(sign.bounds.y).toBeGreaterThanOrEqual(
                      after.bounds.y,
                    );
                    expect(
                      sign.bounds.y + sign.bounds.height,
                    ).toBeLessThanOrEqual(after.bounds.y + after.bounds.height);
                  }
                }
          }
    },
  );
});

it('stacked upper/lower signs stay on their own side of the other head', () => {
  for (const interval of [1, 2, 3, 5, 12]) {
    const positions = [staffPosition(0), staffPosition(interval)];
    const base = buildNeumeGeometry('podatus', positions, 50, 140);
    const signed = buildNeumeGeometry('podatus', positions, 50, 140, [
      { verticalEpisema: true },
      { verticalEpisema: true },
    ]);
    const [lower, upper] = signed.ink.slice(base.ink.length);
    expect(lower.bounds.y).toBeGreaterThan(base.notes[0].anchorY);
    expect(upper.bounds.y + upper.bounds.height).toBeLessThan(
      base.notes[0].head.bounds.y,
    );
  }
});

it('shared signed preview, complete advances, whole-neume wrapping and stable identities', () => {
  const appearance: NoteAppearance[] = [
    { verticalEpisema: true, episema: true },
    { form: 'quilisma', verticalEpisema: true, episema: true, mora: 1 },
    { verticalEpisema: true, episema: true, mora: 1 },
  ];
  const positions: [
    ReturnType<typeof staffPosition>,
    ReturnType<typeof staffPosition>,
    ReturnType<typeof staffPosition>,
  ] = [staffPosition(0), staffPosition(2), staffPosition(4)];
  const document = decodeDocument(
    JSON.stringify({
      format: 'gregorian-chant-editor',
      version: 4,
      document: {
        ...blankDocument(),
        neumes: Array.from({ length: 30 }, (_, i) => ({
          id: 'neume-' + i,
          kind: 'scandicus',
          notes: positions.map((staffPosition, j) => ({
            id: `note-${i}-${j}`,
            staffPosition,
            ...appearance[j],
          })),
        })),
      },
    }),
  );
  const layout = layoutChant(document);
  expect(layout.systems.length).toBeGreaterThan(1);
  expect(
    layout.systems.flatMap((system) => system.neumes.map((n) => n.neumeId)),
  ).toEqual(document.neumes.map((n) => n.id));
  for (const system of layout.systems)
    for (const neume of system.neumes) {
      expect(neume.bounds.x + neume.bounds.width).toBeLessThanOrEqual(
        system.staffLines[0].x2,
      );
      expect(
        neume.notes.every((n) => n.verticalEpisema && n.modifierBounds),
      ).toBe(true);
      expect(neume.advanceX).toBe(neume.bounds.width + 33);
    }
  const source = layout.systems[0];
  const bottom = Math.max(...source.staffLines.map((line) => line.y));
  const preview = layoutGraphicalPlacementPreview(
    layout,
    {
      kind: 'scandicus',
      staffPositions: positions,
      insertionIndex: 0,
      appearance,
    },
    { x: 250, y: bottom },
  );
  expect(preview).not.toBeNull();
  if (!preview) return;
  const expected = buildNeumeGeometry(
    'scandicus',
    positions,
    preview.bounds.x,
    bottom,
    appearance,
  );
  expect(preview.ink).toEqual(expected.ink);
  expect(preview.notes).toEqual(expected.notes);
  expect(preview.bounds).toEqual(expected.bounds);
});
