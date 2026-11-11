import { describe, expect, it } from 'vitest';
import source from './pater-noster.chant.json?raw';
import { bundledExamples, loadBundledExample } from './bundled-examples';
import { decodeDocument, encodeDocument } from '../persistence/native-document';

const exampleSources = import.meta.glob<string>('./*.chant.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('bundled examples', () => {
  it('registers every discovered source in display-name order', () => {
    expect(bundledExamples.map((example) => example.id).sort()).toEqual(
      Object.keys(exampleSources).sort(),
    );
    const names = bundledExamples.map((example) => example.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it.each(Object.entries(exampleSources))(
    'validates and round-trips %s',
    (id, contents) => {
      const document = decodeDocument(contents);
      expect(bundledExamples.find((example) => example.id === id)?.name).toBe(
        document.title,
      );
      expect(loadBundledExample(id)).toEqual(document);
      expect(decodeDocument(encodeDocument(document))).toEqual(document);
      expect(loadBundledExample(id)).not.toBe(loadBundledExample(id));
    },
  );

  it.each(['unknown', 'toString', 'constructor', '__proto__'])(
    'rejects unknown ID %s',
    (id) => {
      expect(() => loadBundledExample(id)).toThrow('Unknown bundled example');
    },
  );
});

describe('bundled Pater Noster', () => {
  it('loads the complete owner-authored v4 document with vertical episemata intact', () => {
    const chantId = './pater-noster.chant.json';
    const document = loadBundledExample(chantId);
    expect(JSON.parse(source).version).toBe(4);
    expect(document).toEqual(JSON.parse(source).document);
    expect(document.title).toBe('Pater Noster');
    expect(document.lyricLanguage).toBe('la');
    expect(document.clef).toEqual({ type: 'c', staffLine: 3 });
    expect(document.neumes).toHaveLength(103);
    expect(document.syllables).toHaveLength(103);
    expect(document.divisions).toHaveLength(13);
    expect(document.neumes.filter((n) => n.kind === 'punctum')).toHaveLength(
      95,
    );
    expect(document.neumes.filter((n) => n.kind === 'clivis')).toHaveLength(4);
    expect(document.neumes.filter((n) => n.kind === 'podatus')).toHaveLength(4);
    const notes = document.neumes.flatMap((n) => [...n.notes]);
    expect(notes).toHaveLength(111);
    expect(notes.filter((n) => n.mora === 1)).toHaveLength(10);
    expect(notes.filter((n) => n.episema)).toHaveLength(3);
    expect(notes.filter((n) => n.verticalEpisema)).toHaveLength(5);
    expect(
      document.syllables
        .slice(-8)
        .map((s) => `${s.boundaryBefore === 'word' ? ' ' : ''}${s.text}`)
        .join('')
        .trim(),
    ).toBe('sed libera nos a malo.');
    expect(decodeDocument(encodeDocument(document))).toEqual(document);
    expect(loadBundledExample(chantId)).not.toBe(document);
  });
  it('rejects unknown choices', () => {
    expect(() => loadBundledExample('unknown')).toThrow(
      'Unknown bundled example',
    );
  });
});
