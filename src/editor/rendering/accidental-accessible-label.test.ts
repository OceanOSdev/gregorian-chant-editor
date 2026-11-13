import { expect, it } from 'vitest';
import type { AccidentalLayout } from '../layout/layout-chant';
import { buildAccidentalGeometry } from '../layout/accidental-geometry';
import { getAccidentalAccessibleLabel } from './accidental-accessible-label';

const sign: AccidentalLayout = {
  ...buildAccidentalGeometry('flat', 100, 80),
  accidentalId: 'flat',
  owner: {
    noteId: 'b',
    noteIndex: 2,
    neumeId: 'owner',
    neumeIndex: 4,
    neumeKind: 'scandicus',
  },
  placement: null,
};
it('describes the musical owner and default whole-neume placement', () => {
  expect(getAccidentalAccessibleLabel(sign)).toBe(
    'Written B-flat, owned by note 3 of scandicus 5, before owning neume',
  );
});
it('describes an earlier engraving anchor separately from B ownership', () => {
  expect(
    getAccidentalAccessibleLabel({
      ...sign,
      kind: 'natural',
      placement: {
        noteId: 'f',
        noteIndex: 1,
        neumeId: 'anchor',
        neumeIndex: 1,
        neumeKind: 'climacus',
      },
    }),
  ).toBe(
    'Written B-natural, owned by note 3 of scandicus 5, above note 2 of climacus 2',
  );
});
