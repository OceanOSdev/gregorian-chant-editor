import type { GraphicalNeumeKind } from '../layout/layout-chant';
import type { EditorTool } from '../state/editor-tool';

/**
 * Explicitly whitelists graphical kinds; semantic union membership alone does
 * not make a neume available to placement tools.
 */
export function getGraphicalNeumeKind(
  tool: EditorTool,
): GraphicalNeumeKind | null {
  switch (tool.kind) {
    case 'select':
      return null;
    case 'place-punctum':
      return 'punctum';
    case 'place-podatus':
      return 'podatus';
    case 'place-clivis':
      return 'clivis';
    case 'place-scandicus':
      return 'scandicus';
    case 'place-torculus':
      return 'torculus';
  }
}
