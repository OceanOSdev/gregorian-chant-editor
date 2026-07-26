import type { ChantDocument } from '../domain/chant-document'
import { findNote } from '../domain/neume'
import type { ChantLayout } from '../layout/layout-chant'
import { isPlacementTool, type EditorTool } from '../state/editor-tool'

export function canUseGraphicalPlacement(layout: ChantLayout) {
  return layout.systems.length === 1
}

export function shouldCancelGraphicalPlacement(
  layout: ChantLayout,
  tool: EditorTool,
) {
  return !canUseGraphicalPlacement(layout) && isPlacementTool(tool)
}

export function getSurvivingFocusNoteId(
  document: ChantDocument,
  invokingNoteId: string,
) {
  return findNote(document, invokingNoteId) ? invokingNoteId : null
}
