import type { GraphicalNeumeKind } from './neume-entry-pitches';

export const entryPitchCases = {
  'pes-subbipunctis': {
    kind: 'pes-subbipunctis',
    offsets: [0, 2, 1, 0],
    fallback: 2,
  },
  'pes-subtripunctis': {
    kind: 'pes-subtripunctis',
    offsets: [0, 3, 2, 1, 0],
    fallback: 2,
  },
  'scandicus-4': { kind: 'scandicus-4', offsets: [0, 1, 2, 3], fallback: 2 },
  'scandicus-5': { kind: 'scandicus-5', offsets: [0, 1, 2, 3, 4], fallback: 2 },
  'climacus-4': { kind: 'climacus-4', offsets: [0, -1, -2, -3], fallback: 4 },
  'climacus-5': {
    kind: 'climacus-5',
    offsets: [0, -1, -2, -3, -4],
    fallback: 4,
  },
  bistropha: { kind: 'bistropha', offsets: [0, 0], fallback: 2 },
  tristropha: { kind: 'tristropha', offsets: [0, 0, 0], fallback: 2 },
  punctum: { kind: 'punctum', offsets: [0], fallback: 2 },
  podatus: { kind: 'podatus', offsets: [0, 1], fallback: 2 },
  clivis: { kind: 'clivis', offsets: [0, -1], fallback: 3 },
  scandicus: { kind: 'scandicus', offsets: [0, 1, 2], fallback: 2 },
  torculus: { kind: 'torculus', offsets: [0, 2, 1], fallback: 2 },
  climacus: { kind: 'climacus', offsets: [0, -1, -2], fallback: 3 },
  porrectus: { kind: 'porrectus', offsets: [0, -2, -1], fallback: 3 },
  'torculus-resupinus': {
    kind: 'torculus-resupinus',
    offsets: [0, 2, 1, 3],
    fallback: 2,
  },
  'porrectus-flexus': {
    kind: 'porrectus-flexus',
    offsets: [0, -2, 1, -1],
    fallback: 3,
  },
  'scandicus-flexus': {
    kind: 'scandicus-flexus',
    offsets: [0, 1, 3, 2],
    fallback: 2,
  },
  'climacus-resupinus': {
    kind: 'climacus-resupinus',
    offsets: [0, -1, -3, -2],
    fallback: 4,
  },
} as const satisfies {
  [K in GraphicalNeumeKind]: {
    kind: K;
    offsets: readonly number[];
    fallback: number;
  };
};
