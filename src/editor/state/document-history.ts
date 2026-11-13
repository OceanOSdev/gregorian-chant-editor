import type { ChantDocument } from '../domain/chant-document';

export interface DocumentHistory {
  readonly past: readonly ChantDocument[];
  readonly present: ChantDocument;
  readonly future: readonly ChantDocument[];
}

export type DocumentEdit = (document: ChantDocument) => ChantDocument;

export function createDocumentHistory(
  document: ChantDocument,
): DocumentHistory {
  return {
    past: [],
    present: document,
    future: [],
  };
}

/**
 * Records a finalized semantic command once. Candidate builders must be finalized
 * before adoption; history does not perform semantic repair. Returning the exact
 * present document signals rejection or a no-op and preserves history identity.
 */
export function applyDocumentEdit(
  history: DocumentHistory,
  edit: DocumentEdit,
): DocumentHistory {
  const nextDocument = edit(history.present);

  if (nextDocument === history.present) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: nextDocument,
    future: [],
  };
}

export function undoDocumentEdit(history: DocumentHistory): DocumentHistory {
  const previousDocument = history.past.at(-1);

  if (!previousDocument) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: previousDocument,
    future: [history.present, ...history.future],
  };
}

export function redoDocumentEdit(history: DocumentHistory): DocumentHistory {
  const nextDocument = history.future[0];

  if (!nextDocument) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: nextDocument,
    future: history.future.slice(1),
  };
}
