import type { GraphicalNeumeKind } from '../layout/layout-chant'
import type { EditorTool } from '../state/editor-tool'

export function getGraphicalNeumeKind(
  tool: EditorTool,
): GraphicalNeumeKind | null {
  switch (tool.kind) {
    case 'select':
      return null
    case 'place-punctum':
      return 'punctum'
    case 'place-podatus':
      return 'podatus'
    case 'place-clivis':
      return 'clivis'
    case 'place-scandicus':
      return 'scandicus'
  }
}
