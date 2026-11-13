import { reconcileAccidentals } from '../domain/accidentals';
import type {
  ChantDocument,
  Neume,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import {
  deriveScoreOrder,
  reanchorScoreOrder,
  hasValidDivisions,
  resolveScoreBoundary,
  semanticIds,
} from '../domain/divisions';
import { isValidNeume } from '../domain/neume';

function insertNeumeCandidate(
  document: ChantDocument,
  neume: Neume,
  boundary: number | ScoreInsertionBoundary,
): ChantDocument {
  if (!hasValidDivisions(document) || !isValidNeume(neume)) return document;
  let intent: ScoreInsertionBoundary;
  if (typeof boundary === 'number') {
    if (
      !Number.isInteger(boundary) ||
      boundary < 0 ||
      boundary > document.neumes.length
    )
      return document;
    const beforeNeumeId = document.neumes[boundary]?.id ?? null;
    if (
      document.divisions.some((d) => d.beforeNeumeId === beforeNeumeId) ||
      document.clefChanges.some((c) => c.beforeNeumeId === beforeNeumeId)
    )
      return document;
    intent = { beforeNeumeId, beforeDivisionId: null };
  } else intent = boundary;
  const resolved = resolveScoreBoundary(document, intent);
  if (!resolved) return document;
  const ids = [neume.id, ...neume.notes.map((n) => n.id)];
  const existing = new Set([
    ...semanticIds(document),
    ...document.divisions.map((d) => d.id),
  ]);
  if (
    ids.some(
      (id) => typeof id !== 'string' || !id.trim() || existing.has(id),
    ) ||
    new Set(ids).size !== ids.length
  )
    return document;
  const order = deriveScoreOrder(document);
  if (!order) return document;
  order.splice(resolved.scoreIndex, 0, { type: 'neume', entity: neume });
  return {
    ...document,
    ...reanchorScoreOrder(order),
    neumes: [
      ...document.neumes.slice(0, resolved.neumeIndex),
      neume,
      ...document.neumes.slice(resolved.neumeIndex),
    ],
  };
}

export function insertNeume(
  ...args: Parameters<typeof insertNeumeCandidate>
): ChantDocument {
  return (
    reconcileAccidentals(args[0], insertNeumeCandidate(...args)) ?? args[0]
  );
}
