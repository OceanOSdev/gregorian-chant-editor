import { staffPosition, type StaffPosition } from './domain/chant-document';

export type GraphicalNeumeKind =
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

/** Default entry contours, independent of validity, engraving and insertion policy. */
export function createNeumeEntryPitches(
  kind: GraphicalNeumeKind,
  firstStaffPosition: StaffPosition,
): NeumeEntryPitches {
  switch (kind) {
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
