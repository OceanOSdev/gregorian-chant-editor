import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from './domain/chant-document';
import { createNeumeEntryPitches } from './neume-entry-pitches';
import { layoutChant } from './layout/layout-chant';
import { resolveGraphicalNeumePlacement } from './interaction/resolve-graphical-neume-placement';
import { resolveEditorToolbarInsertion } from './interaction/insert-editor-neume';

const empty: ChantDocument = {
  title: 'Entry',
  clef: { type: 'c', staffLine: 3 },
  lyricLanguage: 'la',
  neumes: [],
  syllables: [],
  divisions: [],
};

const contours = [
  ['punctum', [0], 2],
  ['podatus', [0, 1], 2],
  ['clivis', [0, -1], 3],
  ['scandicus', [0, 1, 2], 2],
  ['torculus', [0, 2, 1], 2],
  ['climacus', [0, -1, -2], 3],
  ['porrectus', [0, -2, -1], 3],
] as const;

describe.each(contours)('%s entry pitches', (kind, offsets, fallback) => {
  it.each([-1, 2, 7])(
    'preserves the contour and both entry paths at %i',
    (first) => {
      const expected = offsets.map((offset) => first + offset);
      expect(createNeumeEntryPitches(kind, staffPosition(first))).toEqual({
        kind,
        staffPositions: expected,
      });
      const document: ChantDocument = {
        ...empty,
        neumes: [
          {
            id: 'reference',
            kind: 'punctum',
            notes: [{ id: 'note', staffPosition: staffPosition(first) }],
          },
        ],
      };
      const layout = layoutChant(document);
      const system = layout.systems[0];
      if (!system) throw new Error('Missing system');
      const graphical = resolveGraphicalNeumePlacement(layout, kind, {
        x: 300,
        y: Math.max(...system.staffLines.map((line) => line.y)) - first * 12,
      });
      expect(graphical?.staffPositions).toEqual(expected);
      for (const selection of [
        { kind: 'note', noteId: 'note' },
        { kind: 'neume', neumeId: 'reference' },
        { kind: 'none' },
      ] as const) {
        const toolbar = resolveEditorToolbarInsertion(
          document,
          selection,
          kind,
        );
        expect(toolbar?.staffPositions).toEqual(expected);
        expect(toolbar?.boundary).toEqual(graphical?.boundary);
      }
    },
  );

  it('preserves the empty-score toolbar fallback', () => {
    expect(
      resolveEditorToolbarInsertion(empty, { kind: 'none' }, kind)
        ?.staffPositions,
    ).toEqual(offsets.map((offset) => fallback + offset));
  });
});
