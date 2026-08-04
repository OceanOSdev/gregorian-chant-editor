import { describe, expect, it } from 'vitest';
import {
  placeClivisTool,
  placePodatusTool,
  placePunctumTool,
  placeScandicusTool,
  placeTorculusTool,
  selectTool,
} from '../state/editor-tool';
import { getGraphicalNeumeKind } from './get-graphical-neume-kind';

describe('getGraphicalNeumeKind', () => {
  it.each([
    { tool: placePunctumTool(), kind: 'punctum' },
    { tool: placePodatusTool(), kind: 'podatus' },
    { tool: placeClivisTool(), kind: 'clivis' },
    { tool: placeScandicusTool(), kind: 'scandicus' },
    { tool: placeTorculusTool(), kind: 'torculus' },
  ] as const)('maps $tool.kind to $kind', ({ tool, kind }) => {
    expect(getGraphicalNeumeKind(tool)).toBe(kind);
  });

  it('maps Select to null instead of falling back to a graphical kind', () => {
    expect(getGraphicalNeumeKind(selectTool())).toBeNull();
  });
});
