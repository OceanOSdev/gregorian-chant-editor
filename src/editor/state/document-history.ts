import type { ChantDocument } from '../domain/chant-document'

export interface DocumentHistory {
  readonly past: readonly ChantDocument[]
  readonly present: ChantDocument
  readonly future: readonly ChantDocument[]
}

export type DocumentEdit = (document: ChantDocument) => ChantDocument

export function createDocumentHistory(
  document: ChantDocument,
): DocumentHistory {
  return {
    past: [],
    present: document,
    future: [],
  }
}

/**
 * Applies the edit once. Returning the exact present document signals rejection
 * or a no-op and preserves the exact history without creating an entry.
 */
export function applyDocumentEdit(
  history: DocumentHistory,
  edit: DocumentEdit,
): DocumentHistory {
  const nextDocument = edit(history.present)

  if (nextDocument === history.present) {
    return history
  }

  return {
    past: [...history.past, history.present],
    present: nextDocument,
    future: [],
  }
}

export function undoDocumentEdit(history: DocumentHistory): DocumentHistory {
  const previousDocument = history.past.at(-1)

  if (!previousDocument) {
    return history
  }

  return {
    past: history.past.slice(0, -1),
    present: previousDocument,
    future: [history.present, ...history.future],
  }
}

export function redoDocumentEdit(history: DocumentHistory): DocumentHistory {
  const nextDocument = history.future[0]

  if (!nextDocument) {
    return history
  }

  return {
    past: [...history.past, history.present],
    present: nextDocument,
    future: history.future.slice(1),
  }
}
