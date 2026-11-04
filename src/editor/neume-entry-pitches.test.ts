import { describe, expect, it } from 'vitest';
import { staffPosition } from './domain/chant-document';
import { createNeumeEntryPitches } from './neume-entry-pitches';
import { entryPitchCases } from './neume-entry-pitches.test-cases';

describe.each(Object.values(entryPitchCases))(
  '$kind entry pitches',
  ({ kind, offsets }) => {
    it.each([-1, 2, 7])('constructs the exact contour at %i', (first) => {
      expect(createNeumeEntryPitches(kind, staffPosition(first))).toEqual({
        kind,
        staffPositions: offsets.map((offset) => first + offset),
      });
    });
  },
);
