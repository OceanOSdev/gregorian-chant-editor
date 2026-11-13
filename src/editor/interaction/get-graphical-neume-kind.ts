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
    case 'place-clef':
    case 'place-division':
    case 'select':
      return null;
    case 'place-pes-subbipunctis':
      return 'pes-subbipunctis';
    case 'place-pes-subtripunctis':
      return 'pes-subtripunctis';
    case 'place-bistropha':
      return 'bistropha';
    case 'place-tristropha':
      return 'tristropha';
    case 'place-punctum':
      return 'punctum';
    case 'place-podatus':
      return 'podatus';
    case 'place-clivis':
      return 'clivis';
    case 'place-scandicus':
      return 'scandicus';
    case 'place-climacus':
      return 'climacus';
    case 'place-porrectus':
      return 'porrectus';
    case 'place-torculus':
      return 'torculus';
  }
}
