import {
  staffPosition,
  type ChantDocument,
  type Clef,
  type ClefChange,
  type Neume,
} from './domain/chant-document';
export const punctum = (id: string, position = 2): Neume => ({
  id,
  kind: 'punctum',
  notes: [{ id: `note-${id}`, staffPosition: staffPosition(position) }],
});
export const fixture = (): ChantDocument => ({
  title: 'Clef passages',
  clef: { type: 'c', staffLine: 3 },
  clefChanges: [],
  divisions: [],
  lyricLanguage: 'la',
  syllables: [],
  neumes: ['A', 'B', 'E'].map((id) => punctum(id)),
});
export const change = (
  id: string,
  beforeNeumeId: string | null = 'B',
  beforeDivisionId: string | null = null,
  clef: Clef = { type: 'c', staffLine: 4 },
): ClefChange => ({ id, beforeNeumeId, beforeDivisionId, clef });
