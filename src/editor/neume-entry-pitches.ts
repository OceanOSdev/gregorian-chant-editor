import {
  staffPosition,
  type Neume,
  type StaffPosition,
} from './domain/chant-document';

/**
 * Exact entry-tool variants. Most map one-to-one to a semantic kind; the two
 * Pes subpunctis entries share one semantic family with different tuples.
 */
export type GraphicalNeumeKind =
  | 'pes-subbipunctis'
  | 'pes-subtripunctis'
  | 'bistropha'
  | 'tristropha'
  | 'punctum'
  | 'podatus'
  | 'clivis'
  | 'scandicus'
  | 'torculus'
  | 'climacus'
  | 'porrectus';

export type NeumeEntryPitches =
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
  return kind === 'pes-subbipunctis' || kind === 'pes-subtripunctis'
    ? 'pes-subpunctis'
    : kind;
}

/** The exact entry variant that would create a neume of this kind and size. */
export function entryNeumeKind(
  kind: Neume['kind'],
  noteCount: number,
): GraphicalNeumeKind {
  if (kind !== 'pes-subpunctis') return kind;
  return noteCount === 5 ? 'pes-subtripunctis' : 'pes-subbipunctis';
}

/** Default entry contours, independent of validity, engraving and insertion policy. */
export function createNeumeEntryPitches(
  kind: GraphicalNeumeKind,
  firstStaffPosition: StaffPosition,
): NeumeEntryPitches {
  const at = (offset: number) => staffPosition(firstStaffPosition + offset);
  switch (kind) {
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
