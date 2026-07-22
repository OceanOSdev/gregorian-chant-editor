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
  notes: [
    {
      id: 'note-punctum-1',
      kind: 'punctum',
      staffPosition: staffPosition(3),
      lyricSyllableId: 'syllable-alle',
    },
  ],
}
