import type {
  ChantDocument,
  StaffLine,
  StaffPosition,
} from '../domain/chant-document'

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

export interface PunctumLayout {
  noteId: string
  x: number
  y: number
  width: number
  height: number
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
  notes: PunctumLayout[]
  lyrics: LyricLayout[]
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

export function layoutChant(document: ChantDocument): ChantLayout {
  const noteCentersBySyllableId = new Map<string, number[]>()

  const notes = document.notes.map((note, index) => {
    const centerX = noteCenterX + index * noteSpacing
    const centerY = staffPositionY(note.staffPosition)
    const associatedNoteCenters =
      noteCentersBySyllableId.get(note.lyricSyllableId) ?? []

    associatedNoteCenters.push(centerX)
    noteCentersBySyllableId.set(
      note.lyricSyllableId,
      associatedNoteCenters,
    )

    return {
      noteId: note.id,
      x: centerX - noteWidth / 2,
      y: centerY - noteHeight / 2,
      width: noteWidth,
      height: noteHeight,
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
    notes,
    lyrics,
  }
}
