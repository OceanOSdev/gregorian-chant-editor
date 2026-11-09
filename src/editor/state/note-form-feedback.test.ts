import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { blankDocument } from '../persistence/native-document';
import {
  createEditorSession,
  entryName,
  reduceEditorSession,
  type EditorAction,
} from './editor-session';
import { deleteNote } from '../commands/delete-note';
import { moveNoteVertically } from '../commands/move-note';
import { updateNoteForm } from '../commands/update-note-form';
import { updateDocumentTitle } from '../commands/update-document-title';

function fixture(): ChantDocument {
  return {
    ...blankDocument(),
    divisions: [{ id: 'bar', kind: 'minor', beforeNeumeId: null }],
    neumes: [
      {
        id: 'pes',
        kind: 'podatus',
        notes: [
          { id: 'lower', staffPosition: staffPosition(2), form: 'quilisma' },
          { id: 'upper', staffPosition: staffPosition(3) },
        ],
      },
    ],
  };
}
const rejectedDeletion = () =>
  reduceEditorSession(createEditorSession(fixture()), {
    type: 'edit',
    formDeletionNoteId: 'upper',
    edit: (d) => deleteNote(d, 'upper'),
  });

describe('form feedback and naming', () => {
  it.each([
    ['punctum', 'virga', 'Virga'],
    ['punctum', 'inclinatum', 'Punctum inclinatum'],
    ['podatus', 'quilisma', 'Quilisma Podatus'],
    ['scandicus', 'quilisma', 'Quilisma Scandicus'],
  ] as const)(
    'names %s %s in the armed and committed announcements',
    (kind, form, label) => {
      expect(entryName(kind, form)).toBe(label);
      const state = createEditorSession(blankDocument());
      const tool =
        kind === 'punctum'
          ? { kind: 'place-punctum' as const, form }
          : kind === 'podatus'
            ? { kind: 'place-podatus' as const, form: 'quilisma' as const }
            : { kind: 'place-scandicus' as const, form: 'quilisma' as const };
      const armed = reduceEditorSession(state, { type: 'arm', tool });
      expect(armed.announcement.text).toBe(`Placing ${label}.`);
      const inserted = reduceEditorSession(armed, {
        type: 'insert',
        ids: { neumeId: 'n', noteIds: ['a', 'b', 'c'] },
      });
      expect(inserted.announcement.text).toBe(`${label} added.`);
    },
  );
  it.each([
    { type: 'insert', ids: { neumeId: 'new', noteIds: ['a', 'b', 'c'] } },
    { type: 'change-division', id: 'bar', kind: 'maior' },
    { type: 'change-clef', clef: { type: 'f', staffLine: 3 } },
    { type: 'engraving-edit', edit: (d) => updateDocumentTitle(d, 'Changed') },
    { type: 'edit', edit: (d) => updateNoteForm(d, 'lower', undefined) },
  ] satisfies EditorAction[])(
    'clears stale errors after $type commits',
    (action) => {
      const before = rejectedDeletion();
      expect(before.noteFormError).not.toBeNull();
      const next = reduceEditorSession(before, action);
      expect(next.history.present).not.toBe(before.history.present);
      expect(next.noteFormError).toBeNull();
    },
  );
  it('clears errors for the early-return lyric-commit path and subsequent undo/redo', () => {
    const before = rejectedDeletion();
    const drafting = {
      ...before,
      lyrics: {
        kind: 'draft' as const,
        neumeId: 'pes',
        original: null,
        text: 'la',
        boundaryBefore: 'word' as const,
      },
    };
    const next = reduceEditorSession(drafting, {
      type: 'lyrics',
      action: { type: 'save' },
      newId: 'lyric',
    });
    expect(next.history.present.syllables[0]?.text).toBe('la');
    expect(next.noteFormError).toBeNull();
    const undo = reduceEditorSession(
      { ...next, noteFormError: before.noteFormError },
      { type: 'history', direction: 'undo', focusedNoteId: null },
    );
    expect(undo.noteFormError).toBeNull();
    expect(
      reduceEditorSession(
        { ...undo, noteFormError: before.noteFormError },
        { type: 'history', direction: 'redo', focusedNoteId: null },
      ).noteFormError,
    ).toBeNull();
    expect(reduceEditorSession(before, { type: 'edit', edit: (d) => d })).toBe(
      before,
    );
  });
  it('does not blame a form for an invalid pitch contour, with or without an override', () => {
    const state = createEditorSession(fixture());
    expect(
      reduceEditorSession(state, {
        type: 'edit',
        edit: (d) => moveNoteVertically(d, 'upper', -1),
      }),
    ).toBe(state);
    expect(state.noteFormError).toBeNull();
    const ordinary = updateNoteForm(state.history.present, 'lower', undefined);
    expect(moveNoteVertically(ordinary, 'upper', -1)).toBe(ordinary);
    expect(rejectedDeletion().noteFormError).toContain('required partner');
  });
});
