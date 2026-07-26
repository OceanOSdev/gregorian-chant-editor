import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type PunctumNeume,
  type ScandicusNeume,
} from '../domain/chant-document';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { layoutChant } from '../layout/layout-chant';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history';
import { insertScandicus } from './insert-scandicus';

function punctum(id: string, syllableId = 'syllable-1'): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum' as const,
    lyricSyllableId: syllableId,
    notes: [{ id, staffPosition: staffPosition(2) }],
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

function scandicus(
  positions: readonly [number, number, number] = [2, 3, 4],
): ScandicusNeume {
  return {
    id: 'neume-scandicus',
    kind: 'scandicus',
    lyricSyllableId: 'syllable-1',
    notes: [
      { id: 'note-scandicus-1', staffPosition: staffPosition(positions[0]) },
      { id: 'note-scandicus-2', staffPosition: staffPosition(positions[1]) },
      { id: 'note-scandicus-3', staffPosition: staffPosition(positions[2]) },
    ],
  };
}

describe('insertScandicus', () => {
  it.each([
    { index: 0, ids: ['neume-scandicus', 'neume-before', 'neume-after'] },
    { index: 1, ids: ['neume-before', 'neume-scandicus', 'neume-after'] },
    { index: 2, ids: ['neume-before', 'neume-after', 'neume-scandicus'] },
  ])('inserts one complete Scandicus at boundary $index', ({ index, ids }) => {
    const candidate = scandicus();
    const inserted = insertScandicus(createDocument(), candidate, index);

    expect(inserted.neumes.map((neume) => neume.id)).toEqual(ids);
    expect(inserted.neumes[index]).toBe(candidate);
    expect(inserted.neumes[index]).toMatchObject({
      kind: 'scandicus',
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'note-scandicus-1', staffPosition: 2 },
        { id: 'note-scandicus-2', staffPosition: 3 },
        { id: 'note-scandicus-3', staffPosition: 4 },
      ],
    });
  });

  it.each<{
    name: string;
    index: number;
    candidate: ScandicusNeume;
  }>([
    { name: 'negative boundary', index: -1, candidate: scandicus() },
    { name: 'past-end boundary', index: 3, candidate: scandicus() },
    { name: 'fractional boundary', index: 1.5, candidate: scandicus() },
    {
      name: 'missing syllable',
      index: 1,
      candidate: { ...scandicus(), lyricSyllableId: 'missing' },
    },
    { name: 'equal first pair', index: 1, candidate: scandicus([2, 2, 4]) },
    { name: 'equal second pair', index: 1, candidate: scandicus([2, 4, 4]) },
    { name: 'reversed contour', index: 1, candidate: scandicus([2, 5, 4]) },
    {
      name: 'duplicate neume ID',
      index: 1,
      candidate: { ...scandicus(), id: 'neume-before' },
    },
    {
      name: 'duplicate candidate note IDs',
      index: 1,
      candidate: {
        ...scandicus(),
        notes: [
          scandicus().notes[0],
          { ...scandicus().notes[1], id: 'note-scandicus-1' },
          scandicus().notes[2],
        ],
      },
    },
    {
      name: 'existing note ID collision',
      index: 1,
      candidate: {
        ...scandicus(),
        notes: [
          { ...scandicus().notes[0], id: 'before' },
          scandicus().notes[1],
          scandicus().notes[2],
        ],
      },
    },
  ])('returns the original document for $name', ({ index, candidate }) => {
    const document = createDocument();

    expect(insertScandicus(document, candidate, index)).toBe(document);
  });

  it('creates one history entry with atomic identity-preserving undo and redo', () => {
    const document = createDocument();
    const candidate = scandicus([2, 4, 7]);
    const inserted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => insertScandicus(current, candidate, 1),
    );
    const undone = undoDocumentEdit(inserted);
    const redone = redoDocumentEdit(undone);

    expect(inserted.past).toEqual([document]);
    expect(inserted.present.neumes[1]).toBe(candidate);
    expect(undone.present).toBe(document);
    expect(redone.present).toBe(inserted.present);
    expect(redone.present.neumes[1]).toBe(candidate);
  });

  it('applies one canonically resolved graphical Scandicus with stable identity', () => {
    const document = createDocument();
    const layout = layoutChant(document);
    const staffLine = layout.systems[0]?.staffLines[0];
    const bottomStaffY = Math.max(
      ...layout.systems[0]?.staffLines.map((line) => line.y),
    );

    if (!staffLine) {
      throw new Error('Missing staff geometry');
    }

    const placement = resolveGraphicalNeumePlacement(
      document,
      layout,
      'syllable-1',
      'scandicus',
      { x: staffLine.x2, y: bottomStaffY - 24 },
    );

    if (!placement || placement.kind !== 'scandicus') {
      throw new Error('Missing graphical Scandicus placement');
    }

    const [first, second, third] = placement.staffPositions;
    const candidate: ScandicusNeume = {
      id: 'graphical-scandicus',
      kind: 'scandicus',
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'graphical-first', staffPosition: first },
        { id: 'graphical-second', staffPosition: second },
        { id: 'graphical-third', staffPosition: third },
      ],
    };
    const acceptedDocument = insertScandicus(
      document,
      candidate,
      placement.insertionIndex,
    );
    const edited = applyDocumentEdit(
      createDocumentHistory(document),
      () => acceptedDocument,
    );
    const undone = undoDocumentEdit(edited);
    const redone = redoDocumentEdit(undone);
    const restored = redone.present.neumes[placement.insertionIndex];

    expect(edited.past).toEqual([document]);
    expect(restored).toEqual({
      id: 'graphical-scandicus',
      kind: 'scandicus',
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'graphical-first', staffPosition: 2 },
        { id: 'graphical-second', staffPosition: 3 },
        { id: 'graphical-third', staffPosition: 4 },
      ],
    });
    expect(undone.present).toBe(document);
    expect(redone.present).toBe(edited.present);
    expect(restored).toBe(candidate);
  });

  it('does not create history for a rejected insertion', () => {
    const history = createDocumentHistory(createDocument());

    expect(
      applyDocumentEdit(history, (document) =>
        insertScandicus(document, scandicus(), -1),
      ),
    ).toBe(history);
  });
});
