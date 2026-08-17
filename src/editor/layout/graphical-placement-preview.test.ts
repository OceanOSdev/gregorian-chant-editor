import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type StaffPosition,
} from '../domain/chant-document';
import {
  getNeumeBoundaryCenterX,
  layoutChant,
  layoutGraphicalPlacementPreview,
  type GraphicalNeumeKind,
  type GraphicalPlacementPreviewInput,
  type GraphicalStaffPositions,
} from './layout-chant';

function punctum(id: string, position = 2): Neume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id, staffPosition: staffPosition(position) }],
  };
}

function existingTwoNote(kind: 'podatus' | 'clivis', id: string): Neume {
  const positions = kind === 'podatus' ? [2, 3] : [3, 2];

  return {
    id: `neume-${id}`,
    kind,
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: `${id}-1`, staffPosition: staffPosition(positions[0]) },
      { id: `${id}-2`, staffPosition: staffPosition(positions[1]) },
    ],
  };
}

function documentWith(neumes: Neume[]): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes,
  };
}

function hypotheticalNeume(
  kind: GraphicalNeumeKind,
  positions: GraphicalStaffPositions,
): Neume {
  const [first, second, third] = positions;

  if (kind === 'punctum') {
    return {
      id: 'inserted-neume',
      kind,
      lyricSyllableId: 'syllable-1',
      notes: [{ id: 'inserted-1', staffPosition: first }],
    };
  }

  if (second === undefined) {
    throw new Error('Missing second position');
  }

  if (kind === 'scandicus' || kind === 'torculus') {
    if (third === undefined) {
      throw new Error('Missing third position');
    }

    return {
      id: 'inserted-neume',
      kind,
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'inserted-1', staffPosition: first },
        { id: 'inserted-2', staffPosition: second },
        { id: 'inserted-3', staffPosition: third },
      ],
    };
  }

  return {
    id: 'inserted-neume',
    kind,
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: 'inserted-1', staffPosition: first },
      { id: 'inserted-2', staffPosition: second },
    ],
  };
}

function previewInput(
  kind: GraphicalNeumeKind,
  positions: GraphicalStaffPositions,
  insertionIndex: number,
): GraphicalPlacementPreviewInput {
  const [first, second, third] = positions;

  switch (kind) {
    case 'punctum':
      return {
        kind,
        staffPositions: [first],
        insertionIndex,
      };
    case 'podatus':
    case 'clivis':
      if (second === undefined) {
        throw new Error('Missing second position');
      }

      return {
        kind,
        staffPositions: [first, second],
        insertionIndex,
      };
    case 'scandicus':
    case 'torculus':
      if (second === undefined || third === undefined) {
        throw new Error('Missing three-note positions');
      }

      return {
        kind,
        staffPositions: [first, second, third],
        insertionIndex,
      };
  }
}

function expectPreviewMatchesCommitted(
  existing: Neume[],
  insertionIndex: number,
  kind: GraphicalNeumeKind,
  positions: GraphicalStaffPositions,
) {
  const preview = layoutGraphicalPlacementPreview(
    existing,
    previewInput(kind, positions, insertionIndex),
  );
  const inserted = hypotheticalNeume(kind, positions);
  const committed = layoutChant(
    documentWith([
      ...existing.slice(0, insertionIndex),
      inserted,
      ...existing.slice(insertionIndex),
    ]),
  ).systems.flatMap((system) => system.neumes)[insertionIndex];

  expect(preview?.notes).toEqual(
    committed?.notes.map(({ noteId: _noteId, ...geometry }) => geometry),
  );
  expect(preview?.connectors).toEqual(committed?.connectors);
  expect(preview && 'connector' in preview).toBe(false);
}

