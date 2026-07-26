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

export interface LayoutBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface NeumeConnectorLayout {
  x: number
  y1: number
  y2: number
}

export interface NeumeLayout {
  neumeId: string
  lyricSyllableId: string
  kind: Neume['kind']
  notes: NoteLayout[]
  connectors: readonly NeumeConnectorLayout[]
  bounds: LayoutBounds
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

export type GraphicalNeumeKind =
  | 'punctum'
  | 'podatus'
  | 'clivis'

export type GraphicalStaffPositions =
  | readonly [StaffPosition]
  | readonly [StaffPosition, StaffPosition]

export interface GraphicalNeumePlacement {
  firstStaffPosition: StaffPosition
  staffPositions: GraphicalStaffPositions
  preferredNeumeInsertionIndex: number
}

export interface PreviewNoteLayout {
  x: number
  y: number
  width: number
  height: number
}

export interface GraphicalPlacementPreviewLayout {
  kind: GraphicalNeumeKind
  notes:
    | readonly [PreviewNoteLayout]
    | readonly [PreviewNoteLayout, PreviewNoteLayout]
  connectors: readonly NeumeConnectorLayout[]
}

export interface GraphicalPlacementPreviewInput {
  kind: GraphicalNeumeKind
  staffPositions: GraphicalStaffPositions
  insertionIndex: number
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
export const neumeConnectorStrokeWidth = 3
const interNeumeGap = noteSpacing - noteWidth
const compactNoteCenterOffset = 12
const lyricY = 180

/** Maximum note count for the current fixed-width, single-system MVP. */
export const singleSystemNoteCapacity =
  Math.floor(
    (staffEndX - noteWidth / 2 - noteCenterX) / noteSpacing,
  ) + 1

export function canInsertPunctumInSingleSystem(currentNoteCount: number) {
  return canInsertNotesInSingleSystem(currentNoteCount, 1)
}

export function canInsertNotesInSingleSystem(
  currentNoteCount: number,
  addedNoteCount: number,
) {
  return (
    Number.isInteger(currentNoteCount) &&
    Number.isInteger(addedNoteCount) &&
    currentNoteCount >= 0 &&
    addedNoteCount >= 0 &&
    currentNoteCount + addedNoteCount <= singleSystemNoteCapacity
  )
}

export function staffPositionY(position: StaffPosition) {
  return bottomStaffY - position * staffStep
}

function staffLineY(line: StaffLine) {
  return bottomStaffY - (line - 1) * staffLineSpacing
}

function isCompactNeume(neume: Neume) {
  switch (neume.kind) {
    case 'punctum':
      return false
    case 'podatus':
    case 'clivis':
    case 'scandicus':
      return true
  }
}

export function createTwoNoteConnector(
  firstNote: PreviewNoteLayout,
  secondNote: PreviewNoteLayout,
): NeumeConnectorLayout {
  return {
    x: secondNote.x + 2,
    y1: firstNote.y + firstNote.height / 2,
    y2: secondNote.y + secondNote.height / 2,
  }
}

export function getNeumeLayoutBounds(
  notes: readonly PreviewNoteLayout[],
  connectors: readonly NeumeConnectorLayout[],
): LayoutBounds {
  const connectorHalfStroke = neumeConnectorStrokeWidth / 2
  const minimumX = Math.min(
    ...notes.map((note) => note.x),
    ...connectors.map(
      (connector) => connector.x - connectorHalfStroke,
    ),
  )
  const maximumX = Math.max(
    ...notes.map((note) => note.x + note.width),
    ...connectors.map(
      (connector) => connector.x + connectorHalfStroke,
    ),
  )
  const minimumY = Math.min(
    ...notes.map((note) => note.y),
    ...connectors.map(
      (connector) =>
        Math.min(connector.y1, connector.y2) - connectorHalfStroke,
    ),
  )
  const maximumY = Math.max(
    ...notes.map((note) => note.y + note.height),
    ...connectors.map(
      (connector) =>
        Math.max(connector.y1, connector.y2) + connectorHalfStroke,
    ),
  )

  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  }
}

function getNeumeLyricAlignmentX(
  neumeLayout: NeumeLayout,
): number | null {
  switch (neumeLayout.kind) {
    case 'punctum':
    case 'podatus':
    case 'scandicus': {
      const firstNote = neumeLayout.notes[0]
      const alignmentX = firstNote
        ? firstNote.x + firstNote.width / 2
        : Number.NaN

      return Number.isFinite(alignmentX) ? alignmentX : null
    }
    case 'clivis': {
      const alignmentX =
        neumeLayout.bounds.x + neumeLayout.bounds.width / 2

      return Number.isFinite(alignmentX) ? alignmentX : null
    }
  }
}

function getNeumeNoteCenters(neumes: readonly Neume[]) {
  let nextCenterX = noteCenterX

  return neumes.map((neume) => {
    const centers = neume.notes.map((_, noteIndex) =>
      isCompactNeume(neume)
        ? nextCenterX + noteIndex * compactNoteCenterOffset
        : nextCenterX + noteIndex * noteSpacing,
    )
    const finalCenter = centers.at(-1)

    if (finalCenter !== undefined) {
      nextCenterX = finalCenter + noteWidth + interNeumeGap
    }

    return centers
  })
}

export function getNeumeBoundaryCenterX(
  neumes: readonly Neume[],
  insertionIndex: number,
): number | null {
  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > neumes.length
  ) {
    return null
  }

