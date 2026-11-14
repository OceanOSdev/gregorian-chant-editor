import { buildAuthoredGeometry } from './neumes/authored-forms';
import {
  addAccidentalGeometry,
  accidentalPrefixAdvance,
  type AccidentalSpec,
  type AccidentalLyricBox,
} from './accidental-geometry';
import { addNoteModifiers } from './note-modifiers';
import type {
  NoteAppearance,
  Neume,
  StaffPosition,
} from '../domain/chant-document';
import type { NeumeGeometry } from './neumes/shared';
import { buildRepeatedNotes } from './neumes/repeated-notes';
import { buildPunctum } from './neumes/punctum';
import { buildPodatusOrClivis } from './neumes/podatus-clivis';
import { buildScandicusOrTorculus } from './neumes/scandicus-torculus';
import { buildClimacus } from './neumes/climacus';
import { buildExtendedScandicus } from './neumes/scandicus-extended';
import { buildPorrectus } from './neumes/porrectus';
import { buildCompoundDirectional } from './neumes/compound-directional';
import { buildPesSubpunctis } from './neumes/pes-subpunctis';

export {
  engravingStaffStep,
  interNeumeInkGap,
  getInkBounds,
  firstHeadHalfWidth,
} from './neumes/shared';
export type {
  LayoutBounds,
  InkShape,
  NoteGeometry,
  NeumeGeometry,
} from './neumes/shared';

/**
 * Approved project contours; see docs/engraving-metrics.md. Intended joins
 * share a filled outer contour; conventional disconnected components stay apart.
 * Positions are valid semantic input, in musical order; coordinates are absolute.
 */
export function buildNeumeGeometry(
  kind: Neume['kind'],
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
  modifiers: readonly NoteAppearance[] = [],
  accidentals: readonly AccidentalSpec[] = [],
  lyricBox?: AccidentalLyricBox,
): NeumeGeometry {
  const buildAt = (groupX: number) => {
    const shiftedX =
      groupX +
      accidentals.filter((a) => a.noteIndex === null).length *
        accidentalPrefixAdvance;
    const base = addNoteModifiers(
      buildAuthoredGeometry(
        kind,
        positions,
        shiftedX,
        bottomStaffY,
        modifiers,
      ) ?? buildUnmodifiedGeometry(kind, positions, shiftedX, bottomStaffY),
      modifiers,
      bottomStaffY,
      kind,
    );
    return addAccidentalGeometry(
      base,
      accidentals,
      groupX,
      bottomStaffY,
      lyricBox,
    );
  };
  const result = buildAt(leftX);
  return accidentals.length && result.bounds.x < leftX
    ? buildAt(leftX + leftX - result.bounds.x)
    : result;
}

function buildUnmodifiedGeometry(
  kind: Neume['kind'],
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  switch (kind) {
    case 'torculus-resupinus':
    case 'porrectus-flexus':
    case 'scandicus-flexus':
    case 'climacus-resupinus':
      return buildCompoundDirectional(kind, positions, leftX, bottomStaffY);
    case 'pes-subpunctis':
      return buildPesSubpunctis(positions, leftX, bottomStaffY);
    case 'bistropha':
    case 'tristropha':
      return buildRepeatedNotes(positions, leftX, bottomStaffY);
    case 'punctum':
      return buildPunctum(positions, leftX, bottomStaffY);
    case 'podatus':
    case 'clivis':
      return buildPodatusOrClivis(kind, positions, leftX, bottomStaffY);
    case 'scandicus':
      // The approved three-note recipe is untouched; longer groups use the
      // sourced staircase (ADR 0024).
      return positions.length > 3
        ? buildExtendedScandicus(positions, leftX, bottomStaffY)
        : buildScandicusOrTorculus(kind, positions, leftX, bottomStaffY);
    case 'torculus':
      return buildScandicusOrTorculus(kind, positions, leftX, bottomStaffY);
    case 'climacus':
      return buildClimacus(positions, leftX, bottomStaffY);
    case 'porrectus':
      return buildPorrectus(positions, leftX, bottomStaffY);
  }
}