describe('graphical placement preview layout', () => {
  it.each([
    {
      name: 'beginning',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 0,
    },
    {
      name: 'middle',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 1,
    },
    {
      name: 'final',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 2,
    },
    {
      name: 'empty document',
      existing: [],
      insertionIndex: 0,
    },
  ])(
    'matches committed Punctum geometry at the $name boundary',
    ({ existing, insertionIndex }) => {
      expectPreviewMatchesCommitted(existing, insertionIndex, 'punctum', [
        staffPosition(4),
      ]);
    },
  );

  it.each([
    {
      name: 'beginning',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 0,
    },
    {
      name: 'middle',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 1,
    },
    {
      name: 'end',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 2,
    },
  ])(
    'matches committed Torculus geometry at the $name boundary',
    ({ existing, insertionIndex }) => {
      const positions = [
        staffPosition(2),
        staffPosition(4),
        staffPosition(3),
      ] as const;

      expectPreviewMatchesCommitted(
        existing,
        insertionIndex,
        'torculus',
        positions,
      );

      const preview = layoutGraphicalPlacementPreview(existing, {
        kind: 'torculus',
        staffPositions: positions,
        insertionIndex,
      });
      const [first, second, third] = preview?.notes ?? [];

      if (!preview || !first || !second || !third) {
        throw new Error('Missing Torculus preview');
      }

      const [ascendingConnector, descendingConnector] = preview.connectors;

      if (!ascendingConnector || !descendingConnector) {
        throw new Error('Missing Torculus connectors');
      }

      expect(preview.notes).toHaveLength(3);
      expect(preview.connectors).toHaveLength(2);
      expect(preview.connectors[0]).toEqual(
        expect.objectContaining({
          y1: first.y + first.height / 2,
          y2: second.y + second.height / 2,
        }),
      );
      expect(preview.connectors[1]).toEqual(
        expect.objectContaining({
          y1: second.y + second.height / 2,
          y2: third.y + third.height / 2,
        }),
      );
      expect(ascendingConnector.y2).toBeLessThan(ascendingConnector.y1);
      expect(descendingConnector.y2).toBeGreaterThan(descendingConnector.y1);
    },
  );

  it.each([
    {
      name: 'beginning',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 0,
    },
    {
      name: 'middle',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 1,
    },
    {
      name: 'end',
      existing: [punctum('one'), punctum('two')],
      insertionIndex: 2,
    },
  ])(
    'matches committed Scandicus geometry at the $name boundary',
    ({ existing, insertionIndex }) => {
      const positions = [
        staffPosition(2),
        staffPosition(3),
        staffPosition(4),
      ] as const;

      expectPreviewMatchesCommitted(
        existing,
        insertionIndex,
        'scandicus',
        positions,
      );

      const preview = layoutGraphicalPlacementPreview(existing, {
        kind: 'scandicus',
        staffPositions: positions,
        insertionIndex,
      });
      const first = preview?.notes[0];
      const second = preview?.notes[1];
      const third = preview?.notes[2];

      if (!first || !second || !third || !preview) {
        throw new Error('Missing Scandicus preview');
      }

      expect(preview.notes).toHaveLength(3);
      expect(preview.connectors).toHaveLength(2);
      expect(second.x - first.x).toBe(12);
      expect(third.x - second.x).toBe(12);
      expect(preview.connectors[0]).toEqual(
        expect.objectContaining({
          y1: first.y + first.height / 2,
          y2: second.y + second.height / 2,
        }),
      );
      expect(preview.connectors[1]).toEqual(
        expect.objectContaining({
          y1: second.y + second.height / 2,
          y2: third.y + third.height / 2,
        }),
      );
    },
  );

  it.each([
    {
      kind: 'podatus' as const,
      positions: [staffPosition(2), staffPosition(4)] as const,
    },
    {
      kind: 'clivis' as const,
      positions: [staffPosition(5), staffPosition(3)] as const,
    },
  ])(
    'matches committed $kind note and connector geometry',
    ({ kind, positions }) => {
      expectPreviewMatchesCommitted(
        [punctum('before'), punctum('after')],
        1,
        kind,
        positions,
      );

      const preview = layoutGraphicalPlacementPreview([punctum('before')], {
        kind,
        staffPositions: positions,
        insertionIndex: 1,
      });
      const first = preview?.notes[0];
      const second = preview?.notes[1];

      if (!first || !second) {
        throw new Error('Missing preview notes');
      }

      expect(second.x - first.x).toBe(12);
    },
  );

  it('uses only whole-neume boundary centers around compact neumes', () => {
    const neumes = [
      existingTwoNote('podatus', 'podatus'),
      existingTwoNote('clivis', 'clivis'),
    ];
    const layout = layoutChant(documentWith(neumes));

    expect(getNeumeBoundaryCenterX(neumes, 0)).toBe(
      layout.systems.flatMap((system) => system.neumes)[0]?.notes[0]?.x + 7.5,
    );
    expect(getNeumeBoundaryCenterX(neumes, 1)).toBe(
      layout.systems.flatMap((system) => system.neumes)[1]?.notes[0]?.x + 7.5,
    );
    expect(getNeumeBoundaryCenterX(neumes, 2)).toBeGreaterThan(
      layout.systems.flatMap((system) => system.neumes)[1]?.notes[1]?.x ?? 0,
    );
  });

  it('contains geometry and kind only, without semantic or UI identity', () => {
    const preview = layoutGraphicalPlacementPreview([], {
      kind: 'podatus',
      staffPositions: [staffPosition(2), staffPosition(3)],
      insertionIndex: 0,
    });

    if (!preview) {
      throw new Error('Missing preview');
    }

    const forbiddenKeys = [
      'id',
      'noteId',
      'neumeId',
      'lyricSyllableId',
      'selection',
      'selected',
      'focus',
      'focused',
    ];
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') {
        return;
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        expect(forbiddenKeys).not.toContain(key);
        visit(nestedValue);
      }
    };

    visit(preview);
  });

  it('rejects non-boundary indexes', () => {
    expect(
      layoutGraphicalPlacementPreview([punctum('one')], {
        kind: 'punctum',
        staffPositions: [staffPosition(2)],
        insertionIndex: 2,
      }),
    ).toBeNull();
  });

  it('preserves exact staff-position y geometry off the staff', () => {
    const positions: readonly [StaffPosition, StaffPosition] = [
      staffPosition(7),
      staffPosition(8),
    ];

    expectPreviewMatchesCommitted([], 0, 'podatus', positions);
    expectPreviewMatchesCommitted([], 0, 'scandicus', [
      staffPosition(7),
      staffPosition(8),
      staffPosition(9),
    ]);
    expectPreviewMatchesCommitted([], 0, 'scandicus', [
      staffPosition(-1),
      staffPosition(0),
      staffPosition(1),
    ]);
    expectPreviewMatchesCommitted([], 0, 'torculus', [
      staffPosition(7),
      staffPosition(9),
      staffPosition(8),
    ]);
  });
});
