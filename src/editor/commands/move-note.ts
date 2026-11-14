import { reconcileAccidentalsResult } from '../domain/accidentals';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { findNote, isValidNeume, mapNeumeNotes } from '../domain/neume';

export type StaffPositionDelta = -1 | 1;

function moveNoteVerticallyCandidate(
  document: ChantDocument,
  noteId: string,
  delta: StaffPositionDelta,
): ChantDocument {
  const locatedNote = findNote(document, noteId);

  if (!locatedNote) {
    return document;
  }

  const movedNote = {
    ...locatedNote.note,
    staffPosition: staffPosition(locatedNote.note.staffPosition + delta),
  };
  if (!Number.isSafeInteger(movedNote.staffPosition)) return document;
  // Rebuild the owning kind's bounded tuple before validation so movement
  // never weakens its cardinality or semantic note order.
  const movedNeume = mapNeumeNotes(locatedNote.neume, (note, index) =>
    index === locatedNote.noteIndex ? movedNote : note,
  );

  if (!movedNeume || !isValidNeume(movedNeume)) {
    return document;
  }

  return {
    ...document,
    neumes: document.neumes.map((neume, index) =>
      index === locatedNote.neumeIndex ? movedNeume : neume,
    ),
  };
}

export function moveNoteVerticallyResult(
  ...args: Parameters<typeof moveNoteVerticallyCandidate>
) {
  return reconcileAccidentalsResult(
    args[0],
    moveNoteVerticallyCandidate(...args),
  );
}

export function moveNoteVertically(
  ...args: Parameters<typeof moveNoteVerticallyCandidate>
): ChantDocument {
  return moveNoteVerticallyResult(...args).document;
}
