import type {
  ChantDocument,
  ClivisNeume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { insertNeume } from './insert-neume';

export function insertClivis(
  document: ChantDocument,
  clivis: ClivisNeume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  return insertNeume(document, clivis, boundary);
}
