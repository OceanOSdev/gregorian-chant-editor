import type {
  ChantDocument,
  PorrectusNeume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { insertNeume } from './insert-neume';

export function insertPorrectus(
  document: ChantDocument,
  porrectus: PorrectusNeume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  return insertNeume(document, porrectus, boundary);
}
