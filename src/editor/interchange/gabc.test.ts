import { staffPosition } from '../domain/chant-document';
import { describe, expect, it } from 'vitest';
import { demoDocument } from '../../app/demo-document';
import { createChant } from '../persistence/chant-file';
import { importGabc, exportGabc } from './gabc';
const musical = (document: typeof demoDocument) => ({
  title: document.title,
  clef: document.clef,
  language: document.lyricLanguage,
  neumes: document.neumes.map((n) => ({
    kind: n.kind,
    pitches: n.notes.map((v) => v.staffPosition),
  })),
  syllables: document.syllables.map((s) => ({
    text: s.text,
    boundary: s.boundaryBefore,
    anchor: document.neumes.findIndex((n) => n.id === s.startsAtNeumeId),
  })),
});
describe('bounded GABC adapter', () => {
  it('round trips all seven neume kinds and word boundaries', () => {
    expect(musical(importGabc(exportGabc(demoDocument)))).toEqual(
      musical(demoDocument),
    );
  });
  it('preserves melismas, lyricless prefixes, arbitrary supported pitches, and clef lines', () => {
    const score = importGabc(
      'name: Test;\n%%\n(c1)(ab/c) Ky(d/fe)ri(ghi) e(hGF/fhf)',
    );
    expect(score.neumes[0].notes.map((n) => n.staffPosition)).toEqual([-3, -2]);
    expect(score.neumes[2].notes[0].staffPosition).toBe(0);
    expect(musical(importGabc(exportGabc(score)))).toEqual(musical(score));
  });
  it('round trips an empty score', () => {
    expect(musical(importGabc(exportGabc(createChant())))).toEqual(
      musical(createChant()),
    );
  });
  it.each([
    '(c4) Ky(f.)',
    '(c4) Ky(f) (::)',
    '(f3) Ky(f)',
    '(c4) Ky(fghij)',
    '(c4) Ky(ff)',
    '(c4) <b>Ky</b>(f)',
    '(c4) Ky(hgf)',
    '(c4) Ky(f) garbage',
  ])('rejects unsupported syntax: %s', (body) => {
    expect(() => importGabc('name: Test;\n%%\n' + body)).toThrow();
  });
  it('does not silently discard GABC syntax outside its vocabulary', () => {
    expect(() =>
      importGabc('name: Test;\ninitial-style: 0;\n%%\n(c4) Ky(f)'),
    ).toThrow('header');
    const score = structuredClone(demoDocument);
    score.neumes[0].notes[0].staffPosition = staffPosition(52);
    expect(() => exportGabc(score)).toThrow('staff positions');
  });
});

it('rejects delimiter characters in exported titles and markup-like lyrics', () => {
  for (const title of ['Kyrie %% probe', 'Kyrie; eleison', 'Kyrie\nEleison']) {
    expect(() => exportGabc({ ...demoDocument, title })).toThrow();
  }
  for (const text of ['a~b', 'a\\b', 'a*b']) {
    const score = structuredClone(demoDocument);
    score.syllables[0].text = text;
    expect(() => exportGabc(score)).toThrow();
    expect(() => importGabc(`name: Test;\n%%\n(c4) ${text}(f)`)).toThrow();
  }
  expect(
    importGabc('name: Test;\nlanguage: Latin ;\n%%\n(c4) Ky(f)').lyricLanguage,
  ).toBe('la');
});
