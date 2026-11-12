import type {
  ChantAccidental,
  ChantDocument,
  ChantNote,
  Neume,
} from './chant-document';
import { clefOffset } from './clef';
import { deriveScoreOrder, semanticIds } from './divisions';

export interface PitchContext {
  note: ChantNote;
  neume: Neume;
  neumeIndex: number;
  noteIndex: number;
  degree: number;
  offset: number;
  scope: number;
  order: number;
}

export function bRegister(degree: number): number | null {
  return Number.isSafeInteger(degree) && ((degree % 7) + 7) % 7 === 6
    ? degree
    : null;
}

/** Structural order remains authoritative; scope boundaries precede note events. */
export function pitchContexts(
  document: ChantDocument,
): Map<string, PitchContext> | null {
  const order = deriveScoreOrder(document);
  if (!order) return null;
  const words = new Set(
    document.syllables
      .filter((s) => s.boundaryBefore === 'word')
      .map((s) => s.startsAtNeumeId),
  );
  const result = new Map<string, PitchContext>();
  let offset = clefOffset(document.clef),
    scope = 0,
    neumeIndex = 0,
    index = 0;
  for (const item of order) {
    if (item.type === 'clef') offset = clefOffset(item.entity.clef);
    if (item.type === 'division') scope++;
    if (item.type !== 'neume') continue;
    if (words.has(item.entity.id)) scope++;
    for (const [noteIndex, note] of item.entity.notes.entries()) {
      const degree = note.staffPosition + offset;
      if (!Number.isSafeInteger(degree)) return null;
      result.set(note.id, {
        note,
        neume: item.entity,
        neumeIndex,
        noteIndex,
        degree,
        offset,
        scope,
        order: index++,
      });
    }
    neumeIndex++;
  }
  return result;
}

export function canonicalBOwner(
  contexts: Map<string, PitchContext>,
  noteId: string,
): PitchContext | null {
  const target = contexts.get(noteId);
  if (!target || bRegister(target.degree) === null) return null;
  return (
    [...contexts.values()].find(
      (c) => c.neume.id === target.neume.id && c.degree === target.degree,
    ) ?? null
  );
}

export interface WrittenAccidental {
  entity: ChantAccidental;
  owner: PitchContext;
  location: PitchContext;
}

function isAccidentalEntity(value: unknown): value is ChantAccidental {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const a = value as Record<string, unknown>;
  if (
    !['id', 'kind', 'ownerNoteId'].every((k) => Object.hasOwn(a, k)) ||
    Object.keys(a).some(
      (k) => !['id', 'kind', 'ownerNoteId', 'placement'].includes(k),
    ) ||
    typeof a.id !== 'string' ||
    !a.id.trim() ||
    typeof a.ownerNoteId !== 'string' ||
    !a.ownerNoteId.trim() ||
    (a.kind !== 'flat' && a.kind !== 'natural')
  )
    return false;
  if (Object.hasOwn(a, 'placement')) {
    const p = a.placement;
    if (
      typeof p !== 'object' ||
      p === null ||
      Array.isArray(p) ||
      !('kind' in p) ||
      p.kind !== 'above-note' ||
      !('noteId' in p) ||
      typeof p.noteId !== 'string' ||
      !p.noteId.trim() ||
      Object.keys(p).length !== 2 ||
      !Object.keys(p).every((k) => k === 'kind' || k === 'noteId')
    )
      return false;
  }
  return true;
}

/** Deterministic placement order is musical owner order, never collection order. */
export function writtenAccidentals(
  document: ChantDocument,
  contexts = pitchContexts(document),
): WrittenAccidental[] | null {
  if (!contexts || !Array.isArray(document.accidentals)) return null;
  const result: WrittenAccidental[] = [];
  for (const entity of document.accidentals) {
    if (!isAccidentalEntity(entity)) return null;
    const owner = contexts.get(entity.ownerNoteId);
    const location = entity.placement
      ? contexts.get(entity.placement.noteId)
      : owner && contexts.get(owner.neume.notes[0].id);
    if (!owner || !location) return null;
    result.push({ entity, owner, location });
  }
  return result.sort(
    (a, b) =>
      a.location.order - b.location.order || a.owner.order - b.owner.order,
  );
}

function validPlacement(
  sign: WrittenAccidental,
  signs: readonly WrittenAccidental[],
  contexts: Map<string, PitchContext>,
): boolean {
  if (!sign.entity.placement) return true;
  const { owner, location } = sign;
  if (!Number.isSafeInteger(owner.degree - location.offset)) return false;
  if (location.neumeIndex >= owner.neumeIndex || location.scope !== owner.scope)
    return false;
  if (
    [...contexts.values()].some(
      (c) =>
        c.order >= location.order &&
        c.order < owner.order &&
        c.degree === owner.degree,
    )
  )
    return false;
  return !signs.some(
    (other) =>
      other !== sign &&
      other.owner.degree === owner.degree &&
      other.location.order >= location.order &&
      other.location.order <= owner.order,
  );
}

