import { describe, expect, it } from 'vitest';
import { exampleDocument } from '../domain/example-document';
import { findNote } from '../domain/neume';
import {
  updateNoteModifiers,
  type NoteModifierEdit,
} from './update-note-modifiers';
import { moveNoteVertically } from './move-note';
import { moveNeumeVertically } from './move-neume';
import { deleteNote } from './delete-note';
import {
  createDocumentHistory,
  applyDocumentEdit,
  undoDocumentEdit,
  redoDocumentEdit,
} from '../state/document-history';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';

const target = 'note-torculus-3';
describe('note modifier edits', () => {
  it('changes exactly one note, shares unrelated data and keeps the other modifier', () => {
    const marked = updateNoteModifiers(exampleDocument, target, {
      kind: 'mora',
      value: 1,
    });
    const both = updateNoteModifiers(marked, target, {
      kind: 'episema',
      value: true,
    });
    expect(findNote(both, target)?.note).toMatchObject({
      mora: 1,
      episema: true,
    });
    expect(both.neumes[0]).toBe(exampleDocument.neumes[0]);
    expect(both.syllables).toBe(exampleDocument.syllables);
    expect(both.neumes[1].notes[1]).toBe(exampleDocument.neumes[1].notes[1]);
    const removed = updateNoteModifiers(both, target, {
      kind: 'mora',
      value: 0,
    });
    expect(findNote(removed, target)?.note).not.toHaveProperty('mora');
    expect(findNote(removed, target)?.note.episema).toBe(true);
    expect(
      findNote(
        updateNoteModifiers(removed, target, { kind: 'episema', value: false }),
        target,
      )?.note,
    ).toEqual(findNote(exampleDocument, target)?.note);
  });
  it('returns exact identity for missing, invalid and unchanged requests', () => {
    for (const edit of [
      { kind: 'mora', value: 0 },
      { kind: 'episema', value: false },
    ] as const)
      expect(updateNoteModifiers(exampleDocument, target, edit)).toBe(
        exampleDocument,
      );
    expect(
      updateNoteModifiers(exampleDocument, 'missing', {
        kind: 'mora',
        value: 1,
      }),
    ).toBe(exampleDocument);
    for (const edit of [
      { kind: 'mora', value: -1 },
      { kind: 'mora', value: 1.5 },
      { kind: 'mora', value: 3 },
      { kind: 'mora', value: 2 },
      { kind: 'episema', value: 1 },
      { kind: 'unknown', value: 1 },
    ])
      expect(
        updateNoteModifiers(exampleDocument, target, edit as NoteModifierEdit),
      ).toBe(exampleDocument);
  });
  it('preserves exact marks through note/neume moves, normalization and history', () => {
    const marked = updateNoteModifiers(
      updateNoteModifiers(exampleDocument, target, { kind: 'mora', value: 1 }),
      target,
      { kind: 'episema', value: true },
    );
    const moved = moveNoteVertically(
      moveNoteVertically(marked, target, -1),
      target,
      -1,
    );
    const whole = moveNeumeVertically(moved, 'neume-torculus-1', 1);
    const normalized = deleteNote(whole, 'note-torculus-2');
    expect(normalized.neumes[1].kind).toBe('clivis');
    expect(findNote(normalized, target)?.note).toMatchObject({
      mora: 1,
      episema: true,
    });
    expect(findNote(deleteNote(normalized, target), target)).toBeNull();
    let h = createDocumentHistory(exampleDocument);
    for (const d of [marked, moved, whole, normalized])
      h = applyDocumentEdit(h, () => d);
    for (const d of [whole, moved, marked, exampleDocument]) {
      h = undoDocumentEdit(h);
      expect(h.present).toBe(d);
    }
    for (const d of [marked, moved, whole, normalized]) {
      h = redoDocumentEdit(h);
      expect(h.present).toBe(d);
    }
  });
  it('records one session action without changing selected note or native focus request', () => {
    const state = reduceEditorSession(createEditorSession(exampleDocument), {
      type: 'select',
      selection: { kind: 'note', noteId: target },
    });
    const next = reduceEditorSession(state, {
      type: 'engraving-edit',
      edit: (d) => updateNoteModifiers(d, target, { kind: 'mora', value: 1 }),
    });
    expect(next.history.past).toEqual([exampleDocument]);
    expect(next.selection).toBe(state.selection);
    expect(next.focusRequest).toBe(state.focusRequest);
  });
});
