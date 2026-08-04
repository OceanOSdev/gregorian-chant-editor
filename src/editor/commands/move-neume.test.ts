import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ClivisNeume,
  type PodatusNeume,
  type PunctumNeume,
  type ScandicusNeume,
  type TorculusNeume,
} from '../domain/chant-document';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history';
import { moveNeumeVertically } from './move-neume';

const punctum: PunctumNeume = {
  id: 'neume-punctum',
  kind: 'punctum',
  lyricSyllableId: 'syllable-1',
  notes: [{ id: 'note-punctum', staffPosition: staffPosition(3) }],
};
const podatus: PodatusNeume = {
  id: 'neume-podatus',
  kind: 'podatus',
  lyricSyllableId: 'syllable-1',
  notes: [
    { id: 'note-podatus-1', staffPosition: staffPosition(2) },
    { id: 'note-podatus-2', staffPosition: staffPosition(5) },
  ],
};
const clivis: ClivisNeume = {
  id: 'neume-clivis',
  kind: 'clivis',
  lyricSyllableId: 'syllable-2',
  notes: [
    { id: 'note-clivis-1', staffPosition: staffPosition(6) },
    { id: 'note-clivis-2', staffPosition: staffPosition(4) },
  ],
};
const scandicus: ScandicusNeume = {
  id: 'neume-scandicus',
  kind: 'scandicus',
  lyricSyllableId: 'syllable-1',
  notes: [
    { id: 'note-scandicus-1', staffPosition: staffPosition(1) },
    { id: 'note-scandicus-2', staffPosition: staffPosition(3) },
    { id: 'note-scandicus-3', staffPosition: staffPosition(6) },
  ],
};
const torculus: TorculusNeume = {
  id: 'neume-torculus',
  kind: 'torculus',
  lyricSyllableId: 'syllable-2',
  notes: [
    { id: 'note-torculus-1', staffPosition: staffPosition(2) },
    { id: 'note-torculus-2', staffPosition: staffPosition(5) },
    { id: 'note-torculus-3', staffPosition: staffPosition(3) },
  ],
};

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'syllable-2', text: 'ri-' },
    ],
    neumes: [punctum, podatus, clivis, scandicus, torculus],
  };
}

function positions(document: ChantDocument, neumeIndex: number): number[] {
  return (
    document.neumes[neumeIndex]?.notes.map((note) => note.staffPosition) ?? []
  );
}

