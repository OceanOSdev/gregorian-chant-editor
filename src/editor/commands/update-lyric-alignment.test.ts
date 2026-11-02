import { describe, expect, it } from 'vitest';
import {
  updateLyricAlignment,
  updateLyricLanguage,
} from './update-lyric-alignment';
import { updateLyricSyllableText } from './update-lyric-syllable';
import { exampleDocument } from '../domain/example-document';
import { hasValidLyricAnchors } from '../domain/lyrics';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import {
  applyDocumentEdit,
  createDocumentHistory,
  undoDocumentEdit,
  redoDocumentEdit,
} from '../state/document-history';

const document = {
  ...exampleDocument,
  syllables: [{ ...exampleDocument.syllables[0], text: 'le\u0301son' }],
};
const id = document.syllables[0].id;

describe('authored lyric alignment', () => {
  it('validates ranges using grapheme indexes, shares music and preserves anchors', () => {
    for (const alignment of [
      { start: -1, end: 1 },
      { start: 0, end: 6 },
      { start: 1, end: 1 },
      { start: 0.5, end: 2 },
      { start: NaN, end: 1 },
    ])
      expect(updateLyricAlignment(document, id, alignment)).toBe(document);
    expect(
      updateLyricAlignment(document, 'missing', { start: 0, end: 1 }),
    ).toBe(document);
    const next = updateLyricAlignment(document, id, { start: 1, end: 2 });
    expect(hasValidLyricAnchors(next)).toBe(true);
    expect(next.neumes).toBe(document.neumes);
    expect(next.syllables[0].startsAtNeumeId).toBe(
      document.syllables[0].startsAtNeumeId,
    );
    expect(updateLyricAlignment(next, id, { start: 1, end: 2 })).toBe(next);
    expect(updateLyricAlignment(document, id, undefined)).toBe(document);
  });
  it('resets overrides on any text change, preserves exact unchanged text, and restores through history', () => {
    const manual = updateLyricAlignment(document, id, { start: 1, end: 3 });
    expect(updateLyricSyllableText(manual, id, manual.syllables[0].text)).toBe(
      manual,
    );
    const history = applyDocumentEdit(createDocumentHistory(manual), (doc) =>
      updateLyricSyllableText(doc, id, 'x'),
    );
    expect(history.present.syllables[0].alignment).toBeUndefined();
    expect(history.past).toHaveLength(1);
    expect(undoDocumentEdit(history).present).toBe(manual);
    expect(redoDocumentEdit(undoDocumentEdit(history)).present).toBe(
      history.present,
    );
    const reset = updateLyricAlignment(manual, id, undefined);
    expect(reset.syllables[0].alignment).toBeUndefined();
  });
  it('records each range/reset/language as one action with exact undo and redo', () => {
    for (const edit of [
      (doc: typeof document) => updateLyricLanguage(doc, 'el'),
      (doc: typeof document) =>
        updateLyricAlignment(doc, id, { start: 1, end: 3 }),
      (doc: typeof document) =>
        updateLyricAlignment(
          updateLyricAlignment(doc, id, { start: 1, end: 2 }),
          id,
          undefined,
        ),
    ]) {
      const history = applyDocumentEdit(createDocumentHistory(document), edit);
      expect(history.past).toEqual([document]);
      expect(undoDocumentEdit(history).present).toBe(document);
      expect(redoDocumentEdit(undoDocumentEdit(history)).present).toBe(
        history.present,
      );
    }
    expect(updateLyricLanguage(document, 'la')).toBe(document);
    const next = updateLyricLanguage(document, 'en');
    expect(next.syllables).toBe(document.syllables);
    expect(next.neumes).toBe(document.neumes);
  });
  it('preserves a dirty draft, semantic selection and pending focus across language edits', () => {
    let state = createEditorSession(document);
    state = reduceEditorSession(state, {
      type: 'lyrics',
      action: { type: 'edit', syllableId: id },
      newId: 'new',
    });
    state = reduceEditorSession(state, {
      type: 'lyrics',
      action: { type: 'text', text: 'changed' },
      newId: 'new',
    });
    const next = reduceEditorSession(state, {
      type: 'engraving-edit',
      edit: (doc) => updateLyricLanguage(doc, 'und'),
    });
    expect(next.lyrics).toBe(state.lyrics);
    expect(next.selection).toBe(state.selection);
    expect(next.focusRequest).toBe(state.focusRequest);
    expect(next.history.past).toHaveLength(1);
    expect(next.history.present.syllables).toBe(
      state.history.present.syllables,
    );
    const pending = reduceEditorSession(next, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(pending.pendingHistory?.direction).toBe('undo');
    expect(pending.lyrics).toBe(state.lyrics);
  });
});
