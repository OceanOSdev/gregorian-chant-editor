import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type StaffLine,
  type StaffPosition,
} from '../domain/chant-document'
import { countNotes } from '../domain/neume'

export interface StaffLineLayout {
  x1: number
  x2: number
  y: number
}

export interface ClefLayout {
  type: 'c'
  staffLine: StaffLine
  x: number
  y: number
  fontSize: number
}

export interface NoteLayout {
  noteId: string
  x: number
  y: number
  width: number
  height: number
}

export interface NeumeLayout {
  neumeId: string
  lyricSyllableId: string
  kind: Neume['kind']
  notes: NoteLayout[]
}

export interface LyricLayout {
  syllableId: string
  text: string
  x: number
  y: number
  fontSize: number
}

export interface ChantLayout {
  title: string
  width: number
  height: number
  staffLines: StaffLineLayout[]
  clef: ClefLayout
  neumes: NeumeLayout[]
  lyrics: LyricLayout[]
}

export interface PunctumPlacement {
  staffPosition: StaffPosition
  neumeInsertionIndex: number
}

const canvasWidth = 720
const canvasHeight = 220
const staffStartX = 64
const staffEndX = 656
const bottomStaffY = 124
const staffLineSpacing = 24
const staffStep = staffLineSpacing / 2
const noteCenterX = 230
const noteSpacing = 48
const noteWidth = 15
const noteHeight = 11
const lyricY = 180

/** Maximum note count for the current fixed-width, single-system MVP. */
export const singleSystemNoteCapacity =
  Math.floor(
    (staffEndX - noteWidth / 2 - noteCenterX) / noteSpacing,
  ) + 1

export function canInsertPunctumInSingleSystem(currentNoteCount: number) {
  return currentNoteCount < singleSystemNoteCapacity
}

function staffPositionY(position: StaffPosition) {
  return bottomStaffY - position * staffStep
}

function staffLineY(line: StaffLine) {
  return bottomStaffY - (line - 1) * staffLineSpacing
}

/**
 * Resolves a point within the current fixed single-system MVP layout.
 * Exact vertical half-step ties snap upward to the higher StaffPosition.
 */
export function getSingleSystemPunctumPlacement(
  x: number,
  y: number,
  neumes: readonly Neume[],
): PunctumPlacement | null {
  const currentNoteCount = countNotes(neumes)
  const minimumPlacementY = staffPositionY(staffPosition(7))
  const maximumPlacementY = staffPositionY(staffPosition(-1))

  if (
    !canInsertPunctumInSingleSystem(currentNoteCount) ||
    x < staffStartX ||
    x > staffEndX ||
    y < minimumPlacementY ||
    y > maximumPlacementY
  ) {
    return null
  }

  const snappedPosition = Math.round((bottomStaffY - y) / staffStep) || 0
  const unclampedIndex = Math.round((x - noteCenterX) / noteSpacing)
  const preferredNoteSlot = Math.min(
    currentNoteCount,
    Math.max(0, unclampedIndex),
  )
  const neumeBoundaries = neumes.reduce<number[]>(
    (boundaries, neume) => [
      ...boundaries,
      (boundaries.at(-1) ?? 0) + neume.notes.length,
    ],
    [0],
  )
  const neumeInsertionIndex = neumeBoundaries.reduce(
    (closestIndex, boundary, index) => {
      const closestBoundary = neumeBoundaries[closestIndex] ?? 0
      const distance = Math.abs(boundary - preferredNoteSlot)
      const closestDistance = Math.abs(closestBoundary - preferredNoteSlot)

      return distance < closestDistance ||
        (distance === closestDistance && boundary > closestBoundary)
        ? index
        : closestIndex
    },
    0,
  )

  return {
    staffPosition: staffPosition(snappedPosition),
    neumeInsertionIndex,
  }
}

export function layoutChant(document: ChantDocument): ChantLayout {
  const noteCentersBySyllableId = new Map<string, number[]>()
  let noteIndex = 0

  const neumes = document.neumes.map((neume) => {
    return {
      neumeId: neume.id,
      lyricSyllableId: neume.lyricSyllableId,
      kind: neume.kind,
      notes: neume.notes.map((note) => {
        const centerX = noteCenterX + noteIndex * noteSpacing
        const centerY = staffPositionY(note.staffPosition)
        const associatedNoteCenters =
          noteCentersBySyllableId.get(neume.lyricSyllableId) ?? []

        noteIndex += 1
        associatedNoteCenters.push(centerX)
        noteCentersBySyllableId.set(
          neume.lyricSyllableId,
          associatedNoteCenters,
        )

        return {
          noteId: note.id,
          x: centerX - noteWidth / 2,
          y: centerY - noteHeight / 2,
          width: noteWidth,
          height: noteHeight,
        }
      }),
    }
  })

  const lyrics = document.syllables.flatMap((syllable) => {
    const associatedNoteCenters = noteCentersBySyllableId.get(syllable.id)

    if (!associatedNoteCenters || associatedNoteCenters.length === 0) {
      return []
    }

    const firstNoteCenter = associatedNoteCenters[0]
    const lastNoteCenter = associatedNoteCenters.at(-1)

    if (firstNoteCenter === undefined || lastNoteCenter === undefined) {
      return []
    }

    return [
      {
        syllableId: syllable.id,
        text: syllable.text,
        x: (firstNoteCenter + lastNoteCenter) / 2,
        y: lyricY,
        fontSize: 20,
      },
    ]
  })

  return {
    title: document.title,
    width: canvasWidth,
    height: canvasHeight,
    staffLines: ([1, 2, 3, 4] as const).map((line) => ({
      x1: staffStartX,
      x2: staffEndX,
      y: staffLineY(line),
    })),
    clef: {
      type: document.clef.type,
      staffLine: document.clef.staffLine,
      x: 100,
      y: staffLineY(document.clef.staffLine),
      fontSize: 38,
    },
    neumes,
    lyrics,
  }
}
