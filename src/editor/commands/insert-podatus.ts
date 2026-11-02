import type {
  ChantDocument,
  PodatusNeume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { insertNeume } from './insert-neume';

export function insertPodatus(
  document: ChantDocument,
  podatus: PodatusNeume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  return insertNeume(document, podatus, boundary);
}
