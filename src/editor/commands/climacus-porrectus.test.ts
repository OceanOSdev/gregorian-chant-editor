import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ClimacusNeume,
  type PorrectusNeume,
  type Neume,
} from '../domain/chant-document';
import { isValidNeume } from '../domain/neume';
import {
  applyDocumentEdit,
  createDocumentHistory,
  undoDocumentEdit,
  redoDocumentEdit,
} from '../state/document-history';
import {
  reconcileSelection,
  selectNeume,
  selectNote,
} from '../state/selection';
import { getSurvivingFocusNoteId } from '../interaction/multi-system-editing';
import { insertClimacus } from './insert-climacus';
import { insertPorrectus } from './insert-porrectus';
import { moveNoteVertically } from './move-note';
import { moveNeumeVertically } from './move-neume';
import { deleteNote } from './delete-note';
import { deleteNeume } from './delete-neume';
import { resolveToolbarNeumeInsertion } from './resolve-toolbar-neume-insertion';

function documentWith(neumes: Neume[] = []): ChantDocument {
  return {
    title: 'Test',
    clef: { type: 'c', staffLine: 3 },
    syllables: neumes.length
      ? [
          {
            id: 'lyric',
            text: 'Ky',
            startsAtNeumeId: neumes[0].id,
            boundaryBefore: 'word',
          },
        ]
      : [],
    neumes,
  };
}
const cases = [
  {
    kind: 'climacus',
    pitches: [6, 3, 0],
    tight: [3, 2, 1],
    invalid: [
      [3, 3, 1],
      [3, 1, 1],
      [2, 3, 1],
      [3, 1, 2],
    ],
  },
  {
    kind: 'porrectus',
    pitches: [6, 0, 3],
    tight: [3, 2, 3],
    invalid: [
      [3, 3, 4],
      [3, 1, 1],
      [1, 3, 4],
      [3, 1, 0],
    ],
  },
] as const;

