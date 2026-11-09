import { describe, expect, it } from 'vitest';
import { updateNoteModifiers } from './update-note-modifiers';
import { updateNoteForm } from './update-note-form';
import { moveNeumeVertically } from './move-neume';
import { moveNoteVertically } from './move-note';
import { deleteNote } from './delete-note';
import { updateClef } from './update-clef';
import { findNote } from '../domain/neume';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import {
  decodeDocument,
  encodeDocument,
  blankDocument,
} from '../persistence/native-document';
import source from '../examples/pater-noster.chant.json?raw';

const toggle = (
  document: ReturnType<typeof blankDocument>,
  id: string,
  value: boolean,
) => updateNoteModifiers(document, id, { kind: 'verticalEpisema', value });
describe('selected-note vertical episema semantics', () => {
  it('targets every constituent, shares unaffected objects, and removes only its own field', () => {
    const doc = decodeDocument(source);
    for (const neume of doc.neumes)
      for (const note of neume.notes) {
        const marked = toggle(doc, note.id, true);
        expect(findNote(marked, note.id)?.note).toEqual({
          ...note,
          verticalEpisema: true,
        });
        expect(marked.syllables).toBe(doc.syllables);
        expect(marked.divisions).toBe(doc.divisions);
        expect(marked.clefChanges).toBe(doc.clefChanges);
        for (const other of marked.neumes.filter((n) => n.id !== neume.id))
          expect(other).toBe(doc.neumes.find((n) => n.id === other.id));
        expect(toggle(marked, note.id, true)).toBe(marked);
        expect(toggle(doc, note.id, false)).toBe(doc);
        expect(toggle(marked, note.id, false)).toEqual(doc);
        expect(decodeDocument(encodeDocument(marked))).toEqual(marked);
      }
    expect(toggle(doc, 'missing', true)).toBe(doc);
    expect(
      updateNoteModifiers(
        doc,
        doc.neumes[0].notes[0].id,
        JSON.parse('{"kind":"verticalEpisema","value":1}'),
      ),
    ).toBe(doc);
  });
  it('coexists with both signs, forms, movement and clefs; never retargets after deletion', () => {
    let doc = decodeDocument(source);
    const id = doc.neumes[0].notes[0].id;
    doc = updateNoteModifiers(doc, id, { kind: 'mora', value: 1 });
    doc = updateNoteModifiers(doc, id, { kind: 'episema', value: true });
    doc = toggle(doc, id, true);
    const marked = findNote(doc, id)?.note;
    expect(marked).toMatchObject({
      mora: 1,
      episema: true,
      verticalEpisema: true,
    });
    const shaped = updateNoteForm(doc, id, 'virga');
    expect(findNote(shaped, id)?.note).toEqual({ ...marked, form: 'virga' });
    for (const moved of [
      moveNoteVertically(shaped, id, 1),
      moveNeumeVertically(shaped, shaped.neumes[0].id, 1),
      updateClef(shaped, { type: 'f', staffLine: 2 }),
    ]) {
      expect(findNote(moved, id)?.note).toMatchObject({
        id,
        form: 'virga',
        mora: 1,
        episema: true,
        verticalEpisema: true,
      });
    }
    const compound = doc.neumes.find((n) => n.kind === 'podatus');
    expect(compound).toBeDefined();
    if (!compound) return;
    const survivor = compound.notes[1].id;
    const signed = toggle(doc, survivor, true);
    const normalized = deleteNote(signed, compound.notes[0].id);
    expect(findNote(normalized, survivor)?.note).toMatchObject({
      id: survivor,
      verticalEpisema: true,
    });
    expect(findNote(deleteNote(signed, survivor), survivor)).toBeNull();
  });
  it('one action creates one exact history snapshot, including following a move', () => {
    const doc = decodeDocument(source),
      id = doc.neumes[0].notes[0].id;
    let session = createEditorSession(doc);
    session = reduceEditorSession(session, {
      type: 'engraving-edit',
      edit: (d) => moveNoteVertically(d, id, 1),
    });
    const moved = session.history.present;
    session = reduceEditorSession(session, {
      type: 'engraving-edit',
      edit: (d) => toggle(d, id, true),
    });
    const signed = session.history.present;
    expect(session.history.past).toEqual([doc, moved]);
    expect(
      reduceEditorSession(session, {
        type: 'engraving-edit',
        edit: (d) => toggle(d, id, true),
      }),
    ).toBe(session);
    session = reduceEditorSession(session, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(session.history.present).toBe(moved);
    session = reduceEditorSession(session, {
      type: 'history',
      direction: 'redo',
      focusedNoteId: null,
    });
    expect(session.history.present).toBe(signed);
  });
});
