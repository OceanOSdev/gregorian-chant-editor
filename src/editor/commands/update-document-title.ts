import type { ChantDocument } from '../domain/chant-document';

export function updateDocumentTitle(
  document: ChantDocument,
  title: string,
): ChantDocument {
  if (title === document.title) return document;
  return { ...document, title };
}