export function hasValidAccidentals(document: ChantDocument): boolean {
  if (!Array.isArray(document.accidentals)) return false;
  // Empty legacy scores retain their established extreme-position compatibility.
  if (!document.accidentals.length) return true;
  const contexts = pitchContexts(document),
    signs = writtenAccidentals(document, contexts);
  if (!contexts || !signs) return false;
  const ids = new Set([
    ...semanticIds({ ...document, accidentals: [] }),
    ...document.divisions.map((d) => d.id),
  ]);
  const owners = new Set<string>();
  for (const sign of signs) {
    const a = sign.entity;
    if (
      typeof a.id !== 'string' ||
      !a.id.trim() ||
      ids.has(a.id) ||
      (a.kind !== 'flat' && a.kind !== 'natural') ||
      Object.keys(a).some(
        (k) => !['id', 'kind', 'ownerNoteId', 'placement'].includes(k),
      )
    )
      return false;
    if (
      canonicalBOwner(contexts, a.ownerNoteId)?.note.id !== a.ownerNoteId ||
      owners.has(a.ownerNoteId)
    )
      return false;
    if (
      'placement' in a &&
      (!a.placement ||
        a.placement.kind !== 'above-note' ||
        typeof a.placement.noteId !== 'string' ||
        Object.keys(a.placement).length !== 2)
    )
      return false;
    if (!validPlacement(sign, signs, contexts)) return false;
    ids.add(a.id);
    owners.add(a.ownerNoteId);
  }
  return true;
}

export function eligiblePlacementNotes(
  document: ChantDocument,
  id: string,
): string[] {
  const contexts = pitchContexts(document),
    signs = writtenAccidentals(document, contexts);
  const target = signs?.find((s) => s.entity.id === id);
  if (!contexts || !signs || !target || bRegister(target.owner.degree) === null)
    return [];
  const others = signs.filter((s) => s !== target);
  return [...contexts.values()]
    .filter((location) =>
      validPlacement(
        {
          ...target,
          location,
          entity: {
            ...target.entity,
            placement: { kind: 'above-note', noteId: location.note.id },
          },
        },
        others,
        contexts,
      ),
    )
    .map((c) => c.note.id);
}

export interface EffectivePitch extends PitchContext {
  alteration: -1 | 0;
  sourceAccidentalId: string | null;
}

export function resolveEffectivePitches(
  document: ChantDocument,
): Map<string, EffectivePitch> | null {
  const contexts = pitchContexts(document),
    signs = writtenAccidentals(document, contexts);
  if (!contexts || !signs) return null;
  const result = new Map<string, EffectivePitch>(),
    active = new Map<number, ChantAccidental>();
  let scope = -1;
  let signIndex = 0;
  for (const c of contexts.values()) {
    if (c.scope !== scope) {
      active.clear();
      scope = c.scope;
    }
    while (
      signIndex < signs.length &&
      signs[signIndex].location.order === c.order
    ) {
      const sign = signs[signIndex++];
      active.set(sign.owner.degree, sign.entity);
    }
    const sign =
      bRegister(c.degree) === null ? undefined : active.get(c.degree);
    result.set(c.note.id, {
      ...c,
      alteration: sign?.kind === 'flat' ? -1 : 0,
      sourceAccidentalId: sign?.id ?? null,
    });
  }
  return result;
}

/** Ordinary edits lose original owners first, then canonicalize and repair anchors. */
export function reconcileAccidentals(
  before: ChantDocument,
  candidate: ChantDocument,
): ChantDocument | null {
  if (before === candidate || !candidate.accidentals.length) return candidate;
  const contexts = pitchContexts(candidate);
  if (!contexts) return null;
  const ids = new Set<string>();
  let changed = false;
  let accidentals: ChantAccidental[] = [];
  for (const a of candidate.accidentals) {
    const owner = canonicalBOwner(contexts, a.ownerNoteId);
    if (!owner) {
      changed = true;
      continue;
    }
    if (ids.has(owner.note.id)) return null;
    ids.add(owner.note.id);
    accidentals.push(
      owner.note.id === a.ownerNoteId
        ? a
        : { ...a, ownerNoteId: owner.note.id },
    );
    changed ||= owner.note.id !== a.ownerNoteId;
  }
  // Repair in owner order and recheck: restoring a default can interrupt another span.
  for (let pass = 0; pass <= accidentals.length; pass++) {
    const signs =
      writtenAccidentals(
        {
          ...candidate,
          accidentals: accidentals.filter(
            (a) => !a.placement || contexts.has(a.placement.noteId),
          ),
        },
        contexts,
      ) ?? [];
    let repaired = false;
    accidentals = accidentals.map((a) => {
      if (!a.placement) return a;
      const sign = signs.find((s) => s.entity.id === a.id);
      if (sign && validPlacement(sign, signs, contexts)) return a;
      const { placement: _placement, ...rest } = a;
      repaired = true;
      return rest;
    });
    changed ||= repaired;
    if (!repaired) break;
  }
  return changed ? { ...candidate, accidentals } : candidate;
}
