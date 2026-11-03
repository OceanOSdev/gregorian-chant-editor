import type { Neume, StaffPosition } from '../domain/chant-document';
import type { NeumeGeometry } from './neumes/shared';
import { buildPunctum } from './neumes/punctum';
import { buildPodatusOrClivis } from './neumes/podatus-clivis';
import { buildScandicusOrTorculus } from './neumes/scandicus-torculus';
import { buildClimacus } from './neumes/climacus';
import { buildPorrectus } from './neumes/porrectus';

export {
  engravingStaffStep,
  interNeumeInkGap,
  getInkBounds,
} from './neumes/shared';
export type {
  LayoutBounds,
  InkShape,
  NoteGeometry,
  NeumeGeometry,
} from './neumes/shared';

export function firstHeadHalfWidth(kind: Neume['kind']): number {
  switch (kind) {
    case 'punctum':
    case 'podatus':
    case 'clivis':
    case 'scandicus':
    case 'torculus':
    case 'climacus':
    case 'porrectus':
      return 6;
  }
}

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
): NeumeGeometry {
  switch (kind) {
    case 'punctum':
      return buildPunctum(positions, leftX, bottomStaffY);
    case 'podatus':
    case 'clivis':
      return buildPodatusOrClivis(kind, positions, leftX, bottomStaffY);
    case 'scandicus':
    case 'torculus':
      return buildScandicusOrTorculus(kind, positions, leftX, bottomStaffY);
    case 'climacus':
      return buildClimacus(positions, leftX, bottomStaffY);
    case 'porrectus':
      return buildPorrectus(positions, leftX, bottomStaffY);
  }
}
