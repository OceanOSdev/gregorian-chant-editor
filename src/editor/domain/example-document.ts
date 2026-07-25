import { staffPosition, type ChantDocument } from './chant-document'

export const exampleDocument: ChantDocument = {
  title: 'Gregorian Chant Editor',
  clef: {
    type: 'c',
    staffLine: 3,
  },
  syllables: [
    {
      id: 'syllable-alle',
      text: 'Al-',
    },
  ],
  neumes: [
    {
      id: 'neume-punctum-1',
      kind: 'punctum',
      lyricSyllableId: 'syllable-alle',
      notes: [
        {
          id: 'note-punctum-1',
          staffPosition: staffPosition(3),
        },
      ],
    },
  ],
}
