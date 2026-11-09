import type { ChantDocument, Clef } from '../domain/chant-document';
import { isValidClef } from '../domain/clef';
import { preserveClefMelody } from './edit-clef-change';

/** Initial edits preserve only the passage governed by the required clef. */
export function updateClef(document: ChantDocument, clef: Clef): ChantDocument {
  if (
    !isValidClef(clef) ||
    !isValidClef(document.clef) ||
    (clef.type === document.clef.type &&
      clef.staffLine === document.clef.staffLine)
  )
    return document;
  return (
    preserveClefMelody(document, { ...document, clef: { ...clef } }) ?? document
  );
}
