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
  type: 'c' | 'f';
  staffLine: StaffLine;
}

export type LyricLanguage = 'la' | 'en' | 'el' | 'und';

/** Half-open grapheme indexes into the exact syllable text. */
export interface LyricAlignmentSegment {
  start: number;
  end: number;
}

export interface LyricSyllable {
  alignment?: LyricAlignmentSegment;
  id: string;
  text: string;
  startsAtNeumeId: string;
  boundaryBefore: 'word' | 'continuation';
}

export interface NoteModifiers {
  mora?: 1;
  episema?: true;
  verticalEpisema?: true;
}

export type NoteForm = 'virga' | 'inclinatum' | 'quilisma';

export interface NoteAppearance extends NoteModifiers {
  form?: NoteForm;
}

export interface ChantNote extends NoteAppearance {
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

/**
 * A bounded union of the three supported Scandicus/Climacus cardinalities
 * (ADR 0024). Its length is the only count; no variant field duplicates it.
 */
export type MonotonicNotes =
  | [ChantNote, ChantNote, ChantNote]
  | [ChantNote, ChantNote, ChantNote, ChantNote]
  | [ChantNote, ChantNote, ChantNote, ChantNote, ChantNote];

/** Three, four or five notes in semantic order, each strictly ascending. */
export interface ScandicusNeume {
  id: string;
  kind: 'scandicus';
  notes: MonotonicNotes;
}

/** Three notes in semantic order that rise and then strictly fall. */
export interface TorculusNeume {
  id: string;
  kind: 'torculus';
  notes: [ChantNote, ChantNote, ChantNote];
}

/** Three, four or five notes in semantic order, each strictly descending. */
export interface ClimacusNeume {
  id: string;
  kind: 'climacus';
  notes: MonotonicNotes;
}

/** Three notes in semantic order that fall and then strictly rise. */
export interface PorrectusNeume {
  id: string;
  kind: 'porrectus';
  notes: [ChantNote, ChantNote, ChantNote];
}

/** Two same-pitch notes in semantic order. */
export interface BistrophaNeume {
  id: string;
  kind: 'bistropha';
  notes: [ChantNote, ChantNote];
}

/** Three same-pitch notes in semantic order. */
export interface TristrophaNeume {
  id: string;
  kind: 'tristropha';
  notes: [ChantNote, ChantNote, ChantNote];
}

/**
 * A bounded union of the two supported Pes subpunctis cardinalities. Its
 * length is the only count; no variant field duplicates it.
 */
export type PesSubpunctisNotes =
  | [ChantNote, ChantNote, ChantNote, ChantNote]
  | [ChantNote, ChantNote, ChantNote, ChantNote, ChantNote];

/**
 * A rising Podatus followed by two (subbipunctis) or three (subtripunctis)
 * strictly descending notes: p0 < p1 > p2 > p3 (> p4).
 */
export interface PesSubpunctisNeume {
  id: string;
  kind: 'pes-subpunctis';
  notes: PesSubpunctisNotes;
}

/** Builds the bounded tuple without truncating or padding a note list. */
export function pesSubpunctisNotes(
  notes: readonly ChantNote[],
): PesSubpunctisNotes | null {
  const [a, b, c, d, e, ...rest] = notes;
  if (!a || !b || !c || !d || rest.length) return null;
  return e ? [a, b, c, d, e] : [a, b, c, d];
}

/** Builds the bounded 3/4/5 tuple without truncating or padding a note list. */
export function monotonicNotes(
  notes: readonly ChantNote[],
): MonotonicNotes | null {
  const [a, b, c, d, e, ...rest] = notes;
  if (!a || !b || !c || rest.length) return null;
  if (!d) return e ? null : [a, b, c];
  return e ? [a, b, c, d, e] : [a, b, c, d];
}

/** One fixed four-note tuple (ADR 0025). */
export type FourNotes = [ChantNote, ChantNote, ChantNote, ChantNote];

/** Rise, strict fall, strict rise: p0 < p1 > p2 < p3 (ADR 0025). */
export interface TorculusResupinusNeume {
  id: string;
  kind: 'torculus-resupinus';
  notes: FourNotes;
}

/** Fall, strict rise, strict fall: p0 > p1 < p2 > p3 (ADR 0025). */
export interface PorrectusFlexusNeume {
  id: string;
  kind: 'porrectus-flexus';
  notes: FourNotes;
}

/** Rise, strict rise, strict fall: p0 < p1 < p2 > p3 (ADR 0025). */
export interface ScandicusFlexusNeume {
  id: string;
  kind: 'scandicus-flexus';
  notes: FourNotes;
}

/** Fall, strict fall, strict rise: p0 > p1 > p2 < p3 (ADR 0025). */
export interface ClimacusResupinusNeume {
  id: string;
  kind: 'climacus-resupinus';
  notes: FourNotes;
}

export type CompoundDirectionalNeume =
  | TorculusResupinusNeume
  | PorrectusFlexusNeume
  | ScandicusFlexusNeume
  | ClimacusResupinusNeume;

export type CompoundDirectionalKind = CompoundDirectionalNeume['kind'];

/** Adjacent directions (+1 up, -1 down) of each compound kind, in order. */
export const compoundDirectionalContours = {
  'torculus-resupinus': [1, -1, 1],
  'porrectus-flexus': [-1, 1, -1],
  'scandicus-flexus': [1, 1, -1],
  'climacus-resupinus': [-1, -1, 1],
} as const satisfies Record<CompoundDirectionalKind, readonly (1 | -1)[]>;

export function isCompoundDirectionalKind(
  kind: string,
): kind is CompoundDirectionalKind {
  return Object.hasOwn(compoundDirectionalContours, kind);
}

/** Builds the exact four-note tuple without truncating or padding. */
export function fourNotes(notes: readonly ChantNote[]): FourNotes | null {
  const [a, b, c, d, ...rest] = notes;
  return a && b && c && d && !rest.length ? [a, b, c, d] : null;
}

export type Neume =
  | CompoundDirectionalNeume
  | PesSubpunctisNeume
  | BistrophaNeume
  | TristrophaNeume
  | PunctumNeume
  | PodatusNeume
  | ClivisNeume
  | ScandicusNeume
  | TorculusNeume
  | ClimacusNeume
  | PorrectusNeume;

export type DivisionKind = 'minima' | 'minor' | 'maior' | 'finalis';

export interface ChantDivision {
  id: string;
  kind: DivisionKind;
  beforeNeumeId: string | null;
}

export interface ClefChange {
  id: string;
  clef: Clef;
  beforeNeumeId: string | null;
  beforeDivisionId: string | null;
}

/** A position within a clef run in a division slot at a neume boundary. */
export interface ScoreInsertionBoundary {
  beforeClefId?: string | null;
  beforeNeumeId: string | null;
  beforeDivisionId: string | null;
}

export interface ChantAccidental {
  id: string;
  kind: 'flat' | 'natural';
  ownerNoteId: string;
  placement?: { kind: 'above-note'; noteId: string };
}

export interface ChantDocument {
  accidentals: ChantAccidental[];
  clefChanges: ClefChange[];
  divisions: ChantDivision[];
  lyricLanguage: LyricLanguage;
  title: string;
  clef: Clef;
  syllables: LyricSyllable[];
  neumes: Neume[];
}
