import { describe, expect, it } from 'vitest';
import { exampleDocument } from '../domain/example-document';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { BrowserDocument } from '../persistence/browser-document';
import {
  decodeDocument,
  encodeDocument,
  documentFilename,
} from '../persistence/native-document';
import { updateDocumentTitle } from './update-document-title';

describe('document title', () => {
  it('changes only the title, preserving the original document and semantic collections', () => {
    const document = updateDocumentTitle(exampleDocument, 'Sálve Regina');
    expect(document).toEqual({ ...exampleDocument, title: 'Sálve Regina' });
    expect(exampleDocument.title).toBe('Gregorian Chant Editor');
    for (const key of [
      'neumes',
      'syllables',
      'divisions',
      'clefChanges',
      'clef',
    ] as const) {
      expect(document[key]).toBe(exampleDocument[key]);
    }
    expect(updateDocumentTitle(document, document.title)).toBe(document);
  });

  it.each(['Sálve Regina', ''])(
    'records, undoes, redoes and recovers title %j without losing music',
    (title) => {
      let stored: string | null = null;
      const storage = {
        getItem: () => stored,
        setItem: (_key: string, value: string) => {
          stored = value;
        },
      };
      const persistence = new BrowserDocument(() => storage);
      let session = createEditorSession(persistence.load(exampleDocument));
      session = reduceEditorSession(session, {
        type: 'engraving-edit',
        edit: (d) => updateDocumentTitle(d, title),
      });
      expect(session.history.past).toEqual([exampleDocument]);
      expect(session.history.present.title).toBe(title);
      persistence.save(session.history.present);
      const exported = encodeDocument(session.history.present);
      const recovered = new BrowserDocument(() => storage).load(
        exampleDocument,
      );
      expect(recovered).toEqual({ ...exampleDocument, title });
      expect(decodeDocument(exported)).toEqual(recovered);
      expect(documentFilename(recovered.title)).toBe(
        title ? 'Sálve-Regina.chant.json' : 'untitled.chant.json',
      );
      session = reduceEditorSession(session, {
        type: 'history',
        direction: 'undo',
        focusedNoteId: null,
      });
      expect(session.history.present).toBe(exampleDocument);
      persistence.save(session.history.present);
      expect(new BrowserDocument(() => storage).load(exampleDocument)).toEqual(
        exampleDocument,
      );
      session = reduceEditorSession(session, {
        type: 'history',
        direction: 'redo',
        focusedNoteId: null,
      });
      expect(session.history.present).toEqual(recovered);
      persistence.save(session.history.present);
      expect(new BrowserDocument(() => storage).load(exampleDocument)).toEqual(
        recovered,
      );
    },
  );

  it('does not create history for an unchanged title', () => {
    const session = createEditorSession(exampleDocument);
    const next = reduceEditorSession(session, {
      type: 'engraving-edit',
      edit: (d) => updateDocumentTitle(d, d.title),
    });
    expect(next.history).toBe(session.history);
  });
});
