import type { ChantDocument, StaffPosition } from '../domain/chant-document';
import { findNeume, findNote } from '../domain/neume';
import type { EditorSelection } from '../state/selection';

export interface ToolbarNeumeInsertion {
  insertionIndex: number;
  referenceStaffPosition: StaffPosition;
}

export function resolveToolbarNeumeInsertion(
  document: ChantDocument,
  selection: EditorSelection,
  fallback: StaffPosition,
): ToolbarNeumeInsertion {
  const note =
    selection.kind === 'note' ? findNote(document, selection.noteId) : null;
  const syllable =
    selection.kind === 'syllable'
      ? document.syllables.find((s) => s.id === selection.syllableId)
      : null;
  const located =
    selection.kind === 'neume'
      ? findNeume(document, selection.neumeId)
      : syllable
        ? findNeume(document, syllable.startsAtNeumeId)
        : note;
  return {
    insertionIndex: located ? located.neumeIndex + 1 : document.neumes.length,
    referenceStaffPosition:
      note?.note.staffPosition ??
      located?.neume.notes.at(-1)?.staffPosition ??
      document.neumes.at(-1)?.notes.at(-1)?.staffPosition ??
      fallback,
  };
}
