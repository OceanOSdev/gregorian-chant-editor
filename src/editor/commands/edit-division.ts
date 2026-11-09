import type {
  ChantDocument,
  ChantDivision,
  DivisionKind,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import {
  deriveScoreOrder,
  reanchorScoreOrder,
  hasValidDivisions,
  isDivisionKind,
  isValidDivision,
  resolveScoreBoundary,
  semanticIds,
} from '../domain/divisions';

export function insertDivision(
  document: ChantDocument,
  division: ChantDivision,
  boundary: ScoreInsertionBoundary,
): ChantDocument {
  const resolved = resolveScoreBoundary(document, boundary);
  if (
    !resolved ||
    !isValidDivision(division) ||
    division.beforeNeumeId !== boundary.beforeNeumeId ||
    semanticIds(document).includes(division.id) ||
    document.divisions.some((d) => d.id === division.id)
  )
    return document;
  const order = deriveScoreOrder(document);
  if (!order) return document;
  order.splice(resolved.scoreIndex, 0, { type: 'division', entity: division });
  return { ...document, ...reanchorScoreOrder(order) };
}

export function updateDivisionKind(
  document: ChantDocument,
  id: string,
  kind: DivisionKind,
): ChantDocument {
  if (
    !hasValidDivisions(document) ||
    !isDivisionKind(kind) ||
    !document.divisions.some((d) => d.id === id && d.kind !== kind)
  )
    return document;
  return {
    ...document,
    divisions: document.divisions.map((d) =>
      d.id === id ? { ...d, kind } : d,
    ),
  };
}

export function deleteDivision(
  document: ChantDocument,
  id: string,
): ChantDocument {
  if (
    !hasValidDivisions(document) ||
    !document.divisions.some((d) => d.id === id)
  )
    return document;
  return {
    ...document,
    ...reanchorScoreOrder(
      (deriveScoreOrder(document) ?? []).filter(
        (item) => item.entity.id !== id,
      ),
    ),
  };
}
