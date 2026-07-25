import type { ChantDocument } from '../domain/chant-document'
import { findNeume } from '../domain/neume'

export function deleteNeume(
  document: ChantDocument,
  neumeId: string,
): ChantDocument {
  const locatedNeume = findNeume(document, neumeId)

  if (!locatedNeume) {
    return document
  }

  return {
    ...document,
    neumes: document.neumes.filter(
      (_, index) => index !== locatedNeume.neumeIndex,
    ),
  }
}
