import type {
  ChantDocument,
  TorculusNeume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import { insertNeume } from './insert-neume';

export function insertTorculus(
  document: ChantDocument,
  torculus: TorculusNeume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  return insertNeume(document, torculus, boundary);
}
