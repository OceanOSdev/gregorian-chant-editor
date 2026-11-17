import type { AccidentalGeometry } from './accidental-geometry';
import type {
  LyricSyllable,
  Neume,
  NoteAppearance,
  ScoreInsertionBoundary,
} from '../domain/chant-document';
import type { ClefGeometry } from './clef-geometry';
import type { CustosGeometry } from './custos-geometry';
import type { DivisionLayout } from './division-geometry';
import type { LiquescentFigure } from '../domain/liquescence';
import type { alignLyricText } from './lyric-text-metrics';
import type { NeumeGeometry, NoteGeometry } from './neume-geometry';
import type { VerticalBand } from './system-vertical-layout';

/*
 * The public, score-absolute result of `layoutChant`. Callers import these
 * types through `layout-chant.ts`; they live here so the internal layout
 * phases can share them without importing the public entry point.
 */

export interface StaffLineLayout {
  x1: number;
  x2: number;
  y: number;
}

export type ClefLayout = ClefGeometry;
export interface ClefChangeLayout extends ClefGeometry {
  clefChangeId: string;
}

export interface NoteLayout extends NoteGeometry, NoteAppearance {
  noteId: string;
}

export interface AccidentalNoteContext {
  noteId: string;
  noteIndex: number;
  neumeId: string;
  neumeIndex: number;
  neumeKind: Neume['kind'];
}
export interface AccidentalLayout extends AccidentalGeometry {
  accidentalId: string;
  owner: AccidentalNoteContext;
  placement: AccidentalNoteContext | null;
}
export interface NeumeLayout extends Omit<
  NeumeGeometry,
  'notes' | 'accidentals'
> {
  accidentals?: readonly AccidentalLayout[];
  neumeId: string;
  /** Horizontal ownership interval for contextual pointer padding and decorations. */
  hitClip?: { left: number; right: number };

  kind: Neume['kind'];
  /** Derived liquescent figure for labels/data hooks (ADR 0027); never stored. */
  liquescentFigure?: LiquescentFigure;
  notes: readonly NoteLayout[];
}

export interface LyricLayout {
  alignment: ReturnType<typeof alignLyricText>;
  anchorX: number;
  syllableId: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  boundaryBefore: LyricSyllable['boundaryBefore'];
  /** Occupied advance/ink edges; null when measurements are unavailable. */
  left: number | null;
  right: number | null;
}

export interface HyphenLayout {
  x: number;
  y: number;
  outgoing: boolean;
}

/**
 * One derived system. All child geometry is currently score-absolute, and
 * startNeumeIndex is the global semantic index of its first neume.
 */
export interface ChantSystemLayout {
  index: number;
  x: number;
  y: number;
  width: number;
  /** Measured height (Stage 11B); at least `systemHeight`. */
  height: number;
  /** Authoritative bottom staff line: the pitch origin for this system. */
  bottomStaffY: number;
  /** Shared baseline of every lyric and hyphen on this system. */
  lyricBaselineY: number;
  /**
   * Resolved musical band (`SystemFrame.musicBand`): the canonical maximum
   * band intersected with this system's box. Musical ink, ledger runs,
   * pointer regions and in-system overlays are clipped to it.
   */
  musicBand: VerticalBand;
  staffLines: readonly StaffLineLayout[];
  clef: ClefLayout;
  leadingClefChangeId: string | null;
  clefChanges: readonly ClefChangeLayout[];
  custodes: readonly CustosGeometry[];
  neumes: readonly NeumeLayout[];
  hyphens: readonly HyphenLayout[];
  lyrics: readonly LyricLayout[];
  startNeumeIndex: number;
  divisions: readonly DivisionLayout[];
  slots: readonly ScoreSlotLayout[];
}

export interface ScoreSlotLayout {
  /** Inclusive pointer split at the following item midpoint, independent of caret. */
  hitRight: number;
  boundary: ScoreInsertionBoundary;
  insertionIndex: number;
  x: number;
}

/** Derived, score-absolute geometry; canvas includes exceptional guide ink. */
export interface ChantLayout {
  title: string;
  /** Derived canvas origin; logical system coordinates remain unchanged. */
  x: number;
  y: number;
  width: number;
  height: number;
  systems: readonly ChantSystemLayout[];
}
