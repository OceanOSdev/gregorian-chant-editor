import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import {
  getSystemNeumePlacement,
  layoutChant,
  type GraphicalNeumeKind,
} from './layout-chant';

function punctum(id: string): Neume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    notes: [{ id, staffPosition: staffPosition(2) }],
  };
}

function documentWith(neumes: Neume[]): ChantDocument {
  return {
    accidentals: [],
    clefChanges: [],
    divisions: [],
    lyricLanguage: 'la',
    title: 'Test',
    clef: { type: 'c', staffLine: 3 },
    syllables: neumes.length
      ? [
          {
            id: 'syllable-1',
            text: 'Ky',
            startsAtNeumeId: neumes[0].id,
            boundaryBefore: 'word',
          },
        ]
      : [],
    neumes,
  };
}

function resolve(
  document: ChantDocument,
  systemIndex: number,
  kind: GraphicalNeumeKind,
  x: number,
  position = 2,
) {
  const system = layoutChant(document).systems[systemIndex];
  const bottom = system
    ? Math.max(...system.staffLines.map((line) => line.y))
    : undefined;

  if (!system || bottom === undefined) {
    throw new Error('Missing system geometry');
  }

  return getSystemNeumePlacement(
    { x, y: bottom - position * 12 },
    kind,
    system,
  );
}

describe('system graphical neume placement', () => {
  it.each([
    ['punctum', [2]],
    ['podatus', [2, 3]],
    ['clivis', [2, 1]],
    ['scandicus', [2, 3, 4]],
    ['torculus', [2, 4, 3]],
    ['climacus', [2, 1, 0]],
    ['porrectus', [2, 0, 1]],
  ] as const)('keeps the %s tuple cardinality', (kind, positions) => {
    expect(resolve(documentWith([]), 0, kind, 300)?.staffPositions).toEqual(
      positions,
    );
  });

  it('uses system-local pitch snapping with ties upward', () => {
    const document = documentWith(
      Array.from({ length: 20 }, (_, index) => punctum(`${index}`)),
    );
    const layout = layoutChant(document);

    for (const system of layout.systems) {
      const bottom = Math.max(...system.staffLines.map((line) => line.y));

      if (bottom === undefined) {
        throw new Error('Missing staff');
      }

      expect(
        getSystemNeumePlacement({ x: 300, y: bottom - 6 }, 'punctum', system)
          ?.staffPositions,
      ).toEqual([1]);
    }
  });

  it('converts local whole-neume boundaries to global indexes', () => {
    const document = documentWith(
      Array.from({ length: 20 }, (_, index) => punctum(`${index}`)),
    );
    const layout = layoutChant(document);
    const later = layout.systems[1];

    if (!later) {
      throw new Error('Missing later system');
    }

    const first = later.neumes[0];
    const midpoint = first
      ? first.bounds.x + first.bounds.width / 2
      : Number.NaN;

    expect(resolve(document, 1, 'punctum', midpoint)).toMatchObject({
      preferredNeumeInsertionIndex: later.startNeumeIndex,
    });
    expect(resolve(document, 1, 'punctum', midpoint + 0.001)).toMatchObject({
      preferredNeumeInsertionIndex: later.startNeumeIndex + 1,
    });
    expect(resolve(document, 1, 'punctum', 656)).toMatchObject({
      preferredNeumeInsertionIndex: later.startNeumeIndex + later.neumes.length,
    });
  });

  it('includes exact staff edges and outside-staff pitches on every system', () => {
    const layout = layoutChant(
      documentWith(
        Array.from({ length: 30 }, (_, index) => punctum(`${index}`)),
      ),
    );
    for (const system of layout.systems) {
      const bottom = Math.max(...system.staffLines.map((line) => line.y));
      for (const x of [64, 656]) {
        for (const position of [-1, 7]) {
          const point = { x, y: bottom - position * 12 };
          expect(
            getSystemNeumePlacement(point, 'punctum', system),
          ).toMatchObject({ firstStaffPosition: position });
          expect(
            getSystemNeumePlacement(
              { x, y: point.y + (position === -1 ? 0.001 : -0.001) },
              'punctum',
              system,
            ),
          ).toBeNull();
        }
      }
    }
  });

  it('rejects invalid and out-of-region points', () => {
    const document = documentWith([]);
    const system = layoutChant(document).systems[0];

    if (!system) {
      throw new Error('Missing empty system');
    }

    expect(
      getSystemNeumePlacement({ x: Number.NaN, y: 100 }, 'punctum', system),
    ).toBeNull();
    expect(
      getSystemNeumePlacement({ x: 300, y: 100 }, 'punctum', {
        ...system,
        staffLines: [],
      }),
    ).toBeNull();
    expect(resolve(document, 0, 'punctum', 63)).toBeNull();
    expect(resolve(document, 0, 'punctum', 657)).toBeNull();
    expect(resolve(document, 0, 'punctum', 300, 8)).toBeNull();
    expect(resolve(document, 0, 'punctum', 300, -2)).toBeNull();
  });
});
