import { describe, expect, it } from 'vitest';
import { moraChoices, moraIndexes, getMoraScope } from '../domain/mora';
import { isValidNeume } from '../domain/neume';
import {
  IncompatibleDraftDocumentError,
  decodeDocument,
  encodeDocument,
} from '../persistence/native-document';
import { exampleDocument } from '../domain/example-document';
import { updateMoraScope, updateNoteModifiers } from './update-note-modifiers';
import { deleteNote } from './delete-note';
import { moveNoteVertically } from './move-note';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';

const { accidentals: _accidentals, ...legacyExample } = exampleDocument;
const kinds = [
  ['punctum', [2]],
  ['podatus', [2, 4]],
  ['clivis', [4, 2]],
  ['scandicus', [0, 2, 4]],
  ['torculus', [0, 4, 2]],
  ['climacus', [4, 2, 0]],
  ['porrectus', [4, 0, 2]],
] as const;
describe('conventional mora scope', () => {
  it.each(kinds)(
    '%s: complete allowed/disallowed pattern matrix, round trips and stable note IDs',
    (kind, pitches) => {
      const document = decodeDocument(
        JSON.stringify({
          format: 'gregorian-chant-editor',
          version: 2,
          document: {
            ...legacyExample,
            syllables: [],
            neumes: [
              {
                id: 'neume',
                kind,
                notes: pitches.map((p, i) => ({
                  id: 'note-' + i,
                  staffPosition: p,
                  episema: true,
                })),
              },
            ],
          },
        }),
      );
      for (let mask = 0; mask < 2 ** pitches.length; mask++) {
        const candidate = structuredClone(document);
        candidate.neumes[0].notes.forEach((n, i) => {
          if (mask & (1 << i)) n.mora = 1;
        });
        const valid = moraChoices(kind).some(
          (c) =>
            moraIndexes(c.value, pitches.length).reduce(
              (m, i) => m | (1 << i),
              0,
            ) === mask,
        );
        expect(isValidNeume(candidate.neumes[0])).toBe(valid);
        if (valid)
          expect(decodeDocument(encodeDocument(candidate))).toEqual(candidate);
        else {
          expect(() => encodeDocument(candidate)).toThrow();
          expect(() =>
            decodeDocument(
              JSON.stringify({
                format: 'gregorian-chant-editor',
                version: 2,
                document: (({ accidentals: _accidentals, ...legacy }) =>
                  legacy)(candidate),
              }),
            ),
          ).toThrow(IncompatibleDraftDocumentError);
        }
      }
      for (const choice of moraChoices(kind)) {
        const marked = updateMoraScope(document, 'neume', choice.value);
        expect(getMoraScope(marked.neumes[0])).toBe(choice.value);
        expect(marked.neumes[0].notes.map((n) => n.id)).toEqual(
          document.neumes[0].notes.map((n) => n.id),
        );
        expect(marked.neumes[0].notes.every((n) => n.episema)).toBe(true);
        expect(updateMoraScope(marked, 'neume', choice.value)).toBe(marked);
        for (const note of marked.neumes[0].notes) {
          const removed = deleteNote(marked, note.id);
          if (removed === marked) continue; // equal-pitch survivors reject as before
          expect(removed.neumes.every(isValidNeume)).toBe(true);
          for (const survivor of removed.neumes[0]?.notes ?? [])
            expect(survivor).toBe(
              marked.neumes[0].notes.find((n) => n.id === survivor.id),
            );
        }
      }
      expect(updateMoraScope(document, 'missing', 'none')).toBe(document);
      expect(
        updateMoraScope(
          document,
          'neume',
          kind === 'punctum' ? 'final-two' : 'sole',
        ),
      ).toBe(document);
    },
  );
  it('edits final two atomically and retains selection/focus, exact undo/redo and marks through pitch changes', () => {
    const target = 'neume-torculus-1';
    const state = reduceEditorSession(createEditorSession(exampleDocument), {
      type: 'select',
      selection: { kind: 'note', noteId: 'note-torculus-1' },
    });
    const next = reduceEditorSession(state, {
      type: 'engraving-edit',
      edit: (d) => updateMoraScope(d, target, 'final-two'),
    });
    expect(next.history.past).toEqual([exampleDocument]);
    expect(next.history.present.neumes[1].notes.map((n) => n.mora)).toEqual([
      undefined,
      1,
      1,
    ]);
    expect(next.selection).toBe(state.selection);
    expect(next.focusRequest).toBe(state.focusRequest);
    const undo = reduceEditorSession(next, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(undo.history.present).toBe(exampleDocument);
    expect(
      reduceEditorSession(undo, {
        type: 'history',
        direction: 'redo',
        focusedNoteId: null,
      }).history.present,
    ).toBe(next.history.present);
    const moved = moveNoteVertically(
      next.history.present,
      'note-torculus-2',
      1,
    );
    expect(moved.neumes[1].notes.map((n) => n.mora)).toEqual([undefined, 1, 1]);
    expect(
      updateNoteModifiers(exampleDocument, 'note-torculus-1', {
        kind: 'mora',
        value: 1,
      }),
    ).toBe(exampleDocument);
    expect(
      updateNoteModifiers(next.history.present, 'note-torculus-3', {
        kind: 'mora',
        value: 0,
      }),
    ).toBe(next.history.present);
  });
});
