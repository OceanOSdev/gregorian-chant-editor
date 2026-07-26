import type { ChantDocument, PodatusNeume } from '../domain/chant-document';
import { insertTwoNoteNeume } from './insert-two-note-neume';

export function insertPodatus(
  document: ChantDocument,
  podatus: PodatusNeume,
  insertionIndex: number,
): ChantDocument {
  return insertTwoNoteNeume(document, podatus, insertionIndex);
}
