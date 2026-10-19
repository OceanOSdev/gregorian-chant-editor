import type { ChantLayout } from '../layout/layout-chant';
import type { EditorSelection } from '../state/selection';

/** IDs, not pointer coordinates, identify the committed destination after wrapping. */
export function getSelectedLayoutContext(
  layout: ChantLayout,
  selection: EditorSelection,
) {
  for (const system of layout.systems) {
    const neume = system.neumes.find((neume) =>
      selection.kind === 'neume'
        ? neume.neumeId === selection.neumeId
        : selection.kind === 'note' &&
          neume.notes.some((note) => note.noteId === selection.noteId),
    );
    if (neume) return { systemIndex: system.index, neume };
  }
  return null;
}
