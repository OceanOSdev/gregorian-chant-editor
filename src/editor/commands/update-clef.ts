import type { ChantDocument, Clef } from '../domain/chant-document';
import { isValidNeume } from '../domain/neume';
import { transposeNeume } from './move-neume';

export function isValidClef(value: unknown): value is Clef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value.type === 'c' || value.type === 'f') &&
    'staffLine' in value &&
    (value.staffLine === 1 ||
      value.staffLine === 2 ||
      value.staffLine === 3 ||
      value.staffLine === 4)
  );
}

function degreeOffset(clef: Clef): number {
  return (clef.type === 'c' ? 0 : 3) - 2 * (clef.staffLine - 1);
}

/** One atomic melody-preserving change of the required initial clef. */
export function updateClef(document: ChantDocument, clef: Clef): ChantDocument {
  if (
    !isValidClef(clef) ||
    !isValidClef(document.clef) ||
    (clef.type === document.clef.type &&
      clef.staffLine === document.clef.staffLine)
  )
    return document;
  const delta = degreeOffset(document.clef) - degreeOffset(clef);
  if (
    !document.neumes.every(
      (n) =>
        isValidNeume(n) &&
        n.notes.every(
          (note) =>
            Number.isSafeInteger(note.staffPosition) &&
            Number.isSafeInteger(note.staffPosition + delta),
        ),
    )
  )
    return document;
  return {
    ...document,
    clef: { type: clef.type, staffLine: clef.staffLine },
    neumes: document.neumes.map((n) => transposeNeume(n, delta)),
  };
}
