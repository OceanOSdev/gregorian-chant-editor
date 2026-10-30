import { expect, it } from 'vitest';
import { exampleDocument } from '../domain/example-document';
import { staffPosition } from '../domain/chant-document';
import { resolveToolbarNeumeInsertion } from './resolve-toolbar-neume-insertion';
it('uses any selected note regardless of lyrics', () => {
  expect(
    resolveToolbarNeumeInsertion(
      { ...exampleDocument, syllables: [] },
      { kind: 'note', noteId: 'note-punctum-1' },
      staffPosition(2),
    ),
  ).toEqual({ insertionIndex: 1, referenceStaffPosition: 3 });
});
it('uses whole-neume selection and appends without selection', () => {
  expect(
    resolveToolbarNeumeInsertion(
      exampleDocument,
      { kind: 'neume', neumeId: 'neume-torculus-1' },
      staffPosition(2),
    ),
  ).toEqual({ insertionIndex: 2, referenceStaffPosition: 3 });
  expect(
    resolveToolbarNeumeInsertion(
      exampleDocument,
      { kind: 'none' },
      staffPosition(2),
    ),
  ).toEqual({ insertionIndex: 2, referenceStaffPosition: 3 });
  expect(
    resolveToolbarNeumeInsertion(
      { ...exampleDocument, neumes: [], syllables: [] },
      { kind: 'none' },
      staffPosition(2),
    ),
  ).toEqual({ insertionIndex: 0, referenceStaffPosition: 2 });
});
