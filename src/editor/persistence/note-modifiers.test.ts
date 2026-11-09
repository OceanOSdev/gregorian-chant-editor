import originalSample from '../../../docs/verification/note-modifiers/baseline-v1.chant.json?raw';
import originalEvents from '../../../docs/verification/note-modifiers/baseline-events-v1.chant.json?raw';
import { describe, expect, it } from 'vitest';
import {
  IncompatibleDraftDocumentError,
  decodeDocument,
  encodeDocument,
} from './native-document';
import { BrowserDocument, autosaveKey } from './browser-document';
import { updateNoteModifiers } from '../commands/update-note-modifiers';

const baseline = (name: string) =>
  name === 'baseline-v1' ? originalSample : originalEvents;
describe('native v2 and exact v1 compatibility', () => {
  it.each(['baseline-v1', 'baseline-events-v1'])(
    'recovers %s without writes then upgrades in the existing key',
    (name) => {
      let bytes = baseline(name);
      const original = JSON.parse(bytes).document;
      const storage = {
        getItem: (key: string) => {
          expect(key).toBe(autosaveKey);
          return bytes;
        },
        setItem: (key: string, value: string) => {
          expect(key).toBe(autosaveKey);
          bytes = value;
        },
      };
      const adapter = new BrowserDocument(() => storage);
      const doc = adapter.load(original);
      expect(doc).toEqual(original);
      expect(bytes).toBe(baseline(name));
      const marked = updateNoteModifiers(doc, 'note-punctum-1', {
        kind: 'mora',
        value: 1,
      });
      adapter.save(marked);
      expect(JSON.parse(bytes).version).toBe(3);
      expect(new BrowserDocument(() => storage).load(original)).toEqual(marked);
      expect(decodeDocument(encodeDocument(marked))).toEqual(marked);
    },
  );
  it.each([
    { mora: 0 },
    { mora: -1 },
    { mora: 3 },
    { mora: 1.5 },
    { mora: '1' },
    { mora: null },
    { mora: {} },
    { episema: false },
    { episema: 1 },
    { episema: 'on' },
    { episema: null },
    { episema: {} },
    { other: true },
  ])('rejects invalid modifiers %j in v2 and never weakens v1', (modifiers) => {
    const payload = JSON.parse(baseline('baseline-v1'));
    Object.assign(payload.document.neumes[0].notes[0], modifiers);
    for (const version of [1, 2]) {
      payload.version = version;
      expect(() => decodeDocument(JSON.stringify(payload))).toThrow();
    }
  });
  it('rejects marks in v1 but round trips both marks in v2, protecting future/foreign caches', () => {
    const payload = JSON.parse(baseline('baseline-events-v1'));
    Object.assign(payload.document.neumes[0].notes[0], {
      mora: 1,
      episema: true,
    });
    expect(() => decodeDocument(JSON.stringify(payload))).toThrow();
    payload.version = 2;
    expect(
      decodeDocument(encodeDocument(decodeDocument(JSON.stringify(payload)))),
    ).toEqual(payload.document);
    for (const invalid of [
      { ...payload, version: 4 },
      { ...payload, format: 'foreign' },
    ]) {
      let bytes = JSON.stringify(invalid);
      const before = bytes;
      const adapter = new BrowserDocument(() => ({
        getItem: () => bytes,
        setItem: (_k, v) => {
          bytes = v;
        },
      }));
      adapter.load(payload.document);
      adapter.save(payload.document);
      expect(bytes).toBe(before);
      expect(adapter.needsRecovery).toBe(true);
    }
  });
});

describe('withdrawn draft-v2 recovery', () => {
  it.each(['double', 'first', 'middle', 'all'])(
    'protects %s without inferring intent',
    (pattern) => {
      const payload = JSON.parse(originalSample);
      payload.version = 2;
      const notes = payload.document.neumes[1].notes;
      if (pattern === 'double') notes[2].mora = 2;
      if (pattern === 'first') notes[0].mora = 1;
      if (pattern === 'middle') notes[1].mora = 1;
      if (pattern === 'all')
        notes.forEach((n: Record<string, unknown>) => (n.mora = 1));
      const original = '\n' + JSON.stringify(payload, null, 3) + '\n';
      expect(() => decodeDocument(original)).toThrow(
        IncompatibleDraftDocumentError,
      );
      let bytes = original;
      const fallback = decodeDocument(originalSample);
      const adapter = new BrowserDocument(() => ({
        getItem: () => bytes,
        setItem: (_k, v) => {
          bytes = v;
        },
      }));
      expect(adapter.load(fallback)).toBe(fallback);
      expect(adapter.recoverySource).toBe(original);
      expect(adapter.status).toContain('requires resolution');
      adapter.save(fallback);
      expect(bytes).toBe(original);
      expect(adapter.recoverySource).toBe(original);
      adapter.check();
      expect(adapter.needsRecovery).toBe(true);
      expect(adapter.load(fallback)).toBe(fallback);
      expect(bytes).toBe(original);
      adapter.save(fallback, true); // only explicit replacement clears protection
      expect(decodeDocument(bytes)).toEqual(fallback);
      expect(adapter.recoverySource).toBeNull();
    },
  );
  it('fully validates legacy syntax and non-modifier invariants before offering resolution', () => {
    const payload = JSON.parse(originalSample);
    payload.version = 2;
    payload.document.neumes[0].notes[0].mora = 2;
    payload.document.neumes[0].notes[0].unknown = true;
    expect(() => decodeDocument(JSON.stringify(payload))).toThrow(
      'Expected fields',
    );
    delete payload.document.neumes[0].notes[0].unknown;
    payload.document.neumes[1].notes[1].id =
      payload.document.neumes[0].notes[0].id;
    expect(() => decodeDocument(JSON.stringify(payload))).toThrow(
      'Duplicate IDs',
    );
  });
});
