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
}

export interface ChantNote {
  id: string;
  staffPosition: StaffPosition;
}

/** A single-note neume. */
export interface PunctumNeume {
  id: string;
  kind: 'punctum';
  lyricSyllableId: string;
  notes: [ChantNote];
}

/** Two notes in semantic order from lower to strictly higher. */
export interface PodatusNeume {
  id: string;
  kind: 'podatus';
  lyricSyllableId: string;
  notes: [ChantNote, ChantNote];
}

/** Two notes in semantic order from higher to strictly lower. */
export interface ClivisNeume {
  id: string;
  kind: 'clivis';
  lyricSyllableId: string;
  notes: [ChantNote, ChantNote];
}

/** Three notes in semantic order with each pitch strictly ascending. */
export interface ScandicusNeume {
  id: string;
  kind: 'scandicus';
  lyricSyllableId: string;
  notes: [ChantNote, ChantNote, ChantNote];
}

export type Neume = PunctumNeume | PodatusNeume | ClivisNeume | ScandicusNeume;

export interface ChantDocument {
  title: string;
  clef: Clef;
  syllables: LyricSyllable[];
  neumes: Neume[];
}
