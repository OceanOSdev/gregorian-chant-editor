declare const staffPositionBrand: unique symbol;

/**
 * An integer number of line-or-space steps above the bottom staff line.
 * Staff lines are the even positions 0, 2, 4, and 6. Values outside that
 * range represent positions above or below the staff.
 */
export type StaffPosition = number & {
  readonly [staffPositionBrand]: 'StaffPosition';
};

export function staffPosition(value: number): StaffPosition {
  if (!Number.isInteger(value)) {
    throw new TypeError('Staff positions must be integers');
  }

  return value as StaffPosition;
}

export type StaffLine = 1 | 2 | 3 | 4;

export interface Clef {
  type: 'c';
  staffLine: StaffLine;
}

export interface LyricSyllable {
  id: string;
  text: string;
  startsAtNeumeId: string;
  boundaryBefore: 'word' | 'continuation';
}

export interface ChantNote {
  id: string;
  staffPosition: StaffPosition;
}

/** A single-note neume. */
export interface PunctumNeume {
  id: string;
  kind: 'punctum';
  notes: [ChantNote];
}

/** Two notes in semantic order from lower to strictly higher. */
export interface PodatusNeume {
  id: string;
  kind: 'podatus';
  notes: [ChantNote, ChantNote];
}

/** Two notes in semantic order from higher to strictly lower. */
export interface ClivisNeume {
  id: string;
  kind: 'clivis';
  notes: [ChantNote, ChantNote];
}

/** Three notes in semantic order with each pitch strictly ascending. */
export interface ScandicusNeume {
  id: string;
  kind: 'scandicus';
  notes: [ChantNote, ChantNote, ChantNote];
}

/** Three notes in semantic order that rise and then strictly fall. */
export interface TorculusNeume {
  id: string;
  kind: 'torculus';
  notes: [ChantNote, ChantNote, ChantNote];
}

/** Three notes in semantic order with each pitch strictly descending. */
export interface ClimacusNeume {
  id: string;
  kind: 'climacus';
  notes: [ChantNote, ChantNote, ChantNote];
}

/** Three notes in semantic order that fall and then strictly rise. */
export interface PorrectusNeume {
  id: string;
  kind: 'porrectus';
  notes: [ChantNote, ChantNote, ChantNote];
}

export type Neume =
  | PunctumNeume
  | PodatusNeume
  | ClivisNeume
  | ScandicusNeume
  | TorculusNeume
  | ClimacusNeume
  | PorrectusNeume;

export interface ChantDocument {
  title: string;
  clef: Clef;
  syllables: LyricSyllable[];
  neumes: Neume[];
}
