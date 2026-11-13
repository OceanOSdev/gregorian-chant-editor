import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { entryPitchCases } from '../neume-entry-pitches.test-cases';
import { layoutChant, staffPositionY } from '../layout/layout-chant';
import { resolveGraphicalNeumePlacement } from './resolve-graphical-neume-placement';
import { resolveEditorToolbarInsertion } from './insert-editor-neume';

const empty: ChantDocument = {
  accidentals: [],
  title: 'Entry',
  clef: { type: 'c', staffLine: 3 },
  lyricLanguage: 'la',
  neumes: [],
  syllables: [],
  clefChanges: [],
  divisions: [],
};

const document: ChantDocument = {
  ...empty,
  neumes: [
    {
      id: 'selected',
      kind: 'podatus',
      notes: [
        { id: 'lower', staffPosition: staffPosition(-1) },
        { id: 'upper', staffPosition: staffPosition(2) },
      ],
    },
    {
      id: 'end',
      kind: 'punctum',
      notes: [{ id: 'last', staffPosition: staffPosition(7) }],
    },
  ],
};

describe.each(Object.values(entryPitchCases))(
  '$kind entry paths',
  ({ kind, offsets, fallback }) => {
    it.each([
      {
        selection: { kind: 'note', noteId: 'lower' },
        first: -1,
        insertionIndex: 1,
        beforeNeumeId: 'end',
      },
      {
        selection: { kind: 'neume', neumeId: 'selected' },
        first: 2,
        insertionIndex: 1,
        beforeNeumeId: 'end',
      },
      {
        selection: { kind: 'none' },
        first: 7,
        insertionIndex: 2,
        beforeNeumeId: null,
      },
    ] as const)(
      'uses $selection.kind reference pitch $first and its insertion boundary',
      ({ selection, first, insertionIndex, beforeNeumeId }) => {
        const toolbar = resolveEditorToolbarInsertion(
          document,
          selection,
          kind,
        );
        const expected = offsets.map((offset) => first + offset);
        expect(toolbar).toEqual({
          kind,
          staffPositions: expected,
          insertionIndex,
          boundary: {
            beforeNeumeId,
            beforeDivisionId: null,
            beforeClefId: null,
          },
        });

        const layout = layoutChant(document);
        const system = layout.systems[0];
        const slot = system?.slots.find(
          (candidate) => candidate.insertionIndex === insertionIndex,
        );
        if (!system || !slot) throw new Error('Missing insertion slot');
        const graphical = resolveGraphicalNeumePlacement(layout, kind, {
          x: slot.x,
          y: staffPositionY(
            staffPosition(first),
            Math.max(...system.staffLines.map((line) => line.y)),
          ),
        });
        expect(graphical?.staffPositions).toEqual(expected);
        expect(graphical?.boundary).toEqual(toolbar?.boundary);
      },
    );

    it('preserves the empty-score toolbar fallback', () => {
      expect(
        resolveEditorToolbarInsertion(empty, { kind: 'none' }, kind)
          ?.staffPositions,
      ).toEqual(offsets.map((offset) => fallback + offset));
    });
  },
);
