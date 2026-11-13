import type {
  ChantDocument,
  ChantDivision,
  ClefChange,
  DivisionKind,
  Neume,
  ScoreInsertionBoundary,
} from './chant-document';
import { isValidClef } from './clef';

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
    ...document.accidentals.map((a) => a.id),
    ...document.neumes.flatMap((n) => [
      n.id,
      ...n.notes.map((note) => note.id),
    ]),
    ...document.syllables.map((s) => s.id),
    ...document.clefChanges.map((c) => c.id),
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

export function isValidClefChange(value: unknown): value is ClefChange {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    !!c.id.trim() &&
    isValidClef(c.clef) &&
    (c.beforeNeumeId === null || typeof c.beforeNeumeId === 'string') &&
    (c.beforeDivisionId === null || typeof c.beforeDivisionId === 'string') &&
    Object.keys(c).every((key) =>
      ['id', 'clef', 'beforeNeumeId', 'beforeDivisionId'].includes(key),
    )
  );
}

/** Validate independent collections together, including shared identity and slots. */
export function hasValidDivisions(document: ChantDocument): boolean {
  if (
    !Array.isArray(document.divisions) ||
    !Array.isArray(document.clefChanges)
  )
    return false;
  const baseIds = [
    ...document.neumes.flatMap((n) => [
      n.id,
      ...n.notes.map((note) => note.id),
    ]),
    ...document.syllables.map((s) => s.id),
  ];
  const ids = new Set(baseIds);
  if (
    ids.size !== baseIds.length ||
    baseIds.some((id) => typeof id !== 'string' || !id.trim())
  )
    return false;
  const hasAnchor = (id: string | null) =>
    id === null || document.neumes.some((n) => n.id === id);
  for (const d of document.divisions) {
    if (!isValidDivision(d) || ids.has(d.id) || !hasAnchor(d.beforeNeumeId))
      return false;
    ids.add(d.id);
  }
  for (const c of document.clefChanges) {
    if (
      !isValidClefChange(c) ||
      ids.has(c.id) ||
      !hasAnchor(c.beforeNeumeId) ||
      (c.beforeDivisionId !== null &&
        !document.divisions.some(
          (d) =>
            d.id === c.beforeDivisionId && d.beforeNeumeId === c.beforeNeumeId,
        ))
    )
      return false;
    ids.add(c.id);
  }
  return true;
}

export type ScoreItem =
  | { type: 'neume'; entity: Neume }
  | { type: 'division'; entity: ChantDivision }
  | { type: 'clef'; entity: ClefChange };

/** Collection order is authoritative only inside the corresponding boundary slot. */
export function deriveScoreOrder(document: ChantDocument): ScoreItem[] | null {
  if (!hasValidDivisions(document)) return null;
  const result: ScoreItem[] = [];
  for (const neume of [...document.neumes, null]) {
    const beforeNeumeId = neume?.id ?? null;
    for (const division of [
      ...document.divisions.filter((d) => d.beforeNeumeId === beforeNeumeId),
      null,
    ]) {
      result.push(
        ...document.clefChanges
          .filter(
            (c) =>
              c.beforeNeumeId === beforeNeumeId &&
              c.beforeDivisionId === (division?.id ?? null),
          )
          .map((entity) => ({ type: 'clef' as const, entity })),
      );
      if (division) result.push({ type: 'division', entity: division });
    }
    if (neume) result.push({ type: 'neume', entity: neume });
  }
  return result;
}

/** Exact boundary before the indexed event (or at score end). */
export function scoreBoundaryAt(
  order: readonly ScoreItem[],
  index: number,
): ScoreInsertionBoundary {
  const next = order[index];
  if (!next)
    return { beforeNeumeId: null, beforeDivisionId: null, beforeClefId: null };
  if (next.type === 'clef')
    return {
      beforeNeumeId: next.entity.beforeNeumeId,
      beforeDivisionId: next.entity.beforeDivisionId,
      beforeClefId: next.entity.id,
    };
  if (next.type === 'division')
    return {
      beforeNeumeId: next.entity.beforeNeumeId,
      beforeDivisionId: next.entity.id,
      beforeClefId: null,
    };
  return {
    beforeNeumeId: next.entity.id,
    beforeDivisionId: null,
    beforeClefId: null,
  };
}

export function resolveScoreBoundary(
  document: ChantDocument,
  boundary: ScoreInsertionBoundary,
): {
  neumeIndex: number;
  precedingDivisions: ChantDivision[];
  precedingClefs: ClefChange[];
  scoreIndex: number;
} | null {
  const order = deriveScoreOrder(document);
  if (!order || !boundary || typeof boundary !== 'object') return null;
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
  if (slot < 0) return null;
  const run = document.clefChanges.filter(
    (c) =>
      c.beforeNeumeId === boundary.beforeNeumeId &&
      c.beforeDivisionId === boundary.beforeDivisionId,
  );
  if (run.length && boundary.beforeClefId === undefined) return null;
  const clefIndex =
    boundary.beforeClefId == null
      ? run.length
      : run.findIndex((c) => c.id === boundary.beforeClefId);
  if (clefIndex < 0) return null;
  const followingId =
    run[clefIndex]?.id ??
    divisions[slot]?.id ??
    document.neumes[neumeIndex]?.id;
  const scoreIndex =
    followingId === undefined
      ? order.length
      : order.findIndex((item) => item.entity.id === followingId);
  const preceding = order
    .slice(0, scoreIndex)
    .filter(
      (item) =>
        item.type !== 'neume' &&
        item.entity.beforeNeumeId === boundary.beforeNeumeId,
    );
  return {
    neumeIndex,
    scoreIndex,
    precedingDivisions: preceding.flatMap((i) =>
      i.type === 'division' ? [i.entity] : [],
    ),
    precedingClefs: preceding.flatMap((i) =>
      i.type === 'clef' ? [i.entity] : [],
    ),
  };
}

/** Reconstruct anchors from a temporary derived walk after split/merge operations. */
export function reanchorScoreOrder(
  order: readonly ScoreItem[],
): Pick<ChantDocument, 'divisions' | 'clefChanges'> {
  const divisions: ChantDivision[] = [];
  const clefChanges: ClefChange[] = [];
  let beforeNeumeId: string | null = null;
  let beforeDivisionId: string | null = null;
  for (const item of [...order].reverse()) {
    if (item.type === 'neume') {
      beforeNeumeId = item.entity.id;
      beforeDivisionId = null;
    } else if (item.type === 'division') {
      divisions.unshift(
        item.entity.beforeNeumeId === beforeNeumeId
          ? item.entity
          : { ...item.entity, beforeNeumeId },
      );
      beforeDivisionId = item.entity.id;
    } else
      clefChanges.unshift(
        item.entity.beforeNeumeId === beforeNeumeId &&
          item.entity.beforeDivisionId === beforeDivisionId
          ? item.entity
          : { ...item.entity, beforeNeumeId, beforeDivisionId },
      );
  }
  return { divisions, clefChanges };
}
