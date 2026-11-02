import type { ChantDocument, StaffLine } from '../domain/chant-document';

export function updateDocumentTitle(
  document: ChantDocument,
  title: string,
): ChantDocument {
  const next = title.trim();
  return !next || next.length > 200 || next === document.title
    ? document
    : { ...document, title: next };
}

/** Clef changes preserve written staff positions, not sounding pitch. */
export function updateClef(
  document: ChantDocument,
  staffLine: StaffLine,
): ChantDocument {
  return document.clef.staffLine === staffLine
    ? document
    : { ...document, clef: { type: 'c', staffLine } };
}