for (const { kind, pitches, tight, invalid } of cases) {
  function candidate(
    positions: readonly [number, number, number] = pitches,
  ): ClimacusNeume | PorrectusNeume {
    return {
      id: kind,
      kind,

      notes: [
        { id: 'first', staffPosition: staffPosition(positions[0]) },
        { id: 'second', staffPosition: staffPosition(positions[1]) },
        { id: 'third', staffPosition: staffPosition(positions[2]) },
      ],
    };
  }
  function insert(
    document: ChantDocument,
    neume: ClimacusNeume | PorrectusNeume,
    index: number,
  ) {
    return neume.kind === 'climacus'
      ? insertClimacus(document, neume, index)
      : insertPorrectus(document, neume, index);
  }
  const unrelated: Neume = {
    id: 'other',
    kind: 'punctum',
    notes: [{ id: 'other-note', staffPosition: staffPosition(2) }],
  };
  describe(`${kind} commands`, () => {
    it.each([0, 1])(
      'inserts at boundary %s with supplied identity and shared unrelated data',
      (index) => {
        const document = documentWith([unrelated]);
        const neume = candidate();
        const result = insert(document, neume, index);
        expect(result.neumes[index]).toBe(neume);
        expect(result.neumes[1 - index]).toBe(unrelated);
        expect(result.syllables).toBe(document.syllables);
        expect(document.neumes).toEqual([unrelated]);
      },
    );
    it('inserts at a middle boundary without changing either neighbor', () => {
      const tail: Neume = {
        ...unrelated,
        id: 'tail',
        notes: [{ ...unrelated.notes[0], id: 'tail-note' }],
      };
      const document = documentWith([unrelated, tail]);
      const neume = candidate();
      const inserted = insert(document, neume, 1);
      expect(inserted.neumes).toEqual([unrelated, neume, tail]);
      expect(inserted.neumes[0]).toBe(unrelated);
      expect(inserted.neumes[2]).toBe(tail);
    });
    it('rejects invalid indexes, syllables, IDs, cardinality, and contours without history', () => {
      const document = documentWith([unrelated]);
      const missingNote = candidate();
      missingNote.notes.pop();
      const extraNote = candidate();
      extraNote.notes.push({ id: 'fourth', staffPosition: staffPosition(-1) });
      const duplicate = candidate();
      duplicate.notes[1] = { ...duplicate.notes[1], id: 'first' };
      const collision = candidate();
      collision.notes[1] = { ...collision.notes[1], id: 'other-note' };
      const rejected = [
        { ...candidate(), id: 'other' },
        missingNote,
        extraNote,
        duplicate,
        collision,
        ...invalid.map((positions) => candidate(positions)),
      ];
      for (const neume of rejected)
        expect(insert(document, neume, 1)).toBe(document);
      for (const index of [-1, 2, 0.5, NaN, Infinity])
        expect(insert(document, candidate(), index)).toBe(document);
      const history = createDocumentHistory(document);
      expect(
        applyDocumentEdit(history, (current) => insert(current, duplicate, 0)),
      ).toBe(history);
    });
    it.each([0, 1, 2])(
      'moves constituent %s while preserving kind, IDs, and unrelated references',
      (index) => {
        const neume = candidate();
        const document = documentWith([neume, unrelated]);
        const note = neume.notes[index];
        for (const delta of [-1, 1] as const) {
          const result = moveNoteVertically(document, note.id, delta);
          expect(result).not.toBe(document);
          expect(result.neumes[0]?.kind).toBe(kind);
          expect(result.neumes[0]?.id).toBe(neume.id);
          expect(result.neumes[0]?.notes.map((n) => n.id)).toEqual(
            neume.notes.map((n) => n.id),
          );
          expect(result.neumes[0]?.notes[index]?.staffPosition).toBe(
            note.staffPosition + delta,
          );
          expect(result.neumes[1]).toBe(unrelated);
          neume.notes.forEach((original, i) => {
            if (i !== index) expect(result.neumes[0]?.notes[i]).toBe(original);
          });
        }
      },
    );
    it('rejects each move that flattens a required interval', () => {
      const document = documentWith([candidate(tight)]);
      const invalidMoves =
        kind === 'climacus'
          ? ([
              ['first', -1],
              ['second', 1],
              ['second', -1],
              ['third', 1],
            ] as const)
          : ([
              ['first', -1],
              ['second', 1],
              ['third', -1],
            ] as const);
      const history = createDocumentHistory(document);
      for (const [id, delta] of invalidMoves) {
        expect(moveNoteVertically(document, id, delta)).toBe(document);
        expect(
          applyDocumentEdit(history, (current) =>
            moveNoteVertically(current, id, delta),
          ),
        ).toBe(history);
      }
    });
    it('moves whole neumes without changing intervals or identity', () => {
      const neume = candidate();
      const document = documentWith([neume, unrelated]);
      const moved = moveNeumeVertically(document, kind, -4);
      expect(moved.neumes[0]?.notes.map((n) => n.staffPosition)).toEqual(
        pitches.map((p) => p - 4),
      );
      expect(moved.neumes[0]?.notes.map((n) => n.id)).toEqual(
        neume.notes.map((n) => n.id),
      );
      expect(moved.neumes[0]?.kind).toBe(kind);
      expect(moved.neumes[1]).toBe(unrelated);
      expect(moveNeumeVertically(document, kind, 0)).toBe(document);
    });
    it.each([
      'insert',
      'move-note',
      'move-neume',
      'delete-note',
      'delete-neume',
    ] as const)('undoes and redoes %s atomically', (action) => {
      const neume = candidate();
      const document = documentWith(
        action === 'insert' ? [unrelated] : [neume, unrelated],
      );
      const history = createDocumentHistory(document);
      const edited = applyDocumentEdit(history, (current) => {
        switch (action) {
          case 'insert':
            return insert(current, neume, 0);
          case 'move-note':
            return moveNoteVertically(current, 'first', 1);
          case 'move-neume':
            return moveNeumeVertically(current, kind, 1);
          case 'delete-note':
            return deleteNote(current, 'second');
          case 'delete-neume':
            return deleteNeume(current, kind);
        }
      });
      expect(edited.past).toEqual([document]);
      expect(edited.present.neumes.at(-1)).toBe(unrelated);
      expect(document.neumes).toEqual(
        action === 'insert' ? [unrelated] : [neume, unrelated],
      );
      const undone = undoDocumentEdit(edited);
      expect(undone.present).toBe(document);
      expect(redoDocumentEdit(undone).present).toBe(edited.present);
      expect(
        applyDocumentEdit(undone, (current) =>
          insert(
            current,
            {
              ...candidate(),
              id: 'replacement',
              notes: [
                { ...neume.notes[0], id: 'replacement-1' },
                { ...neume.notes[1], id: 'replacement-2' },
                { ...neume.notes[2], id: 'replacement-3' },
              ],
            },
            0,
          ),
        ).future,
      ).toEqual([]);
    });
    it.each(['first', 'second', 'third'])(
      'normalizes deletion of %s and reconciles surviving identity',
      (id) => {
        const neume = candidate();
        const document = documentWith([neume, unrelated]);
        const deleted = deleteNote(document, id);
        const normalized = deleted.neumes[0];
        expect(normalized && isValidNeume(normalized)).toBe(true);
        expect(normalized?.notes).toEqual(
          neume.notes.filter((n) => n.id !== id),
        );
        expect(normalized?.id).toBe(kind);
        expect(reconcileSelection(deleted, selectNeume(kind))).toEqual(
          selectNeume(kind),
        );
        for (const note of neume.notes) {
          expect(reconcileSelection(deleted, selectNote(note.id))).toEqual(
            note.id === id ? { kind: 'none' } : selectNote(note.id),
          );
          expect(getSurvivingFocusNoteId(deleted, note.id)).toBe(
            note.id === id ? null : note.id,
          );
        }
        const survivor = normalized?.notes[0];
        if (!survivor) throw new Error('Missing survivor');
        expect(deleteNote(deleted, survivor.id).neumes[0]?.kind).toBe(
          'punctum',
        );
        expect(deleted.neumes[1]).toBe(unrelated);
      },
    );
    it('resolves toolbar boundaries after any constituent and supplies the empty fallback', () => {
      const neume = candidate();
      const document = documentWith([neume, unrelated]);
      for (const note of neume.notes)
        expect(
          resolveToolbarNeumeInsertion(
            document,
            { kind: 'note', noteId: note.id },
            staffPosition(3),
          ),
        ).toEqual({
          insertionIndex: 1,
          referenceStaffPosition: note.staffPosition,
        });
      expect(
        resolveToolbarNeumeInsertion(
          documentWith(),
          { kind: 'none' },
          staffPosition(3),
        ),
      ).toEqual({ insertionIndex: 0, referenceStaffPosition: 3 });
    });
  });
}

it('rejects equal-outer-pitch Porrectus middle deletion without changing document, history, or selection', () => {
  const neume: PorrectusNeume = {
    id: 'porrectus',
    kind: 'porrectus',
    notes: [
      { id: 'first', staffPosition: staffPosition(3) },
      { id: 'second', staffPosition: staffPosition(0) },
      { id: 'third', staffPosition: staffPosition(3) },
    ],
  };
  const document = documentWith([neume]);
  const history = createDocumentHistory(document);
  expect(deleteNote(document, 'second')).toBe(document);
  expect(
    applyDocumentEdit(history, (current) => deleteNote(current, 'second')),
  ).toBe(history);
  const selection = selectNote('second');
  expect(reconcileSelection(document, selection)).toBe(selection);
});
