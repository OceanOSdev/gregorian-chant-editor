import type {
  ChantDocument,
  ClivisNeume,
  PodatusNeume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { insertNeume } from './insert-neume';

export type TwoNoteNeume = PodatusNeume | ClivisNeume;

export function insertTwoNoteNeume(
  document: ChantDocument,
  neume: TwoNoteNeume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  return insertNeume(document, neume, boundary);
}
