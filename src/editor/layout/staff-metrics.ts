import type { StaffPosition } from '../domain/chant-document';
import { engravingStaffStep } from './neume-geometry';

export const staffStartX = 64;
export const staffEndX = 656;
export const firstNeumeCenterX = 150;
export const firstSystemBottomStaffY = 124;
export const staffStep = engravingStaffStep;

/**
 * Converts semantic pitch to an absolute y coordinate in the score.
 * Callers laying out later systems supply that system's bottom-staff y.
 */
export function staffPositionY(
  position: StaffPosition,
  bottomStaffY = firstSystemBottomStaffY,
) {
  return bottomStaffY - position * staffStep;
}
