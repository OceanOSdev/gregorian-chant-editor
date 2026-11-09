import { describe, expect, it } from 'vitest';
import { BrowserDocument, autosaveKey } from './browser-document';
import { blankDocument, encodeDocument } from './native-document';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { updateLyricLanguage } from '../commands/update-lyric-alignment';

function storage(initial: string | null = null) {
  let raw = initial;
  return {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
}
describe('browser recovery', () => {
  it('does not write on first visit; recovers a fresh history root', () => {
    const memory = storage();
    const adapter = new BrowserDocument(() => memory);
    const doc = adapter.load(blankDocument());
    expect(memory.getItem()).toBeNull();
    adapter.save(doc);
    expect(
      createEditorSession(
        new BrowserDocument(() => memory).load(blankDocument()),
      ).history,
    ).toEqual({ past: [], present: doc, future: [] });
  });
  it('protects corrupt bytes through edits until explicit replacement', () => {
    const memory = storage('{broken');
    const adapter = new BrowserDocument(() => memory);
    const doc = adapter.load(blankDocument());
    adapter.save(doc);
    expect(memory.getItem()).toBe('{broken');
    expect(adapter.needsRecovery).toBe(true);
    adapter.save(doc, true);
    expect(memory.getItem()).toBe(encodeDocument(doc));
    expect(adapter.needsRecovery).toBe(false);
  });
  it('detects other tabs even before an event and requires an explicit choice', () => {
    const memory = storage();
    const a = new BrowserDocument(() => memory);
    const b = new BrowserDocument(() => memory);
    a.load(blankDocument());
    b.load(blankDocument());
    const other = { ...blankDocument(), title: 'Other tab' };
    a.save(other);
    b.save(blankDocument());
    expect(memory.getItem()).toBe(encodeDocument(other));
    expect(b.status).toContain('another tab');
    expect(b.load(blankDocument())).toEqual(other);
    expect(b.needsRecovery).toBe(false);
    b.save(blankDocument());
    expect(memory.getItem()).toBe(encodeDocument(blankDocument()));
  });
  it('guards unavailable access, read and quota errors without losing memory', () => {
    for (const mode of ['access', 'read', 'write']) {
      const memory = storage();
      const adapter = new BrowserDocument(() => {
        if (mode === 'access') throw Error('SecurityError');
        return {
          getItem: () => {
            if (mode === 'read') throw Error('SecurityError');
            return memory.getItem();
          },
          setItem: () => {
            throw Error('QuotaExceededError');
          },
        };
      });
      const doc = adapter.load(blankDocument());
      adapter.save(doc);
      expect(doc).toEqual(blankDocument());
      expect(adapter.status).toContain('Not saved');
      expect(adapter.needsRecovery).toBe(true);
    }
  });
  it('saves exact committed undo and redo snapshots', () => {
    const memory = storage();
    const adapter = new BrowserDocument(() => memory);
    let session = createEditorSession(adapter.load(blankDocument()));
    session = reduceEditorSession(session, {
      type: 'engraving-edit',
      edit: (d) => updateLyricLanguage(d, 'el'),
    });
    adapter.save(session.history.present);
    const changed = memory.getItem();
    session = reduceEditorSession(session, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    adapter.save(session.history.present);
    expect(memory.getItem()).toBe(encodeDocument(blankDocument()));
    session = reduceEditorSession(session, {
      type: 'history',
      direction: 'redo',
      focusedNoteId: null,
    });
    adapter.save(session.history.present);
    expect(memory.getItem()).toBe(changed);
    expect(autosaveKey).toContain('gregorian-chant-editor:');
  });
});
