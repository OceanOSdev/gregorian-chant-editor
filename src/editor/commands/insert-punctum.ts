import type {
  ChantDocument,
  PunctumNeume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { insertNeume } from './insert-neume';

export function insertPunctum(
  document: ChantDocument,
  punctum: PunctumNeume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  return insertNeume(document, punctum, boundary);
}
