import { describe, expect, it } from 'vitest';
import { auditioneCorpus } from '../../../docs/verification/word-composition/auditione';
import { compositionCorpus } from '../../../docs/verification/word-composition/corpus';
import { inspectCorpusCase } from '../../../docs/verification/word-composition/inspect-corpus';
import { layoutChant } from './layout-chant';
import type { MeasureLyricText } from './lyric-text-metrics';

describe.each([...compositionCorpus, ...auditioneCorpus])(
  '$name / $arrangement',
  (sample) => {
    it.each([6, 10, 16])(
      'preserves relative engraving invariants at %i-unit synthetic glyph advances',
      (unit) => {
        const measure: MeasureLyricText = (text) => {
          const widths = [...text].map(
            (c) =>
              unit * ('il'.includes(c) ? 0.45 : 'mW'.includes(c) ? 1.4 : 1),
          );
          const boundaries = [0];
          for (const w of widths) boundaries.push((boundaries.at(-1) ?? 0) + w);
          return {
            width: boundaries.at(-1) ?? 0,
            boundaries,
            inkBounds: { left: -0.3, right: (boundaries.at(-1) ?? 0) + 0.4 },
          };
        };
        const original = JSON.stringify(sample.document);
        const layout = layoutChant(sample.document, measure);
        expect(inspectCorpusCase(sample, layout, measure).errors).toEqual([]);
        expect(JSON.stringify(sample.document)).toBe(original);
        if (sample.arrangement === 'break')
          expect(layout.systems.length).toBeGreaterThan(1);
      },
    );
  },
);

it('detects a plausible but incorrect continuation at an explicit word boundary', () => {
  const sample = compositionCorpus.find(
    (s) => s.name === 'Kyrie eleison' && s.arrangement === 'puncta',
  );
  expect(sample).toBeDefined();
  if (!sample) return;
  const corrupted = {
    ...sample,
    document: {
      ...sample.document,
      syllables: sample.document.syllables.map((s, i) =>
        i === 3 ? { ...s, boundaryBefore: 'continuation' as const } : s,
      ),
    },
  };
  const measure: MeasureLyricText = (text) => ({
    width: text.length * 10,
    boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 10),
  });
  expect(
    inspectCorpusCase(
      corrupted,
      layoutChant(corrupted.document, measure),
      measure,
    ).errors,
  ).toContain('word metadata differs from editorial corpus');
});
