import type { ChantDocument } from '../domain/chant-document'
import { findNote } from '../domain/neume'

/** Restores focus only when the invoking stable note ID survives the edit. */
export function getSurvivingFocusNoteId(
  document: ChantDocument,
  invokingNoteId: string | null,
) {
  return invokingNoteId && findNote(document, invokingNoteId)
    ? invokingNoteId
    : null
}
