import type { StaffLine, StaffPosition } from '../domain/chant-document';
import { engravingStaffStep } from './neume-geometry';

export const staffStartX = 64;
export const staffEndX = 656;
export const firstNeumeCenterX = 150;
export const firstSystemBottomStaffY = 124;
export const staffStep = engravingStaffStep;
/** Vertical distance between adjacent staff lines (two staff steps). */
export const staffLineSpacing = engravingStaffStep * 2;
/** Fixed x of every system's leading clef. */
export const clefX = 100;

/** y of a staff line (1 = bottom) on a system with the given bottom-staff y. */
export function staffLineY(line: StaffLine, bottomStaffY: number) {
  return bottomStaffY - (line - 1) * staffLineSpacing;
}

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
