import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { insertEditorNeume } from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { layoutChant, type GraphicalNeumeKind } from './layout-chant';

function fullSystem(): ChantDocument {
  return {
    title: 'Wrapping preview',
    clef: { type: 'c', staffLine: 2 },
    syllables: [
      { id: 's1', text: 'Ky' },
      { id: 's2', text: 'ri' },
    ],
    neumes: Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      lyricSyllableId: 's1',
      notes: [{ id: `a${i}`, staffPosition: staffPosition(2) }],
    })),
  };
}

function checkScene(
  document: ChantDocument,
  kind: GraphicalNeumeKind,
  x: number,
) {
  const before = structuredClone(document);
  const intent = resolveGraphicalNeumePlacement(
    document,
    layoutChant(document),
    's1',
    kind,
    { x, y: 100 },
  );
  if (!intent?.preview.systems)
    throw new Error('Expected a complete visual preview');
  const result = insertEditorNeume(document, 's1', intent, {
    neumeId: 'new',
    noteIds: ['new1', 'new2', 'new3'],
  });
  const committed = layoutChant(result);
  const scene = intent.preview.systems;
  expect(document).toEqual(before);
  expect(scene).toHaveLength(committed.systems.length);
  expect(intent.preview.scoreHeight).toBe(committed.height);
  for (const [index, system] of scene.entries()) {
    const actual = committed.systems[index];
    expect(system.staffLines).toEqual(actual.staffLines);
    expect(system.staffLines).toHaveLength(4);
    expect(system.clef).toEqual(actual.clef);
    expect(system.lyrics).toEqual(actual.lyrics);
    expect(system.startNeumeIndex).toBe(actual.startNeumeIndex);
    expect(
      system.neumes.map(({ candidate, lyricSyllableId, ...geometry }) => ({
        geometry,
        candidate,
        lyricSyllableId,
      })),
    ).toEqual(
      actual.neumes.map(
        ({ neumeId, lyricSyllableId, kind: _kind, notes, ...geometry }) => ({
          geometry: {
            ...geometry,
            notes: notes.map(({ noteId: _id, ...note }) => note),
          },
          candidate: neumeId === 'new',
          lyricSyllableId,
        }),
      ),
    );
    expect(
      system.neumes.every(
        (neume) =>
          !('neumeId' in neume) &&
          neume.notes.every((note) => !('noteId' in note)),
      ),
    ).toBe(true);
  }
  expect(
    scene.flatMap((system) => system.neumes).filter((neume) => neume.candidate),
  ).toHaveLength(1);
  return { scene, committed, result };
}

describe('complete prospective placement scene', () => {
  it.each([
    'punctum',
    'podatus',
    'clivis',
    'scandicus',
    'torculus',
    'climacus',
    'porrectus',
  ] as const)(
    'shows the new system and exact %s geometry before appending',
    (kind) => {
      const document = fullSystem();
      expect(layoutChant(document).systems).toHaveLength(1);
      const { scene } = checkScene(document, kind, 655);
      expect(scene).toHaveLength(2);
      expect(scene[1].neumes.some((neume) => neume.candidate)).toBe(true);
      expect(scene[1].clef.staffLine).toBe(2);
    },
  );
  it('moves displaced existing ink and its lyric across the system boundary', () => {
    const document = fullSystem();
    document.neumes[9].lyricSyllableId = 's2';
    const before = layoutChant(document);
    const { scene, result } = checkScene(document, 'torculus', 220);
    expect(
      before.systems[0].lyrics.some((lyric) => lyric.syllableId === 's2'),
    ).toBe(true);
    expect(scene[1].lyrics.some((lyric) => lyric.syllableId === 's2')).toBe(
      true,
    );
    expect(scene[0].lyrics.some((lyric) => lyric.syllableId === 's2')).toBe(
      false,
    );
    expect(scene[1].neumes.at(-1)?.ink).not.toEqual(
      before.systems[0].neumes.at(-1)?.ink,
    );
    expect(result.neumes.filter((neume) => neume.id !== 'new')).toEqual(
      document.neumes,
    );
  });
});
