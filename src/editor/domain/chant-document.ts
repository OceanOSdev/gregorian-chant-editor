declare const staffPositionBrand: unique symbol

/**
 * An integer number of line-or-space steps above the bottom staff line.
 * Staff lines are the even positions 0, 2, 4, and 6. Values outside that
 * range represent positions above or below the staff.
 */
export type StaffPosition = number & {
  readonly [staffPositionBrand]: 'StaffPosition'
}

export function staffPosition(value: number): StaffPosition {
  if (!Number.isInteger(value)) {
    throw new TypeError('Staff positions must be integers')
  }

  return value as StaffPosition
}

export type StaffLine = 1 | 2 | 3 | 4

export interface Clef {
  type: 'c'
  staffLine: StaffLine
}

export interface LyricSyllable {
  id: string
  text: string
}

export interface Punctum {
  id: string
  kind: 'punctum'
  staffPosition: StaffPosition
  lyricSyllableId: string
}

export interface ChantDocument {
  title: string
  clef: Clef
  syllables: LyricSyllable[]
  notes: Punctum[]
}
