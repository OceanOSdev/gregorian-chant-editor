import { reconcileAccidentals } from '../domain/accidentals';
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

function insertDivisionCandidate(
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

function updateDivisionKindCandidate(
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

function deleteDivisionCandidate(
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

export function insertDivision(
  ...args: Parameters<typeof insertDivisionCandidate>
): ChantDocument {
  return (
    reconcileAccidentals(args[0], insertDivisionCandidate(...args)) ?? args[0]
  );
}

export function updateDivisionKind(
  ...args: Parameters<typeof updateDivisionKindCandidate>
): ChantDocument {
  return (
    reconcileAccidentals(args[0], updateDivisionKindCandidate(...args)) ??
    args[0]
  );
}

export function deleteDivision(
  ...args: Parameters<typeof deleteDivisionCandidate>
): ChantDocument {
  return (
    reconcileAccidentals(args[0], deleteDivisionCandidate(...args)) ?? args[0]
  );
}
