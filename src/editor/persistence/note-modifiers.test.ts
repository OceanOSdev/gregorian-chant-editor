import originalSample from '../../../docs/verification/note-modifiers/baseline-v1.chant.json?raw';
import originalEvents from '../../../docs/verification/note-modifiers/baseline-events-v1.chant.json?raw';
import { describe, expect, it } from 'vitest';
import { decodeDocument, encodeDocument } from './native-document';
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
        value: 2,
      });
      adapter.save(marked);
      expect(JSON.parse(bytes).version).toBe(2);
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
      { ...payload, version: 3 },
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
