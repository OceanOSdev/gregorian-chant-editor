import { expect, it } from 'vitest';
import { createChant } from '../persistence/chant-file';
import { updateClef, updateDocumentTitle } from './update-document';
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

it('records title and clef changes atomically and preserves semantic collections', () => {
  const score = createChant();
  expect(updateDocumentTitle(score, ' ')).toBe(score);
  expect(updateDocumentTitle(score, ' ' + score.title + ' ')).toBe(score);
  expect(updateClef(score, 3)).toBe(score);
  const history = applyDocumentEdit(createDocumentHistory(score), (doc) =>
    updateClef(updateDocumentTitle(doc, 'Kyrie'), 4),
  );
  expect(history.past).toEqual([score]);
  expect(history.present.neumes).toBe(score.neumes);
  expect(undoDocumentEdit(history).present).toBe(score);
  expect(redoDocumentEdit(undoDocumentEdit(history)).present).toBe(
    history.present,
  );
});
it('replacement resets history and transient editing state explicitly', () => {
  const state = createEditorSession(createChant());
  const edited = reduceEditorSession(state, {
    type: 'engraving-edit',
    edit: (doc) => updateDocumentTitle(doc, 'Other'),
  });
  const replacement = createChant();
  const next = reduceEditorSession(edited, {
    type: 'replace-document',
    document: replacement,
  });
  expect(next.history.present).toBe(replacement);
  expect(next.history.past).toEqual([]);
  expect(next.lyrics).toBeNull();
  expect(next.selection.kind).toBe('none');
});
