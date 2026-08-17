import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type PunctumNeume,
  type TorculusNeume,
} from '../domain/chant-document';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { layoutChant } from '../layout/layout-chant';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history';
import { insertTorculus } from './insert-torculus';

function punctum(id: string, syllableId: string): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: syllableId,
    notes: [{ id: `note-${id}`, staffPosition: staffPosition(2) }],
  };
}

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'syllable-2', text: 'ri-' },
    ],
    neumes: [punctum('before', 'syllable-1'), punctum('after', 'syllable-2')],
  };
}

function torculus(
  positions: readonly [number, number, number] = [2, 4, 3],
): TorculusNeume {
  return {
    id: 'neume-torculus',
    kind: 'torculus',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: 'note-torculus-1', staffPosition: staffPosition(positions[0]) },
      { id: 'note-torculus-2', staffPosition: staffPosition(positions[1]) },
      { id: 'note-torculus-3', staffPosition: staffPosition(positions[2]) },
    ],
  };
}

describe('insertTorculus', () => {
  it.each([
    { index: 0, ids: ['neume-torculus', 'neume-before', 'neume-after'] },
    { index: 1, ids: ['neume-before', 'neume-torculus', 'neume-after'] },
    { index: 2, ids: ['neume-before', 'neume-after', 'neume-torculus'] },
  ])('inserts one complete Torculus at boundary $index', ({ index, ids }) => {
    const document = createDocument();
    const candidate = torculus([2, 5, 3]);
    const inserted = insertTorculus(document, candidate, index);

    expect(inserted.neumes.map((neume) => neume.id)).toEqual(ids);
    expect(inserted.neumes[index]).toBe(candidate);
    expect(
      inserted.neumes[index]?.notes.map((note) => note.staffPosition),
    ).toEqual([2, 5, 3]);
    expect(inserted.neumes[index]?.lyricSyllableId).toBe('syllable-1');
    expect(inserted.syllables).toBe(document.syllables);
  });

  it.each<{
    name: string;
    index: number;
    candidate: TorculusNeume;
  }>([
    { name: 'negative boundary', index: -1, candidate: torculus() },
    { name: 'past-end boundary', index: 3, candidate: torculus() },
    { name: 'fractional boundary', index: 1.5, candidate: torculus() },
    {
      name: 'missing syllable',
      index: 1,
      candidate: { ...torculus(), lyricSyllableId: 'missing' },
    },
    { name: 'flat first pair', index: 1, candidate: torculus([2, 2, 1]) },
    { name: 'reversed first pair', index: 1, candidate: torculus([3, 2, 1]) },
    { name: 'flat second pair', index: 1, candidate: torculus([2, 4, 4]) },
    { name: 'reversed second pair', index: 1, candidate: torculus([2, 4, 5]) },
    {
      name: 'duplicate neume ID',
      index: 1,
      candidate: { ...torculus(), id: 'neume-before' },
    },
    {
      name: 'duplicate candidate note IDs',
      index: 1,
      candidate: {
        ...torculus(),
        notes: [
          torculus().notes[0],
          { ...torculus().notes[1], id: 'note-torculus-1' },
          torculus().notes[2],
        ],
      },
    },
    {
      name: 'existing note ID collision',
      index: 1,
      candidate: {
        ...torculus(),
        notes: [
          { ...torculus().notes[0], id: 'note-before' },
          torculus().notes[1],
          torculus().notes[2],
        ],
      },
    },
  ])('returns the original document for $name', ({ index, candidate }) => {
    const document = createDocument();

    expect(insertTorculus(document, candidate, index)).toBe(document);
  });

  it('creates one history entry with identity-preserving undo and redo', () => {
    const document = createDocument();
    const candidate = torculus();
    const inserted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => insertTorculus(current, candidate, 1),
    );
    const undone = undoDocumentEdit(inserted);
    const redone = redoDocumentEdit(undone);

    expect(inserted.past).toEqual([document]);
    expect(inserted.present.neumes[1]).toBe(candidate);
    expect(undone.present).toBe(document);
    expect(redone.present).toBe(inserted.present);
    expect(redone.present.neumes[1]).toBe(candidate);
  });

  it('commits the resolved graphical contour in semantic order', () => {
    const document = createDocument();
    const layout = layoutChant(document);
    const bottomStaffY = Math.max(
      ...(layout.systems[0]?.staffLines.map((line) => line.y) ?? []),
    );
    const placement = resolveGraphicalNeumePlacement(
      document,
      layout,
      'syllable-1',
      'torculus',
      { x: 300, y: bottomStaffY - 24 },
    );

    if (!placement || placement.kind !== 'torculus') {
      throw new Error('Missing graphical Torculus placement');
    }

    const [first, second, third] = placement.staffPositions;
    const candidate: TorculusNeume = {
      id: 'graphical-torculus',
      kind: 'torculus',
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'graphical-first', staffPosition: first },
        { id: 'graphical-second', staffPosition: second },
        { id: 'graphical-third', staffPosition: third },
      ],
    };
    const inserted = insertTorculus(
      document,
      candidate,
      placement.insertionIndex,
    );
    const edited = applyDocumentEdit(
      createDocumentHistory(document),
      () => inserted,
    );
    const undone = undoDocumentEdit(edited);
    const redone = redoDocumentEdit(undone);

    expect(candidate.notes.map((note) => note.staffPosition)).toEqual([
      2, 4, 3,
    ]);
    expect(placement.insertionIndex).toBe(1);
    expect(inserted.neumes[placement.insertionIndex]).toBe(candidate);
    expect(edited.past).toEqual([document]);
    expect(edited.present.neumes[placement.insertionIndex]).toBe(candidate);
    expect(undone.present).toBe(document);
    expect(redone.present).toBe(edited.present);
    expect(redone.present.neumes[placement.insertionIndex]).toBe(candidate);
  });

  it('does not create history for a rejected insertion', () => {
    const history = createDocumentHistory(createDocument());

    expect(
      applyDocumentEdit(history, (document) =>
        insertTorculus(document, torculus([2, 2, 1]), 1),
      ),
    ).toBe(history);
  });
});
