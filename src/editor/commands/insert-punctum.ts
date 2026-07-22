import type {
  ChantDocument,
  Punctum,
} from '../domain/chant-document'

export function insertPunctum(
  document: ChantDocument,
  punctum: Punctum,
  insertionIndex: number,
): ChantDocument {
  return {
    ...document,
    notes: [
      ...document.notes.slice(0, insertionIndex),
      punctum,
      ...document.notes.slice(insertionIndex),
    ],
  }
}
