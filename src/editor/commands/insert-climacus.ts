import type {
  ChantDocument,
  ClimacusNeume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { insertNeume } from './insert-neume';

export function insertClimacus(
  document: ChantDocument,
  climacus: ClimacusNeume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  return insertNeume(document, climacus, boundary);
}
