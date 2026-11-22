import { describe, expect, it } from 'vitest';
import { exampleDocument } from '../domain/example-document';
import type { LyricDraft, LyricEntry } from '../state/lyric-entry';
import {
  resolveNeumeForNoteActivation,
  resolveNoteActivation,
} from './score-note-activation';

const draft: LyricDraft = {
  kind: 'draft',
  neumeId: 'neume-punctum-1',
  original: null,
  text: 'Al',
  boundaryBefore: 'word',
};
const ordinaryEntries: LyricEntry[] = [
  draft,
  { kind: 'ready', neumeId: 'neume-punctum-1' },
  { kind: 'selected', syllableId: 'syllable-alle' },
  { kind: 'occupied', syllableId: 'syllable-alle' },
  {
    kind: 'end',
    afterNeumeId: 'neume-punctum-1',
    remainingSkips: 0,
    boundaryBefore: 'word',
  },
];
const recovery: LyricEntry = { kind: 'recovery', draft };
const torculusNote = 'note-torculus-1';

describe('resolveNoteActivation', () => {
  it('selects the note outside lyric entry', () => {
    expect(resolveNoteActivation(exampleDocument, null, torculusNote)).toEqual({
      type: 'select-note',
    });
  });

  it.each(ordinaryEntries)(
    'navigates a $kind lyric entry to the note’s neume',
    (lyrics) => {
      expect(
        resolveNoteActivation(exampleDocument, lyrics, torculusNote),
      ).toEqual({ type: 'navigate-lyrics', neumeId: 'neume-torculus-1' });
    },
  );

  it('selects instead of navigating a recovery entry', () => {
    expect(
      resolveNoteActivation(exampleDocument, recovery, torculusNote),
    ).toEqual({ type: 'select-note' });
  });

  it('still selects a missing note, with or without lyric entry', () => {
    for (const lyrics of [null, draft, recovery])
      expect(resolveNoteActivation(exampleDocument, lyrics, 'missing')).toEqual(
        { type: 'select-note' },
      );
  });
});

describe('resolveNeumeForNoteActivation', () => {
  it('extends the selection outside lyric entry', () => {
    expect(
      resolveNeumeForNoteActivation(exampleDocument, null, torculusNote),
    ).toEqual({ type: 'extend-selection' });
  });

  it.each(ordinaryEntries)(
    'navigates a $kind lyric entry instead of extending the selection',
    (lyrics) => {
      expect(
        resolveNeumeForNoteActivation(exampleDocument, lyrics, torculusNote),
      ).toEqual({ type: 'navigate-lyrics', neumeId: 'neume-torculus-1' });
    },
  );

  it('extends the selection instead of navigating a recovery entry', () => {
    expect(
      resolveNeumeForNoteActivation(exampleDocument, recovery, torculusNote),
    ).toEqual({ type: 'extend-selection' });
  });

  it('does nothing for a missing note, with or without lyric entry', () => {
    for (const lyrics of [null, draft, recovery])
      expect(
        resolveNeumeForNoteActivation(exampleDocument, lyrics, 'missing'),
      ).toBeNull();
  });
});
