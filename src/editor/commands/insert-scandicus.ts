import type {
  ChantDocument,
  ScandicusNeume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { insertNeume } from './insert-neume';

export function insertScandicus(
  document: ChantDocument,
  scandicus: ScandicusNeume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  return insertNeume(document, scandicus, boundary);
}
