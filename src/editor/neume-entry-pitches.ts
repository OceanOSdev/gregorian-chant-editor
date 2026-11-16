import {
  staffPosition,
  type Neume,
  type StaffPosition,
} from './domain/chant-document';
import type { LiquescentFigure, NeumeLiquescence } from './domain/liquescence';

/**
 * Exact entry-tool variants. Most map one-to-one to a semantic kind; the two
 * Pes subpunctis entries share one semantic family with different tuples, and
 * the four-/five-note Scandicus and Climacus entries map to the ordinary kinds.
 */
export type GraphicalNeumeKind =
  | LiquescentFigure
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
    kind: 'epiphonus';
    staffPositions: readonly [StaffPosition, StaffPosition];
  }
  | {
    kind: 'augmentative-pes';
    staffPositions: readonly [StaffPosition, StaffPosition];
  }
  | {
    kind: 'cephalicus';
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
    case 'epiphonus':
    case 'augmentative-pes':
      return 'podatus';
    case 'cephalicus':
      return 'clivis';
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

/**
 * The engraving an entry variant previews and inserts: its liquescent figure,
 * or the semantic kind it creates. Shared by ghosts, icons and committed layout.
 */
export function entryGeometryKind(
  kind: GraphicalNeumeKind,
): Neume['kind'] | LiquescentFigure {
  return kind === 'epiphonus' ||
    kind === 'cephalicus' ||
    kind === 'augmentative-pes'
    ? kind
    : semanticNeumeKind(kind);
}

/** The liquescent appearance an entry variant inserts (ADR 0027), if any. */
export function entryLiquescence(
  kind: GraphicalNeumeKind,
): NeumeLiquescence | undefined {
  if (kind === 'epiphonus' || kind === 'cephalicus') return 'diminutive';
  return kind === 'augmentative-pes' ? 'augmentative-descending' : undefined;
}

/** The exact entry variant that would create a neume of this kind and size. */
export function entryNeumeKind(
  kind: Neume['kind'],
  noteCount: number,
  liquescence?: NeumeLiquescence,
): GraphicalNeumeKind {
  if (kind === 'podatus' && liquescence)
    return liquescence === 'diminutive' ? 'epiphonus' : 'augmentative-pes';
  if (kind === 'clivis' && liquescence) return 'cephalicus';
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
        staffPositions: [firstStaffPosition, at(1), firstStaffPosition, at(-1)],
      };
    case 'pes-subtripunctis':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          at(1),
          firstStaffPosition,
          at(-1),
          at(-2),
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
    case 'epiphonus':
    case 'augmentative-pes':
      return {
        kind,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 1),
        ],
      };
    case 'clivis':
    case 'cephalicus':
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
          staffPosition(firstStaffPosition + 1),
          staffPosition(firstStaffPosition),
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
