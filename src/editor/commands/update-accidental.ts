import type { ChantAccidental, ChantDocument } from '../domain/chant-document';
import {
  canonicalBOwner,
  hasValidAccidentals,
  pitchContexts,
  reconcileAccidentals,
  eligiblePlacementNotes,
} from '../domain/accidentals';
import { semanticIds } from '../domain/divisions';

export function updateAccidental(
  document: ChantDocument,
  noteId: string,
  kind: ChantAccidental['kind'] | undefined,
  id: string,
): ChantDocument {
  const contexts = pitchContexts(document);
  const owner = contexts && canonicalBOwner(contexts, noteId);
  if (!owner) return document;
  const existing = document.accidentals.find(
    (a) => a.ownerNoteId === owner.note.id,
  );
  if (existing?.kind === kind || (!existing && !kind)) return document;
  if (
    !existing &&
    (!id.trim() ||
      [
        ...semanticIds(document),
        ...document.divisions.map((d) => d.id),
      ].includes(id))
  )
    return document;
  const accidentals = existing
    ? document.accidentals.flatMap((a) =>
        a !== existing ? [a] : kind ? [{ ...a, kind }] : [],
      )
    : [
        ...document.accidentals,
        { id, ownerNoteId: owner.note.id, kind: kind ?? 'natural' },
      ];
  const candidate = reconcileAccidentals(document, {
    ...document,
    accidentals,
  });
  return candidate && hasValidAccidentals(candidate) ? candidate : document;
}

export function deleteAccidental(
  document: ChantDocument,
  id: string,
): ChantDocument {
  if (!document.accidentals.some((a) => a.id === id)) return document;
  return {
    ...document,
    accidentals: document.accidentals.filter((a) => a.id !== id),
  };
}

export function placeAccidental(
  document: ChantDocument,
  id: string,
  noteId: string | null,
): ChantDocument {
  const sign = document.accidentals.find((a) => a.id === id);
  if (!sign || (sign.placement?.noteId ?? null) === noteId) return document;
  const { placement: _placement, ...base } = sign;
  const changed: ChantAccidental =
    noteId === null
      ? base
      : { ...base, placement: { kind: 'above-note', noteId } };
  const candidate = {
    ...document,
    accidentals: document.accidentals.map((a) => (a === sign ? changed : a)),
  };
  return hasValidAccidentals(candidate) ? candidate : document;
}

export function eligibleAccidentalAnchors(
  document: ChantDocument,
  id: string,
): string[] {
  return eligiblePlacementNotes(document, id);
}
