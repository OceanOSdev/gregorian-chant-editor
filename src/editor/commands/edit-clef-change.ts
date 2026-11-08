import type {
  ChantDocument,
  ClefChange,
  Clef,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import {
  deriveScoreOrder,
  isValidClefChange,
  reanchorScoreOrder,
  resolveScoreBoundary,
} from '../domain/divisions';
import { isValidClef, clefOffset } from '../domain/clef';
import { isValidNeume } from '../domain/neume';
import { transposeNeume } from './move-neume';

export function effectiveOffsets(
  document: ChantDocument,
): Map<string, number> | null {
  const order = deriveScoreOrder(document);
  if (!order || !isValidClef(document.clef)) return null;
  const result = new Map<string, number>();
  let offset = clefOffset(document.clef);
  for (const item of order) {
    if (item.type === 'clef') offset = clefOffset(item.entity.clef);
    if (item.type === 'neume') result.set(item.entity.id, offset);
  }
  return result;
}

export function hasChangedEffectivePitches(
  before: ChantDocument,
  after: ChantDocument,
): boolean {
  const old = effectiveOffsets(before),
    next = effectiveOffsets(after);
  return (
    !!old &&
    !!next &&
    after.neumes.some((n) => old.has(n.id) && old.get(n.id) !== next.get(n.id))
  );
}

/** Validate the entire candidate before creating any translated notes. */
export function preserveClefMelody(
  before: ChantDocument,
  candidate: ChantDocument,
): ChantDocument | null {
  const old = effectiveOffsets(before),
    next = effectiveOffsets(candidate);
  if (!old || !next) return null;
  const deltas = candidate.neumes.map((n) =>
    old.has(n.id) ? (old.get(n.id) ?? 0) - (next.get(n.id) ?? 0) : 0,
  );
  if (
    !candidate.neumes.every(
      (n, i) =>
        isValidNeume(n) &&
        n.notes.every(
          (note) =>
            Number.isSafeInteger(note.staffPosition) &&
            Number.isSafeInteger(note.staffPosition + deltas[i]),
        ),
    )
  )
    return null;
  return {
    ...candidate,
    neumes: candidate.neumes.map((n, i) =>
      deltas[i] ? transposeNeume(n, deltas[i]) : n,
    ),
  };
}

export function insertClefChange(
  document: ChantDocument,
  change: ClefChange,
  boundary: ScoreInsertionBoundary,
): ChantDocument {
  const resolved = resolveScoreBoundary(document, boundary),
    order = deriveScoreOrder(document);
  if (
    !resolved ||
    !order ||
    !isValidClefChange(change) ||
    change.beforeNeumeId !== boundary.beforeNeumeId ||
    change.beforeDivisionId !== boundary.beforeDivisionId ||
    order.some((i) => i.entity.id === change.id) ||
    document.neumes.some((n) =>
      n.notes.some((note) => note.id === change.id),
    ) ||
    document.syllables.some((s) => s.id === change.id)
  )
    return document;
  order.splice(resolved.scoreIndex, 0, { type: 'clef', entity: change });
  return { ...document, ...reanchorScoreOrder(order) };
}

export function updateClefChange(
  document: ChantDocument,
  id: string,
  clef: Clef,
): ChantDocument {
  if (
    !deriveScoreOrder(document) ||
    !isValidClef(clef) ||
    !document.clefChanges.some(
      (c) =>
        c.id === id &&
        (c.clef.type !== clef.type || c.clef.staffLine !== clef.staffLine),
    )
  )
    return document;
  return {
    ...document,
    clefChanges: document.clefChanges.map((c) =>
      c.id === id ? { ...c, clef: { ...clef } } : c,
    ),
  };
}

export function deleteClefChange(
  document: ChantDocument,
  id: string,
): ChantDocument {
  if (
    !deriveScoreOrder(document) ||
    !document.clefChanges.some((c) => c.id === id)
  )
    return document;
  return {
    ...document,
    clefChanges: document.clefChanges.filter((c) => c.id !== id),
  };
}