describe('moveNeumeVertically', () => {
  it.each([
    { delta: 1, expected: 4 },
    { delta: -1, expected: 2 },
  ])('moves a punctum by $delta', ({ delta, expected }) => {
    const moved = moveNeumeVertically(createDocument(), 'neume-punctum', delta);

    expect(moved.neumes[0]).toMatchObject({
      id: 'neume-punctum',
      kind: 'punctum',
      notes: [{ id: 'note-punctum', staffPosition: expected }],
    });
  });

  it('allows a punctum to move beyond the visible staff', () => {
    const document: ChantDocument = {
      ...createDocument(),
      neumes: [
        {
          ...punctum,
          notes: [
            {
              ...punctum.notes[0],
              staffPosition: staffPosition(6),
            },
          ],
        },
      ],
    };

    expect(
      moveNeumeVertically(document, 'neume-punctum', 5).neumes[0]?.notes[0]
        ?.staffPosition,
    ).toBe(11);
    expect(
      moveNeumeVertically(document, 'neume-punctum', -10).neumes[0]?.notes[0]
        ?.staffPosition,
    ).toBe(-4);
  });

  it.each([
    { delta: 1, expected: [3, 6] },
    { delta: -1, expected: [1, 4] },
  ])(
    'moves every Podatus note by $delta and preserves its interval',
    ({ delta, expected }) => {
      const document = createDocument();
      const moved = moveNeumeVertically(document, 'neume-podatus', delta);
      const movedPodatus = moved.neumes[1];

      expect(positions(moved, 1)).toEqual(expected);
      expect(
        (movedPodatus?.notes[1]?.staffPosition ?? 0) -
          (movedPodatus?.notes[0]?.staffPosition ?? 0),
      ).toBe(3);
      expect(movedPodatus).toMatchObject({
        id: 'neume-podatus',
        kind: 'podatus',
        lyricSyllableId: 'syllable-1',
      });
      expect(movedPodatus?.notes.map((note) => note.id)).toEqual([
        'note-podatus-1',
        'note-podatus-2',
      ]);
      expect(
        (movedPodatus?.notes[1]?.staffPosition ?? 0) >
          (movedPodatus?.notes[0]?.staffPosition ?? 0),
      ).toBe(true);
    },
  );

  it.each([
    { delta: 1, expected: [7, 5] },
    { delta: -1, expected: [5, 3] },
  ])(
    'moves every Clivis note by $delta and preserves its interval',
    ({ delta, expected }) => {
      const document = createDocument();
      const moved = moveNeumeVertically(document, 'neume-clivis', delta);
      const movedClivis = moved.neumes[2];

      expect(positions(moved, 2)).toEqual(expected);
      expect(
        (movedClivis?.notes[0]?.staffPosition ?? 0) -
          (movedClivis?.notes[1]?.staffPosition ?? 0),
      ).toBe(2);
      expect(movedClivis).toMatchObject({
        id: 'neume-clivis',
        kind: 'clivis',
        lyricSyllableId: 'syllable-2',
      });
      expect(movedClivis?.notes.map((note) => note.id)).toEqual([
        'note-clivis-1',
        'note-clivis-2',
      ]);
      expect(
        (movedClivis?.notes[0]?.staffPosition ?? 0) >
          (movedClivis?.notes[1]?.staffPosition ?? 0),
      ).toBe(true);
    },
  );

  it('preserves document identity fields and the neume array position', () => {
    const document = createDocument();
    const moved = moveNeumeVertically(document, 'neume-podatus', 1);

    expect(moved.title).toBe(document.title);
    expect(moved.clef).toBe(document.clef);
    expect(moved.syllables).toBe(document.syllables);
    expect(moved.neumes.map((neume) => neume.id)).toEqual(
      document.neumes.map((neume) => neume.id),
    );
    expect(moved.neumes[1]?.lyricSyllableId).toBe(
      document.neumes[1]?.lyricSyllableId,
    );
  });

  it('moves all Scandicus notes equally and preserves both intervals and IDs', () => {
    const document = createDocument();
    const moved = moveNeumeVertically(document, 'neume-scandicus', 1);
    const movedScandicus = moved.neumes[3];

    expect(positions(moved, 3)).toEqual([2, 4, 7]);
    expect(movedScandicus).toMatchObject({
      id: 'neume-scandicus',
      kind: 'scandicus',
      lyricSyllableId: 'syllable-1',
    });
    expect(movedScandicus?.notes.map((note) => note.id)).toEqual([
      'note-scandicus-1',
      'note-scandicus-2',
      'note-scandicus-3',
    ]);

    if (movedScandicus?.kind !== 'scandicus') {
      throw new Error('Missing moved Scandicus');
    }

    expect([
      movedScandicus.notes[1].staffPosition -
        movedScandicus.notes[0].staffPosition,
      movedScandicus.notes[2].staffPosition -
        movedScandicus.notes[1].staffPosition,
    ]).toEqual([2, 3]);
  });

  it('undoes and redoes a whole Scandicus move atomically', () => {
    const document = createDocument();
    const moved = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => moveNeumeVertically(current, 'neume-scandicus', -1),
    );
    const undone = undoDocumentEdit(moved);
    const redone = redoDocumentEdit(undone);

    expect(moved.past).toHaveLength(1);
    expect(positions(moved.present, 3)).toEqual([0, 2, 5]);
    expect(undone.present).toBe(document);
    expect(redone.present).toBe(moved.present);
  });

  it.each([
    { delta: 1, expected: [3, 6, 4] },
    { delta: -2, expected: [0, 3, 1] },
  ])(
    'moves a whole Torculus by $delta and preserves both intervals',
    ({ delta, expected }) => {
      const document = createDocument();
      const moved = moveNeumeVertically(document, 'neume-torculus', delta);
      const movedTorculus = moved.neumes[4];

      expect(positions(moved, 4)).toEqual(expected);
      expect(movedTorculus?.notes.map((note) => note.id)).toEqual([
        'note-torculus-1',
        'note-torculus-2',
        'note-torculus-3',
      ]);
      expect(moved.neumes[0]).toBe(document.neumes[0]);
      expect([
        (movedTorculus?.notes[1]?.staffPosition ?? 0) -
          (movedTorculus?.notes[0]?.staffPosition ?? 0),
        (movedTorculus?.notes[1]?.staffPosition ?? 0) -
          (movedTorculus?.notes[2]?.staffPosition ?? 0),
      ]).toEqual([3, 2]);
    },
  );

  it('undoes and redoes a whole Torculus move atomically', () => {
    const document = createDocument();
    const moved = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => moveNeumeVertically(current, 'neume-torculus', 1),
    );
    const undone = undoDocumentEdit(moved);
    const redone = redoDocumentEdit(undone);

    expect(positions(moved.present, 4)).toEqual([3, 6, 4]);
    expect(undone.present).toBe(document);
    expect(redone.present).toBe(moved.present);
  });

  it.each([
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects non-integer delta $delta before neume lookup', (delta) => {
    const document = createDocument();

    expect(() => moveNeumeVertically(document, 'unknown-neume', delta)).toThrow(
      TypeError,
    );
  });

  it('returns the original document for zero and an unknown neume', () => {
    const document = createDocument();

    expect(moveNeumeVertically(document, 'neume-podatus', 0)).toBe(document);
    expect(moveNeumeVertically(document, 'unknown-neume', 1)).toBe(document);
  });

  it.each([
    {
      kind: 'podatus' as const,
      notes: [
        { id: 'invalid-1', staffPosition: staffPosition(4) },
        { id: 'invalid-2', staffPosition: staffPosition(2) },
      ] as const,
    },
    {
      kind: 'clivis' as const,
      notes: [
        { id: 'invalid-1', staffPosition: staffPosition(2) },
        { id: 'invalid-2', staffPosition: staffPosition(4) },
      ] as const,
    },
  ])('does not translate or repair an invalid $kind', ({ kind, notes }) => {
    const document: ChantDocument = {
      ...createDocument(),
      neumes: [
        {
          id: 'invalid-neume',
          kind,
          lyricSyllableId: 'syllable-1',
          notes: [...notes],
        },
      ],
    };

    expect(moveNeumeVertically(document, 'invalid-neume', 1)).toBe(document);
  });

  it('uses structural sharing without mutating the input', () => {
    const document = createDocument();
    const originalPositions = positions(document, 1);
    const moved = moveNeumeVertically(document, 'neume-podatus', 1);

    expect(moved).not.toBe(document);
    expect(moved.neumes).not.toBe(document.neumes);
    expect(moved.neumes[1]).not.toBe(document.neumes[1]);
    expect(moved.neumes[1]?.notes).not.toBe(document.neumes[1]?.notes);
    expect(moved.neumes[1]?.notes[0]).not.toBe(document.neumes[1]?.notes[0]);
    expect(moved.neumes[1]?.notes[1]).not.toBe(document.neumes[1]?.notes[1]);
    expect(moved.syllables).toBe(document.syllables);
    expect(moved.syllables[0]).toBe(document.syllables[0]);
    expect(moved.clef).toBe(document.clef);
    expect(moved.neumes[0]).toBe(document.neumes[0]);
    expect(moved.neumes[2]).toBe(document.neumes[2]);
    expect(moved.neumes[2]?.notes[0]).toBe(document.neumes[2]?.notes[0]);
    expect(positions(document, 1)).toEqual(originalPositions);
  });

  it('creates one atomic history entry that undo and redo restore', () => {
    const document = createDocument();
    const history = createDocumentHistory(document);
    const movedHistory = applyDocumentEdit(history, (currentDocument) =>
      moveNeumeVertically(currentDocument, 'neume-podatus', 1),
    );
    const undoneHistory = undoDocumentEdit(movedHistory);
    const redoneHistory = redoDocumentEdit(undoneHistory);

    expect(movedHistory.past).toEqual([document]);
    expect(positions(movedHistory.present, 1)).toEqual([3, 6]);
    expect(positions(undoneHistory.present, 1)).toEqual([2, 5]);
    expect(positions(redoneHistory.present, 1)).toEqual([3, 6]);
  });

  it('does not create history for zero or rejected movement', () => {
    const document = createDocument();
    const history = createDocumentHistory(document);

    expect(
      applyDocumentEdit(history, (currentDocument) =>
        moveNeumeVertically(currentDocument, 'neume-podatus', 0),
      ),
    ).toBe(history);
    expect(
      applyDocumentEdit(history, (currentDocument) =>
        moveNeumeVertically(currentDocument, 'unknown-neume', 1),
      ),
    ).toBe(history);
  });
});
