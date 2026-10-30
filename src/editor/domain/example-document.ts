import { staffPosition, type ChantDocument } from './chant-document';

export const exampleDocument: ChantDocument = {
  title: 'Gregorian Chant Editor',
  clef: {
    type: 'c',
    staffLine: 3,
  },
  syllables: [
    {
      id: 'syllable-alle',
      text: 'Al',
      startsAtNeumeId: 'neume-punctum-1',
      boundaryBefore: 'word',
    },
  ],
  neumes: [
    {
      id: 'neume-punctum-1',
      kind: 'punctum',
      notes: [
        {
          id: 'note-punctum-1',
          staffPosition: staffPosition(3),
        },
      ],
    },
    {
      id: 'neume-torculus-1',
      kind: 'torculus',
      notes: [
        {
          id: 'note-torculus-1',
          staffPosition: staffPosition(2),
        },
        {
          id: 'note-torculus-2',
          staffPosition: staffPosition(4),
        },
        {
          id: 'note-torculus-3',
          staffPosition: staffPosition(3),
        },
      ],
    },
  ],
};
