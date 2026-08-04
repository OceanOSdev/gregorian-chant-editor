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
import { layoutChant } from '../layout/layout-chant';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history';
import { deleteNote } from './delete-note';

const punctum: PunctumNeume = {
  id: 'neume-punctum',
  kind: 'punctum',
  lyricSyllableId: 'syllable-alone',
  notes: [{ id: 'note-punctum', staffPosition: staffPosition(2) }],
};
const podatus: PodatusNeume = {
  id: 'neume-podatus',
  kind: 'podatus',
  lyricSyllableId: 'syllable-shared',
  notes: [
    { id: 'note-podatus-1', staffPosition: staffPosition(2) },
    { id: 'note-podatus-2', staffPosition: staffPosition(4) },
  ],
};
const clivis: ClivisNeume = {
  id: 'neume-clivis',
  kind: 'clivis',
  lyricSyllableId: 'syllable-shared',
  notes: [
    { id: 'note-clivis-1', staffPosition: staffPosition(5) },
    { id: 'note-clivis-2', staffPosition: staffPosition(3) },
  ],
};
const scandicus: ScandicusNeume = {
  id: 'neume-scandicus',
  kind: 'scandicus',
  lyricSyllableId: 'syllable-shared',
  notes: [
    { id: 'note-scandicus-1', staffPosition: staffPosition(1) },
    { id: 'note-scandicus-2', staffPosition: staffPosition(3) },
    { id: 'note-scandicus-3', staffPosition: staffPosition(6) },
  ],
};

function createDocument(): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'syllable-alone', text: 'Ky-' },
      { id: 'syllable-shared', text: 'ri-' },
    ],
    neumes: [punctum, podatus, clivis, scandicus],
  };
}

function torculusDocument(
  positions: readonly [number, number, number],
): ChantDocument {
  const torculus: TorculusNeume = {
    id: 'neume-torculus',
    kind: 'torculus',
    lyricSyllableId: 'syllable-shared',
    notes: [
      { id: 'note-torculus-1', staffPosition: staffPosition(positions[0]) },
      { id: 'note-torculus-2', staffPosition: staffPosition(positions[1]) },
      { id: 'note-torculus-3', staffPosition: staffPosition(positions[2]) },
    ],
  };

  return { ...createDocument(), neumes: [punctum, torculus] };
}

