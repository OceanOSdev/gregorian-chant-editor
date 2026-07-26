import type { ChantDocument, PunctumNeume } from '../domain/chant-document';

export function insertPunctum(
  document: ChantDocument,
  punctum: PunctumNeume,
  insertionIndex: number,
): ChantDocument {
  return {
    ...document,
    neumes: [
      ...document.neumes.slice(0, insertionIndex),
      punctum,
      ...document.neumes.slice(insertionIndex),
    ],
  };
}
