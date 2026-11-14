import {
  staffPosition,
  type Neume,
  type StaffPosition,
} from './domain/chant-document';

/**
 * Exact entry-tool variants. Most map one-to-one to a semantic kind; the two
 * Pes subpunctis entries share one semantic family with different tuples, and
 * the four-/five-note Scandicus and Climacus entries map to the ordinary kinds.
 */
export type GraphicalNeumeKind =
  | 'pes-subbipunctis'
  | 'pes-subtripunctis'
  | 'scandicus-4'
  | 'scandicus-5'
  | 'climacus-4'
  | 'climacus-5'
  | 'bistropha'
  | 'tristropha'
  | 'punctum'
  | 'podatus'
  | 'clivis'
  | 'scandicus'
  | 'torculus'
  | 'climacus'
  | 'porrectus'
  | 'torculus-resupinus'
  | 'porrectus-flexus'
  | 'scandicus-flexus'
  | 'climacus-resupinus';

export type NeumeEntryPitches =
  | {
      kind: 'torculus-resupinus';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'porrectus-flexus';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'scandicus-flexus';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'climacus-resupinus';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'scandicus-4';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'scandicus-5';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'climacus-4';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'climacus-5';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'pes-subbipunctis';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'pes-subtripunctis';
      staffPositions: readonly [
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
        StaffPosition,
      ];
    }
  | {
      kind: 'bistropha';
      staffPositions: readonly [StaffPosition, StaffPosition];
    }
  | {
      kind: 'tristropha';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    }
  | {
      kind: 'punctum';
      staffPositions: readonly [StaffPosition];
    }
  | {
      kind: 'podatus';
      staffPositions: readonly [StaffPosition, StaffPosition];
    }
  | {
      kind: 'clivis';
      staffPositions: readonly [StaffPosition, StaffPosition];
    }
  | {
      kind: 'scandicus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    }
  | {
      kind: 'torculus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    }
  | {
      kind: 'climacus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    }
  | {
      kind: 'porrectus';
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition];
    };

export type GraphicalStaffPositions = NeumeEntryPitches['staffPositions'];

/** The semantic family an entry variant creates; never stored as tool state. */
export function semanticNeumeKind(kind: GraphicalNeumeKind): Neume['kind'] {
  switch (kind) {
    case 'pes-subbipunctis':
    case 'pes-subtripunctis':
      return 'pes-subpunctis';
    case 'scandicus-4':
    case 'scandicus-5':
      return 'scandicus';
    case 'climacus-4':
    case 'climacus-5':
      return 'climacus';
    default:
      return kind;
  }
}

/** The exact entry variant that would create a neume of this kind and size. */
export function entryNeumeKind(
  kind: Neume['kind'],
  noteCount: number,
): GraphicalNeumeKind {
  if (kind === 'pes-subpunctis')
    return noteCount === 5 ? 'pes-subtripunctis' : 'pes-subbipunctis';
  if ((kind === 'scandicus' || kind === 'climacus') && noteCount > 3)
    return noteCount === 5 ? `${kind}-5` : `${kind}-4`;
  return kind;
}

/** Default entry contours, independent of validity, engraving and insertion policy. */
export function createNeumeEntryPitches(
  kind: GraphicalNeumeKind,
  firstStaffPosition: StaffPosition,
): NeumeEntryPitches {
  const at = (offset: number) => staffPosition(firstStaffPosition + offset);
  switch (kind) {
    // Plan defaults (ADR 0025): one click places all four notes.
    case 'torculus-resupinus':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(2), at(1), at(3)],
      };
    case 'porrectus-flexus':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(-2), at(1), at(-1)],
      };
    case 'scandicus-flexus':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(1), at(3), at(2)],
      };
    case 'climacus-resupinus':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(-1), at(-3), at(-2)],
      };
    case 'pes-subbipunctis':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(2), at(1), firstStaffPosition],
      };
    case 'pes-subtripunctis':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          at(3),
          at(2),
          at(1),
          firstStaffPosition,
        ],
      };
    case 'scandicus-4':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(1), at(2), at(3)],
      };
    case 'climacus-4':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(-1), at(-2), at(-3)],
      };
    case 'scandicus-5':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(1), at(2), at(3), at(4)],
      };
    case 'climacus-5':
      return {
        kind,
        staffPositions: [firstStaffPosition, at(-1), at(-2), at(-3), at(-4)],
      };
    case 'bistropha':
      return { kind, staffPositions: [firstStaffPosition, firstStaffPosition] };
    case 'tristropha':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          firstStaffPosition,
          firstStaffPosition,
        ],
      };
    case 'punctum':
      return {
        kind,
        staffPositions: [firstStaffPosition],
      };
    case 'podatus':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 1),
        ],
      };
    case 'clivis':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition - 1),
        ],
      };
    case 'scandicus':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 1),
          staffPosition(firstStaffPosition + 2),
        ],
      };
    case 'torculus':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 2),
          staffPosition(firstStaffPosition + 1),
        ],
      };
    case 'climacus':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition - 1),
          staffPosition(firstStaffPosition - 2),
        ],
      };
    case 'porrectus':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition - 2),
          staffPosition(firstStaffPosition - 1),
        ],
      };
  }
}