  const centers = getNeumeNoteCenters(neumes)
  const followingFirstCenter = centers[insertionIndex]?.[0]

  if (followingFirstCenter !== undefined) {
    return followingFirstCenter
  }

  const finalCenter = centers.at(-1)?.at(-1)

  return finalCenter === undefined
    ? noteCenterX
    : finalCenter + noteWidth + interNeumeGap
}

function createNoteLayout(
  centerX: number,
  position: StaffPosition,
): PreviewNoteLayout {
  return {
    x: centerX - noteWidth / 2,
    y: staffPositionY(position) - noteHeight / 2,
    width: noteWidth,
    height: noteHeight,
  }
}

function createNeumeNoteLayouts(
  kind: GraphicalNeumeKind,
  firstCenterX: number,
  positions: GraphicalStaffPositions,
):
  | readonly [PreviewNoteLayout]
  | readonly [PreviewNoteLayout, PreviewNoteLayout] {
  const [firstPosition, secondPosition] = positions
  const firstNote = createNoteLayout(firstCenterX, firstPosition)

  if (kind === 'punctum' || secondPosition === undefined) {
    return [firstNote]
  }

  return [
    firstNote,
    createNoteLayout(
      firstCenterX + compactNoteCenterOffset,
      secondPosition,
    ),
  ]
}

export function layoutGraphicalPlacementPreview(
  neumes: readonly Neume[],
  placement: GraphicalPlacementPreviewInput,
): GraphicalPlacementPreviewLayout | null {
  const firstCenterX = getNeumeBoundaryCenterX(
    neumes,
    placement.insertionIndex,
  )

  if (firstCenterX === null) {
    return null
  }

  const notes = createNeumeNoteLayouts(
    placement.kind,
    firstCenterX,
    placement.staffPositions,
  )
  const firstNote = notes[0]
  const secondNote = notes[1]
  const connectors =
    placement.kind !== 'punctum' && secondNote
      ? [createTwoNoteConnector(firstNote, secondNote)]
      : []

  return {
    kind: placement.kind,
    notes,
    connectors,
  }
}

function getGraphicalStaffPositions(
  kind: GraphicalNeumeKind,
  firstStaffPosition: StaffPosition,
): GraphicalStaffPositions {
  if (kind === 'podatus') {
    return [
      firstStaffPosition,
      staffPosition(firstStaffPosition + 1),
    ]
  }

  if (kind === 'clivis') {
    return [
      firstStaffPosition,
      staffPosition(firstStaffPosition - 1),
    ]
  }

  return [firstStaffPosition]
}

