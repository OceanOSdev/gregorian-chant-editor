import type { ChantDocument, ClivisNeume } from '../domain/chant-document';
import { insertTwoNoteNeume } from './insert-two-note-neume';

export function insertClivis(
  document: ChantDocument,
  clivis: ClivisNeume,
  insertionIndex: number,
): ChantDocument {
  return insertTwoNoteNeume(document, clivis, insertionIndex);
}
