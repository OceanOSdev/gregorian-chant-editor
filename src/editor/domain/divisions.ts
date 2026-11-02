import type {
  ChantDocument,
  ChantDivision,
  DivisionKind,
  Neume,
  ScoreInsertionBoundary,
} from './chant-document';

export function isDivisionKind(value: unknown): value is DivisionKind {
  return (
    value === 'minima' ||
    value === 'minor' ||
    value === 'maior' ||
    value === 'finalis'
  );
}

export function semanticIds(document: ChantDocument): string[] {
  return [
    ...document.neumes.flatMap((n) => [
      n.id,
      ...n.notes.map((note) => note.id),
    ]),
    ...document.syllables.map((s) => s.id),
  ];
}

export function isValidDivision(value: unknown): value is ChantDivision {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    d.id.trim().length > 0 &&
    isDivisionKind(d.kind) &&
    (d.beforeNeumeId === null || typeof d.beforeNeumeId === 'string') &&
    Object.keys(d).every((key) => ['id', 'kind', 'beforeNeumeId'].includes(key))
  );
}

/** Array order is authoritative only among divisions sharing a boundary. */
export function hasValidDivisions(document: ChantDocument): boolean {
  if (!Array.isArray(document.divisions)) return false;
  const ids = new Set(semanticIds(document));
  return document.divisions.every((d) => {
    if (
      !isValidDivision(d) ||
      ids.has(d.id) ||
      (d.beforeNeumeId !== null &&
        !document.neumes.some((n) => n.id === d.beforeNeumeId))
    )
      return false;
    ids.add(d.id);
    return true;
  });
}

export type ScoreItem =
  | { type: 'neume'; entity: Neume }
  | { type: 'division'; entity: ChantDivision };

/** Invalid runtime data is rejected rather than dropping punctuation. */
export function deriveScoreOrder(document: ChantDocument): ScoreItem[] | null {
  if (!hasValidDivisions(document)) return null;
  const result: ScoreItem[] = [];
  for (const neume of document.neumes) {
    result.push(
      ...document.divisions
        .filter((d) => d.beforeNeumeId === neume.id)
        .map((entity) => ({ type: 'division' as const, entity })),
    );
    result.push({ type: 'neume', entity: neume });
  }
  result.push(
    ...document.divisions
      .filter((d) => d.beforeNeumeId === null)
      .map((entity) => ({ type: 'division' as const, entity })),
  );
  return result;
}

export function resolveScoreBoundary(
  document: ChantDocument,
  boundary: ScoreInsertionBoundary,
): { neumeIndex: number; precedingDivisions: ChantDivision[] } | null {
  if (!hasValidDivisions(document) || !boundary || typeof boundary !== 'object')
    return null;
  const neumeIndex =
    boundary.beforeNeumeId === null
      ? document.neumes.length
      : document.neumes.findIndex((n) => n.id === boundary.beforeNeumeId);
  if (neumeIndex < 0) return null;
  const divisions = document.divisions.filter(
    (d) => d.beforeNeumeId === boundary.beforeNeumeId,
  );
  const slot =
    boundary.beforeDivisionId === null
      ? divisions.length
      : divisions.findIndex((d) => d.id === boundary.beforeDivisionId);
  return slot < 0
    ? null
    : { neumeIndex, precedingDivisions: divisions.slice(0, slot) };
}
