import { describe, expect, it } from 'vitest';
import {
  decodeDocument,
  encodeDocument,
  blankDocument,
  maximumDocumentBytes,
  IncompatibleDraftDocumentError,
} from './native-document';
import { BrowserDocument } from './browser-document';
import { updateNoteModifiers } from '../commands/update-note-modifiers';
import v1 from '../../../docs/verification/note-modifiers/baseline-events-v1.chant.json?raw';
import v2 from '../../../docs/verification/note-modifiers/conventional/editor-cases.chant.json?raw';
import v3 from '../../../docs/verification/note-shapes/editor-cases-v3.chant.json?raw';

describe('strict v4 vertical episema and legacy recovery', () => {
  it.each([v1, v2, v3])(
    'hydrates exact legacy bytes without writes then commits v9 once',
    (source) => {
      let bytes = source;
      let writes = 0;
      const adapter = new BrowserDocument(() => ({
        getItem: () => bytes,
        setItem: (_k, v) => {
          bytes = v;
          writes++;
        },
      }));
      const document = adapter.load(blankDocument());
      expect(document).toEqual({
        ...JSON.parse(source).document,
        accidentals: [],
      });
      expect(bytes).toBe(source);
      expect(writes).toBe(0);
      const marked = updateNoteModifiers(
        document,
        document.neumes[0].notes[0].id,
        { kind: 'verticalEpisema', value: true },
      );
      adapter.save(marked);
      expect(writes).toBe(1);
      expect(JSON.parse(bytes).version).toBe(9);
      expect(decodeDocument(bytes)).toEqual(marked);
      expect(JSON.parse(v3).version).toBe(3);
    },
  );
  it.each([1, 2, 3])(
    'rejects the new field in exact v%s, including otherwise valid notes',
    (version) => {
      const payload = JSON.parse(v1);
      payload.version = version;
      payload.document.neumes[0].notes[0].verticalEpisema = true;
      expect(() => decodeDocument(JSON.stringify(payload))).toThrow();
    },
  );
  it.each([false, 0, 1, null, 'true', {}, []])(
    'rejects explicit invalid v4 value %j and protects original cache',
    (value) => {
      const payload = JSON.parse(v3);
      payload.version = 4;
      payload.document.neumes[0].notes[0].verticalEpisema = value;
      const source = JSON.stringify(payload);
      let bytes = source;
      const adapter = new BrowserDocument(() => ({
        getItem: () => bytes,
        setItem: (_k, v) => {
          bytes = v;
        },
      }));
      expect(() => decodeDocument(source)).toThrow();
      const fallback = blankDocument();
      expect(adapter.load(fallback)).toBe(fallback);
      adapter.save(fallback);
      expect(bytes).toBe(source);
      expect(adapter.recoverySource).toBe(source);
    },
  );
  it('rejects unknown/nested fields, invalid forms, unknown version and oversized v4', () => {
    const payload = JSON.parse(encodeDocument(decodeDocument(v3)));
    const changes: ((p: {
      version: number;
      document: {
        neumes: { notes: Record<string, unknown>[] }[];
        clef: Record<string, unknown>;
      };
    }) => void)[] = [
      (p) => (p.version = 10),
      (p) => (p.document.neumes[0].notes[0].side = 'below'),
      (p) => (p.document.neumes[0].notes[0].verticalEpisema = { on: true }),
      (p) => (p.document.neumes[0].notes[0].form = 'quilisma'),
      (p) => (p.document.clef.extra = true),
    ];
    for (const change of changes) {
      const value = structuredClone(payload);
      change(value);
      expect(() => decodeDocument(JSON.stringify(value))).toThrow();
    }
    payload.document.title = 'x'.repeat(maximumDocumentBytes);
    expect(() => decodeDocument(JSON.stringify(payload))).toThrow(/1 MiB/);
  });
  it('retains withdrawn draft-v2 classification and refuses to reinterpret malformed drafts', () => {
    const payload = JSON.parse(v1);
    payload.version = 2;
    payload.document.neumes[0].notes[0].mora = 2;
    expect(() => decodeDocument(JSON.stringify(payload))).toThrow(
      IncompatibleDraftDocumentError,
    );
    payload.document.neumes[0].notes[0].verticalEpisema = true;
    try {
      decodeDocument(JSON.stringify(payload));
      throw Error('unexpected success');
    } catch (error) {
      expect(error).not.toBeInstanceOf(IncompatibleDraftDocumentError);
    }
  });
});
