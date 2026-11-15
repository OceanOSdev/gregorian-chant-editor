import { expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { layoutChant } from '../layout/layout-chant';
import { resolveNeumeRange } from '../state/selection';
import { rangeSelectionBounds } from './range-selection-bounds';

it('segments canonical membership per system within ownership and outside lyrics', () => {
  const document: ChantDocument = {
    title: 'Overlay',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    syllables: [],
    divisions: [],
    clefChanges: [],
    accidentals: [],
    neumes: Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `p${i}`, staffPosition: staffPosition(i % 5) }],
    })),
  };
  const layout = layoutChant(document);
  const forward = resolveNeumeRange(document, {
    kind: 'neume-range',
    anchorNeumeId: 'n3',
    endpointNeumeId: 'n40',
  });
  const backward = resolveNeumeRange(document, {
    kind: 'neume-range',
    anchorNeumeId: 'n40',
    endpointNeumeId: 'n3',
  });
  expect(layout.systems.length).toBeGreaterThan(1);
  for (const system of layout.systems) {
    const bounds = rangeSelectionBounds(system, forward?.ids);
    expect(bounds).toEqual(rangeSelectionBounds(system, backward?.ids));
    const members = system.neumes.filter((n) => forward?.ids.has(n.neumeId));
    if (!members.length) expect(bounds).toBeNull();
    else {
      expect(bounds?.x).toBeLessThanOrEqual(members[0].bounds.x);
      for (const n of system.neumes.filter(
        (n) => !forward?.ids.has(n.neumeId),
      )) {
        expect(
          !bounds ||
            n.bounds.x + n.bounds.width <= bounds.x ||
            n.bounds.x >= bounds.x + bounds.width,
        ).toBe(true);
      }
    }
  }
});