/**
 * Resolves a point within the current fixed single-system MVP layout.
 * Exact vertical half-step ties snap upward to the higher StaffPosition.
 */
export function getSingleSystemNeumePlacement(
  point: { x: number; y: number },
  kind: GraphicalNeumeKind,
  neumes: readonly Neume[],
): GraphicalNeumePlacement | null {
  const currentNoteCount = countNotes(neumes)
  const addedNoteCount = kind === 'punctum' ? 1 : 2
  const minimumPlacementY = staffPositionY(staffPosition(7))
  const maximumPlacementY = staffPositionY(staffPosition(-1))

  if (
    !canInsertNotesInSingleSystem(currentNoteCount, addedNoteCount) ||
    point.x < staffStartX ||
    point.x > staffEndX ||
    point.y < minimumPlacementY ||
    point.y > maximumPlacementY
  ) {
    return null
  }

  const snappedPosition =
    Math.round((bottomStaffY - point.y) / staffStep) || 0
  const firstStaffPosition = staffPosition(snappedPosition)
  const neumeCenters = getNeumeNoteCenters(neumes)
  let neumeInsertionIndex = neumes.length

  for (const [index, centers] of neumeCenters.entries()) {
    const firstCenter = centers[0]
    const finalCenter = centers.at(-1)

    if (firstCenter === undefined || finalCenter === undefined) {
      continue
    }

    if (point.x <= firstCenter) {
      neumeInsertionIndex = index
      break
    }

    if (point.x <= finalCenter) {
      neumeInsertionIndex =
        point.x <= (firstCenter + finalCenter) / 2 ? index : index + 1
      break
    }
  }

  return {
    firstStaffPosition,
    staffPositions: getGraphicalStaffPositions(kind, firstStaffPosition),
    preferredNeumeInsertionIndex: neumeInsertionIndex,
  }
}

export function layoutChant(document: ChantDocument): ChantLayout {
  const neumeNoteCenters = getNeumeNoteCenters(document.neumes)

  const neumes = document.neumes.map((neume, neumeIndex) => {
    const noteCenters = neumeNoteCenters[neumeIndex] ?? []
    const notes = neume.notes.map((note, noteIndex) => {
      const centerX = noteCenters[noteIndex] ?? noteCenterX

      return {
        ...createNoteLayout(centerX, note.staffPosition),
        noteId: note.id,
      }
    })
    const firstNote = notes[0]
    const secondNote = notes[1]
    const thirdNote = notes[2]
    let connectors: readonly NeumeConnectorLayout[]

    switch (neume.kind) {
      case 'punctum':
        connectors = []
        break
      case 'podatus':
      case 'clivis':
        connectors =
          firstNote && secondNote
            ? [createTwoNoteConnector(firstNote, secondNote)]
            : []
        break
      case 'scandicus':
        connectors =
          firstNote && secondNote && thirdNote
            ? [
                createTwoNoteConnector(firstNote, secondNote),
                createTwoNoteConnector(secondNote, thirdNote),
              ]
            : []
        break
    }

    return {
      neumeId: neume.id,
      lyricSyllableId: neume.lyricSyllableId,
      kind: neume.kind,
      notes,
      connectors,
      bounds: getNeumeLayoutBounds(notes, connectors),
    }
  })
  const firstNeumeBySyllableId = new Map<string, NeumeLayout>()

  for (const neume of neumes) {
    if (!firstNeumeBySyllableId.has(neume.lyricSyllableId)) {
      firstNeumeBySyllableId.set(neume.lyricSyllableId, neume)
    }
  }

  const lyrics = document.syllables.flatMap((syllable) => {
    const firstNeume = firstNeumeBySyllableId.get(syllable.id)

    if (!firstNeume) {
      return []
    }

    const alignmentX = getNeumeLyricAlignmentX(firstNeume)

    if (alignmentX === null) {
      return []
    }

    return [
      {
        syllableId: syllable.id,
        text: syllable.text,
        x: alignmentX,
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