describe('deleteNote', () => {
  it('removes the neume when its final punctum note is deleted', () => {
    const deleted = deleteNote(createDocument(), 'note-punctum');

    expect(deleted.neumes.map((neume) => neume.id)).toEqual([
      'neume-podatus',
      'neume-clivis',
      'neume-scandicus',
    ]);
    expect(deleted.syllables).toHaveLength(2);
  });

  it.each([
    {
      noteId: 'note-podatus-1',
      neumeId: 'neume-podatus',
      survivor: 'note-podatus-2',
      survivorPosition: 4,
    },
    {
      noteId: 'note-podatus-2',
      neumeId: 'neume-podatus',
      survivor: 'note-podatus-1',
      survivorPosition: 2,
    },
    {
      noteId: 'note-clivis-1',
      neumeId: 'neume-clivis',
      survivor: 'note-clivis-2',
      survivorPosition: 3,
    },
    {
      noteId: 'note-clivis-2',
      neumeId: 'neume-clivis',
      survivor: 'note-clivis-1',
      survivorPosition: 5,
    },
  ])(
    'normalizes a two-note neume to punctum and preserves identities',
    ({ noteId, neumeId, survivor, survivorPosition }) => {
      const document = createDocument();
      const originalIndex = document.neumes.findIndex(
        (neume) => neume.id === neumeId,
      );
      const survivorNote = document.neumes[originalIndex]?.notes.find(
        (note) => note.id === survivor,
      );
      const deleted = deleteNote(document, noteId);
      const normalized = deleted.neumes.find((neume) => neume.id === neumeId);

      expect(deleted.neumes[originalIndex]).toBe(normalized);
      expect(normalized).toMatchObject({
        id: neumeId,
        kind: 'punctum',
        lyricSyllableId: 'syllable-shared',
      });
      expect(normalized?.notes[0]).toBe(survivorNote);
      expect(normalized?.notes[0]).toMatchObject({
        id: survivor,
        staffPosition: survivorPosition,
      });
    },
  );

  it.each([
    {
      deletedNoteId: 'note-torculus-1',
      kind: 'clivis',
      survivingIds: ['note-torculus-2', 'note-torculus-3'],
    },
    {
      deletedNoteId: 'note-torculus-3',
      kind: 'podatus',
      survivingIds: ['note-torculus-1', 'note-torculus-2'],
    },
  ] as const)(
    'normalizes Torculus to $kind after deleting $deletedNoteId',
    ({ deletedNoteId, kind, survivingIds }) => {
      const document = torculusDocument([2, 5, 3]);
      const original = document.neumes[1];
      const deleted = deleteNote(document, deletedNoteId);
      const normalized = deleted.neumes[1];

      expect(normalized).toMatchObject({
        id: 'neume-torculus',
        kind,
        lyricSyllableId: 'syllable-shared',
      });
      expect(normalized?.notes.map((note) => note.id)).toEqual(survivingIds);
      expect(normalized?.notes[0]).toBe(
        original?.notes.find((note) => note.id === survivingIds[0]),
      );
      expect(deleted.neumes[0]).toBe(document.neumes[0]);
    },
  );

  it.each([
    { positions: [2, 5, 3] as const, kind: 'podatus' },
    { positions: [4, 5, 2] as const, kind: 'clivis' },
  ])(
    'normalizes middle-note deletion with unequal outer notes to $kind',
    ({ positions, kind }) => {
      const document = torculusDocument(positions);
      const original = document.neumes[1];
      const deleted = deleteNote(document, 'note-torculus-2');

      expect(deleted.neumes[1]).toMatchObject({ kind });
      expect(deleted.neumes[1]?.notes).toEqual([
        original?.notes[0],
        original?.notes[2],
      ]);
    },
  );

  it('rejects equal-outer middle deletion without document or history changes', () => {
    const document = torculusDocument([2, 5, 2]);
    const history = createDocumentHistory(document);

    expect(deleteNote(document, 'note-torculus-2')).toBe(document);
    expect(
      applyDocumentEdit(history, (current) =>
        deleteNote(current, 'note-torculus-2'),
      ),
    ).toBe(history);
  });

  it.each([
    {
      deletedNoteId: 'note-scandicus-1',
      survivingIds: ['note-scandicus-2', 'note-scandicus-3'],
    },
    {
      deletedNoteId: 'note-scandicus-2',
      survivingIds: ['note-scandicus-1', 'note-scandicus-3'],
    },
    {
      deletedNoteId: 'note-scandicus-3',
      survivingIds: ['note-scandicus-1', 'note-scandicus-2'],
    },
  ])(
    'normalizes Scandicus after deleting $deletedNoteId',
    ({ deletedNoteId, survivingIds }) => {
      const document = createDocument();
      const originalSurvivors = scandicus.notes.filter((note) =>
        survivingIds.includes(note.id),
      );
      const deleted = applyDocumentEdit(
        createDocumentHistory(document),
        (current) => deleteNote(current, deletedNoteId),
      );
      const normalized = deleted.present.neumes[3];
      const undone = undoDocumentEdit(deleted);
      const redone = redoDocumentEdit(undone);

      expect(deleted.past).toHaveLength(1);
      expect(normalized).toMatchObject({
        id: 'neume-scandicus',
        kind: 'podatus',
        lyricSyllableId: 'syllable-shared',
      });
      expect(normalized?.notes.map((note) => note.id)).toEqual(survivingIds);
      expect(normalized?.notes[0]).toBe(originalSurvivors[0]);
      expect(normalized?.notes[1]).toBe(originalSurvivors[1]);
      expect(undone.present.neumes[3]).toBe(scandicus);
      expect(redone.present.neumes[3]).toBe(normalized);
    },
  );

  it('preserves unrelated references and does not mutate the input', () => {
    const document = createDocument();
    const deleted = deleteNote(document, 'note-podatus-1');

    expect(deleted.neumes[0]).toBe(document.neumes[0]);
    expect(deleted.neumes[2]).toBe(document.neumes[2]);
    expect(deleted.neumes).not.toBe(document.neumes);
    expect(document.neumes[1]?.kind).toBe('podatus');
  });

  it('returns the original document for an unknown note', () => {
    const document = createDocument();

    expect(deleteNote(document, 'unknown')).toBe(document);
  });

  it('updates lyric layout according to remaining associated notes', () => {
    const withoutAlone = layoutChant(
      deleteNote(createDocument(), 'note-punctum'),
    );
    const normalizedShared = layoutChant(
      deleteNote(createDocument(), 'note-podatus-1'),
    );

    expect(
      withoutAlone.systems
        .flatMap((system) => system.lyrics)
        .some((lyric) => lyric.syllableId === 'syllable-alone'),
    ).toBe(false);
    expect(
      normalizedShared.systems
        .flatMap((system) => system.lyrics)
        .filter((lyric) => lyric.syllableId === 'syllable-shared'),
    ).toHaveLength(1);
  });

  it('undoes and redoes normalized deletion', () => {
    const document = createDocument();
    const deleted = applyDocumentEdit(
      createDocumentHistory(document),
      (current) => deleteNote(current, 'note-podatus-1'),
    );
    const undone = undoDocumentEdit(deleted);
    const redone = redoDocumentEdit(undone);

    expect(undone.present.neumes[1]?.kind).toBe('podatus');
    expect(undone.present.neumes[1]?.notes).toHaveLength(2);
    expect(redone.present.neumes[1]?.kind).toBe('punctum');
    expect(redone.present.neumes[1]?.notes[0]?.id).toBe('note-podatus-2');
  });

  it.each([
    { deletedNoteId: 'note-clivis-1', survivingNoteId: 'note-clivis-2' },
    { deletedNoteId: 'note-clivis-2', survivingNoteId: 'note-clivis-1' },
  ])(
    'undoes and redoes Clivis normalization after deleting $deletedNoteId',
    ({ deletedNoteId, survivingNoteId }) => {
      const document = createDocument();
      const deleted = applyDocumentEdit(
        createDocumentHistory(document),
        (current) => deleteNote(current, deletedNoteId),
      );
      const undone = undoDocumentEdit(deleted);
      const redone = redoDocumentEdit(undone);

      expect(undone.present.neumes[2]).toBe(clivis);
      expect(redone.present.neumes[2]).toMatchObject({
        id: 'neume-clivis',
        kind: 'punctum',
        lyricSyllableId: 'syllable-shared',
      });
      expect(redone.present.neumes[2]?.notes[0]?.id).toBe(survivingNoteId);
      expect(redone.present.neumes[0]).toBe(document.neumes[0]);
      expect(redone.present.neumes[1]).toBe(document.neumes[1]);
    },
  );
});
