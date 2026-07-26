import type { ChantDocument } from '../domain/chant-document'
import { findNote } from '../domain/neume'
export function getSurvivingFocusNoteId(
  document: ChantDocument,
  invokingNoteId: string | null,
) {
  return invokingNoteId && findNote(document, invokingNoteId)
    ? invokingNoteId
    : null
}
