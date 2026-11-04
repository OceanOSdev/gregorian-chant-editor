import type { GraphicalNeumeKind } from './neume-entry-pitches';

export const entryPitchCases = {
  punctum: { kind: 'punctum', offsets: [0], fallback: 2 },
  podatus: { kind: 'podatus', offsets: [0, 1], fallback: 2 },
  clivis: { kind: 'clivis', offsets: [0, -1], fallback: 3 },
  scandicus: { kind: 'scandicus', offsets: [0, 1, 2], fallback: 2 },
  torculus: { kind: 'torculus', offsets: [0, 2, 1], fallback: 2 },
  climacus: { kind: 'climacus', offsets: [0, -1, -2], fallback: 3 },
  porrectus: { kind: 'porrectus', offsets: [0, -2, -1], fallback: 3 },
} as const satisfies {
  [K in GraphicalNeumeKind]: {
    kind: K;
    offsets: readonly number[];
    fallback: number;
  };
};
