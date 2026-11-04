import type { ChantDocument, Clef } from '../domain/chant-document';
import { isValidClef } from '../domain/clef';
import { isValidNeume } from '../domain/neume';
import { transposeNeume } from './move-neume';

const clefBaseDegree = { c: 0, f: 3 } satisfies Record<Clef['type'], number>;

function degreeOffset(clef: Clef): number {
  return clefBaseDegree[clef.type] - 2 * (clef.staffLine - 1);
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
