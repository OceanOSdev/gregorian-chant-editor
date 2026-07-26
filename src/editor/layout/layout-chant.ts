import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type StaffLine,
  type StaffPosition,
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

/**
 * One derived system. All child geometry is currently score-absolute, and
 * startNeumeIndex is the global semantic index of its first neume.
 */
export interface ChantSystemLayout {
  index: number
  x: number
  y: number
  width: number
  height: number
  staffLines: readonly StaffLineLayout[]
  clef: ClefLayout
  neumes: readonly NeumeLayout[]
  lyrics: readonly LyricLayout[]
  startNeumeIndex: number
}

/** Derived, score-absolute geometry with height determined by system count. */
export interface ChantLayout {
  title: string
  width: number
  height: number
  systems: readonly ChantSystemLayout[]
}

export type GraphicalNeumeKind = 'punctum' | 'podatus' | 'clivis' | 'scandicus'

export type GraphicalStaffPositions =
  | readonly [StaffPosition]
  | readonly [StaffPosition, StaffPosition]
  | readonly [StaffPosition, StaffPosition, StaffPosition]

export type GraphicalNeumePlacement =
  | {
      kind: 'punctum'
      firstStaffPosition: StaffPosition
      staffPositions: readonly [StaffPosition]
      preferredNeumeInsertionIndex: number
    }
  | {
      kind: 'podatus'
      firstStaffPosition: StaffPosition
      staffPositions: readonly [StaffPosition, StaffPosition]
      preferredNeumeInsertionIndex: number
    }
  | {
      kind: 'clivis'
      firstStaffPosition: StaffPosition
      staffPositions: readonly [StaffPosition, StaffPosition]
      preferredNeumeInsertionIndex: number
    }
  | {
      kind: 'scandicus'
      firstStaffPosition: StaffPosition
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition]
      preferredNeumeInsertionIndex: number
    }

export interface PreviewNoteLayout {
  x: number
  y: number
  width: number
  height: number
}

export type GraphicalPlacementPreviewLayout =
  | {
      kind: 'punctum'
      notes: readonly [PreviewNoteLayout]
      connectors: readonly []
    }
  | {
      kind: 'podatus' | 'clivis'
      notes: readonly [PreviewNoteLayout, PreviewNoteLayout]
      connectors: readonly [NeumeConnectorLayout]
    }
  | {
      kind: 'scandicus'
      notes: readonly [PreviewNoteLayout, PreviewNoteLayout, PreviewNoteLayout]
      connectors: readonly [NeumeConnectorLayout, NeumeConnectorLayout]
    }

export type GraphicalPlacementPreviewInput =
  | {
      kind: 'punctum'
      staffPositions: readonly [StaffPosition]
      insertionIndex: number
    }
  | {
      kind: 'podatus'
      staffPositions: readonly [StaffPosition, StaffPosition]
      insertionIndex: number
    }
  | {
      kind: 'clivis'
      staffPositions: readonly [StaffPosition, StaffPosition]
      insertionIndex: number
    }
  | {
      kind: 'scandicus'
      staffPositions: readonly [StaffPosition, StaffPosition, StaffPosition]
      insertionIndex: number
    }

export const scoreWidth = 720
export const systemWidth = scoreWidth
export const systemHeight = 220
export const systemGap = 24
export const systemVerticalAdvance = systemHeight + systemGap
export const svgTopPadding = 0
export const svgBottomPadding = 0
export const firstSystemTopY = svgTopPadding
export const firstSystemBottomY = firstSystemTopY + systemHeight
export const staffStartX = 64
export const staffEndX = 656
export const firstNeumeCenterX = 230
export const clefX = 100
export const firstSystemBottomStaffY = 124
export const staffLineSpacing = 24
export const staffStep = staffLineSpacing / 2
export const firstSystemLyricBaselineY = 180
export const noteWidth = 15
export const noteHeight = 11
export const neumeConnectorStrokeWidth = 3
export const interNeumeGap = 33
export const compactNoteCenterOffset = 12

/**
 * Converts semantic pitch to an absolute y coordinate in the score.
 * Callers laying out later systems supply that system's bottom-staff y.
 */
export function staffPositionY(
  position: StaffPosition,
  bottomStaffY = firstSystemBottomStaffY,
) {
  return bottomStaffY - position * staffStep
}

function staffLineY(line: StaffLine, bottomStaffY: number) {
  return bottomStaffY - (line - 1) * staffLineSpacing
}

export function getNeumeNoteCenterOffsets(
  kind: Neume['kind'],
): readonly number[] {
  switch (kind) {
    case 'punctum':
      return [0]
    case 'podatus':
    case 'clivis':
      return [0, compactNoteCenterOffset]
    case 'scandicus':
      return [0, compactNoteCenterOffset, compactNoteCenterOffset * 2]
  }
}

/**
 * Creates a note rectangle in absolute score coordinates.
 */
export function createNoteLayout(
  centerX: number,
  position: StaffPosition,
  bottomStaffY = firstSystemBottomStaffY,
): PreviewNoteLayout {
  return {
    x: centerX - noteWidth / 2,
    y: staffPositionY(position, bottomStaffY) - noteHeight / 2,
    width: noteWidth,
    height: noteHeight,
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

/**
 * Encloses both note rectangles and connector stroke. The shared raw bounds
 * drive wrapping, insertion midpoints, selection outlines, and lyric anchors.
 */
export function getNeumeLayoutBounds(
  notes: readonly PreviewNoteLayout[],
  connectors: readonly NeumeConnectorLayout[],
): LayoutBounds {
  const connectorHalfStroke = neumeConnectorStrokeWidth / 2
  const minimumX = Math.min(
    ...notes.map((note) => note.x),
    ...connectors.map((connector) => connector.x - connectorHalfStroke),
  )
  const maximumX = Math.max(
    ...notes.map((note) => note.x + note.width),
    ...connectors.map((connector) => connector.x + connectorHalfStroke),
  )
  const minimumY = Math.min(
    ...notes.map((note) => note.y),
    ...connectors.map(
      (connector) => Math.min(connector.y1, connector.y2) - connectorHalfStroke,
    ),
  )
  const maximumY = Math.max(
    ...notes.map((note) => note.y + note.height),
    ...connectors.map(
      (connector) => Math.max(connector.y1, connector.y2) + connectorHalfStroke,
    ),
  )

  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  }
}

function createConnectorLayouts(
  kind: Neume['kind'],
  notes: readonly PreviewNoteLayout[],
): readonly NeumeConnectorLayout[] {
  const firstNote = notes[0]
  const secondNote = notes[1]
  const thirdNote = notes[2]

  if (kind === 'punctum' || !firstNote || !secondNote) {
    return []
  }

  if (kind === 'scandicus' && thirdNote) {
    return [
      createTwoNoteConnector(firstNote, secondNote),
      createTwoNoteConnector(secondNote, thirdNote),
    ]
  }

  return [createTwoNoteConnector(firstNote, secondNote)]
}

interface RawNeumeGeometry {
  notes: readonly PreviewNoteLayout[]
  connectors: readonly NeumeConnectorLayout[]
  bounds: LayoutBounds
  finalNoteCenterX: number
}

/**
 * Lays out one complete neume in absolute score coordinates. Committed
 * layout, wrapping measurement, and previews share this width model.
 */
function layoutRawNeume(
  kind: Neume['kind'],
  staffPositions: readonly StaffPosition[],
  firstCenterX: number,
  bottomStaffY: number,
): RawNeumeGeometry {
  const offsets = getNeumeNoteCenterOffsets(kind)
  const notes = staffPositions.map((position, index) =>
    createNoteLayout(
      firstCenterX + (offsets[index] ?? 0),
      position,
      bottomStaffY,
    ),
  )
  const connectors = createConnectorLayouts(kind, notes)

  return {
    notes,
    connectors,
    bounds: getNeumeLayoutBounds(notes, connectors),
    finalNoteCenterX: firstCenterX + (offsets.at(-1) ?? 0),
  }
}

export function canGraphicalNeumeFitNormalSystem(
  kind: GraphicalNeumeKind,
  staffPositions: GraphicalStaffPositions,
) {
  const geometry = layoutRawNeume(
    kind,
    staffPositions,
    firstNeumeCenterX,
    firstSystemBottomStaffY,
  )

  return (
    geometry.bounds.x >= staffStartX &&
    geometry.bounds.x + geometry.bounds.width <= staffEndX
  )
}

/**
 * Measures the complete rendered horizontal extent of a semantic neume
 * using the same note and connector geometry as committed layout.
 */
export function measureNeumeWidth(neume: Neume): number {
  const geometry = layoutRawNeume(
    neume.kind,
    neume.notes.map((note) => note.staffPosition),
    0,
    firstSystemBottomStaffY,
  )

  return geometry.bounds.width
}

function getNextNeumeCenterX(geometry: RawNeumeGeometry) {
  return geometry.finalNoteCenterX + noteWidth + interNeumeGap
}

interface WrappedSystem {
  startNeumeIndex: number
  neumes: readonly Neume[]
}

/**
 * Wraps complete semantic neumes in order using rendered bounds. Supplying
 * a smaller usable boundary is useful for focused safety tests. Exact fits
 * remain on the current system. An oversized neume is placed once on an empty
 * system so iteration always advances.
 */
export function wrapNeumes(
  neumes: readonly Neume[],
  usableRightBoundary = staffEndX,
): readonly WrappedSystem[] {
  if (neumes.length === 0) {
    return [{ startNeumeIndex: 0, neumes: [] }]
  }

  const systems: WrappedSystem[] = []
  let currentNeumes: Neume[] = []
  let currentStartIndex = 0
  let nextCenterX = firstNeumeCenterX

  for (const [neumeIndex, neume] of neumes.entries()) {
    let geometry = layoutRawNeume(
      neume.kind,
      neume.notes.map((note) => note.staffPosition),
      nextCenterX,
      firstSystemBottomStaffY,
    )

    if (
      geometry.bounds.x + geometry.bounds.width > usableRightBoundary &&
      currentNeumes.length > 0
    ) {
      systems.push({
        startNeumeIndex: currentStartIndex,
        neumes: currentNeumes,
      })
      currentStartIndex = neumeIndex
      currentNeumes = []
      nextCenterX = firstNeumeCenterX
      geometry = layoutRawNeume(
        neume.kind,
        neume.notes.map((note) => note.staffPosition),
        nextCenterX,
        firstSystemBottomStaffY,
      )
    }

    currentNeumes.push(neume)
    nextCenterX = getNextNeumeCenterX(geometry)

    if (geometry.bounds.x + geometry.bounds.width > usableRightBoundary) {
      systems.push({
        startNeumeIndex: currentStartIndex,
        neumes: currentNeumes,
      })
      currentStartIndex = neumeIndex + 1
      currentNeumes = []
      nextCenterX = firstNeumeCenterX
    }
  }

  if (currentNeumes.length > 0) {
    systems.push({
      startNeumeIndex: currentStartIndex,
      neumes: currentNeumes,
    })
  }

  return systems
}

function getNeumeLyricAlignmentX(neumeLayout: NeumeLayout): number | null {
  // Ascending kinds and Punctum use their first note; Clivis uses its complete
  // raw bounds because its compact descending shape extends to the right.
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
      const alignmentX = neumeLayout.bounds.x + neumeLayout.bounds.width / 2

      return Number.isFinite(alignmentX) ? alignmentX : null
    }
  }
}

function getNeumeNoteCenters(neumes: readonly Neume[]) {
  let nextCenterX = firstNeumeCenterX

  return neumes.map((neume) => {
    const offsets = getNeumeNoteCenterOffsets(neume.kind)
    const centers = offsets.map((offset) => nextCenterX + offset)
    const finalCenter = centers.at(-1)

    if (finalCenter !== undefined) {
      nextCenterX = finalCenter + noteWidth + interNeumeGap
    }

    return centers
  })
}

/**
 * Returns the horizontal center for a complete-neume insertion boundary.
 * Valid indexes are the inclusive range from zero through neumes.length.
 */
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
    ? firstNeumeCenterX
    : finalCenter + noteWidth + interNeumeGap
}

function createNeumeNoteLayouts(
  firstCenterX: number,
  placement: GraphicalPlacementPreviewInput,
  bottomStaffY = firstSystemBottomStaffY,
):
  | readonly [PreviewNoteLayout]
  | readonly [PreviewNoteLayout, PreviewNoteLayout]
  | readonly [PreviewNoteLayout, PreviewNoteLayout, PreviewNoteLayout] {
  const geometry = layoutRawNeume(
    placement.kind,
    placement.staffPositions,
    firstCenterX,
    bottomStaffY,
  )
  const [firstNote, secondNote, thirdNote] = geometry.notes

  if (!firstNote) {
    throw new Error('A graphical neume must contain a first note')
  }

  if (placement.kind === 'punctum') {
    return [firstNote]
  }

  if (!secondNote) {
    throw new Error('A multi-note graphical neume must contain two notes')
  }

  if (placement.kind === 'scandicus') {
    if (!thirdNote) {
      throw new Error('A Scandicus must contain three notes')
    }

    return [firstNote, secondNote, thirdNote]
  }

  return [firstNote, secondNote]
}

/**
 * Simulates an ID-free candidate among committed neumes and returns its
 * score-absolute geometry at the destination produced by hypothetical reflow.
 */
export function layoutGraphicalPlacementPreview(
  neumes: readonly Neume[],
  placement: GraphicalPlacementPreviewInput,
): GraphicalPlacementPreviewLayout | null {
  if (
    placement.insertionIndex < 0 ||
    placement.insertionIndex > neumes.length
  ) {
    return null
  }

  const candidate = { placement }
  const items: ({ neume: Neume } | typeof candidate)[] = neumes.map(
    (neume) => ({ neume }),
  )
  items.splice(placement.insertionIndex, 0, candidate)
  let systemIndex = 0
  let nextCenterX = firstNeumeCenterX
  let systemHasItems = false
  let notes: ReturnType<typeof createNeumeNoteLayouts> | null = null

  for (const item of items) {
    const kind = 'neume' in item ? item.neume.kind : item.placement.kind
    const staffPositions =
      'neume' in item
        ? item.neume.notes.map((note) => note.staffPosition)
        : item.placement.staffPositions
    let bottomStaffY =
      firstSystemBottomStaffY + systemIndex * systemVerticalAdvance
    let geometry = layoutRawNeume(
      kind,
      staffPositions,
      nextCenterX,
      bottomStaffY,
    )

    if (
      geometry.bounds.x + geometry.bounds.width > staffEndX &&
      systemHasItems
    ) {
      systemIndex += 1
      nextCenterX = firstNeumeCenterX
      systemHasItems = false
      bottomStaffY =
        firstSystemBottomStaffY + systemIndex * systemVerticalAdvance
      geometry = layoutRawNeume(kind, staffPositions, nextCenterX, bottomStaffY)
    }

    if (item === candidate) {
      notes = createNeumeNoteLayouts(nextCenterX, item.placement, bottomStaffY)
    }

    nextCenterX = getNextNeumeCenterX(geometry)
    systemHasItems = true

    if (geometry.bounds.x + geometry.bounds.width > staffEndX) {
      systemIndex += 1
      nextCenterX = firstNeumeCenterX
      systemHasItems = false
    }
  }

  if (!notes) {
    return null
  }

  switch (placement.kind) {
    case 'punctum':
      return {
        kind: placement.kind,
        notes: [notes[0]],
        connectors: [],
      }
    case 'podatus':
    case 'clivis': {
      const [firstNote, secondNote] = notes

      if (!secondNote) {
        return null
      }

      return {
        kind: placement.kind,
        notes: [firstNote, secondNote],
        connectors: [createTwoNoteConnector(firstNote, secondNote)],
      }
    }
    case 'scandicus': {
      const [firstNote, secondNote, thirdNote] = notes

      if (!secondNote || !thirdNote) {
        return null
      }

      return {
        kind: placement.kind,
        notes: [firstNote, secondNote, thirdNote],
        connectors: [
          createTwoNoteConnector(firstNote, secondNote),
          createTwoNoteConnector(secondNote, thirdNote),
        ],
      }
    }
  }
}

function createGraphicalNeumePlacement(
  kind: GraphicalNeumeKind,
  firstStaffPosition: StaffPosition,
  preferredNeumeInsertionIndex: number,
): GraphicalNeumePlacement {
  switch (kind) {
    case 'punctum':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [firstStaffPosition],
        preferredNeumeInsertionIndex,
      }
    case 'podatus':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 1),
        ],
        preferredNeumeInsertionIndex,
      }
    case 'clivis':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition - 1),
        ],
        preferredNeumeInsertionIndex,
      }
    case 'scandicus':
      return {
        kind,
        firstStaffPosition,
        staffPositions: [
          firstStaffPosition,
          staffPosition(firstStaffPosition + 1),
          staffPosition(firstStaffPosition + 2),
        ],
        preferredNeumeInsertionIndex,
      }
  }
}

/**
 * Resolves a score-absolute point within one rendered system. Exact
 * vertical half-step ties snap upward to the higher StaffPosition. A point at
 * a neume's bounds midpoint resolves before it, and startNeumeIndex converts
 * that system-local boundary to the global semantic boundary.
 */
export function getSystemNeumePlacement(
  point: { x: number; y: number },
  kind: GraphicalNeumeKind,
  system: ChantSystemLayout,
): GraphicalNeumePlacement | null {
  const bottomStaffY =
    system.staffLines.length > 0
      ? Math.max(...system.staffLines.map((line) => line.y))
      : undefined

  if (bottomStaffY === undefined) {
    return null
  }

  const minimumPlacementY = staffPositionY(staffPosition(7), bottomStaffY)
  const maximumPlacementY = staffPositionY(staffPosition(-1), bottomStaffY)

  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < staffStartX ||
    point.x > staffEndX ||
    point.y < minimumPlacementY ||
    point.y > maximumPlacementY
  ) {
    return null
  }

  const snappedPosition = Math.round((bottomStaffY - point.y) / staffStep) || 0
  const firstStaffPosition = staffPosition(snappedPosition)
  let neumeInsertionIndex = system.neumes.length

  for (const [index, neume] of system.neumes.entries()) {
    const midpoint = neume.bounds.x + neume.bounds.width / 2

    if (point.x <= midpoint) {
      neumeInsertionIndex = index
      break
    }
  }

  return createGraphicalNeumePlacement(
    kind,
    firstStaffPosition,
    system.startNeumeIndex + neumeInsertionIndex,
  )
}

function layoutCommittedNeume(
  neume: Neume,
  firstCenterX: number,
  bottomStaffY: number,
): NeumeLayout {
  const geometry = layoutRawNeume(
    neume.kind,
    neume.notes.map((note) => note.staffPosition),
    firstCenterX,
    bottomStaffY,
  )

  return {
    neumeId: neume.id,
    lyricSyllableId: neume.lyricSyllableId,
    kind: neume.kind,
    notes: geometry.notes.map((note, noteIndex) => ({
      ...note,
      noteId: neume.notes[noteIndex]?.id ?? '',
    })),
    connectors: geometry.connectors,
    bounds: geometry.bounds,
  }
}

function layoutSystemNeumes(neumes: readonly Neume[], bottomStaffY: number) {
  let nextCenterX = firstNeumeCenterX

  return neumes.map((neume) => {
    const layout = layoutCommittedNeume(neume, nextCenterX, bottomStaffY)
    const offsets = getNeumeNoteCenterOffsets(neume.kind)

    nextCenterX =
      nextCenterX + (offsets.at(-1) ?? 0) + noteWidth + interNeumeGap

    return layout
  })
}

export function layoutChant(document: ChantDocument): ChantLayout {
  const wrappedSystems = wrapNeumes(document.neumes)
  const systemsWithoutLyrics = wrappedSystems.map(
    ({ startNeumeIndex, neumes }, index): ChantSystemLayout => {
      const y = firstSystemTopY + index * systemVerticalAdvance
      const bottomStaffY = firstSystemBottomStaffY + y

      return {
        index,
        x: 0,
        y,
        width: systemWidth,
        height: systemHeight,
        staffLines: ([1, 2, 3, 4] as const).map((line) => ({
          x1: staffStartX,
          x2: staffEndX,
          y: staffLineY(line, bottomStaffY),
        })),
        clef: {
          type: document.clef.type,
          staffLine: document.clef.staffLine,
          x: clefX,
          y: staffLineY(document.clef.staffLine, bottomStaffY),
          fontSize: 38,
        },
        neumes: layoutSystemNeumes(neumes, bottomStaffY),
        lyrics: [],
        startNeumeIndex,
      }
    },
  )
  const firstNeumeBySyllableId = new Map<
    string,
    { neume: NeumeLayout; systemIndex: number }
  >()

  // A syllable is laid out once, on the system containing its first neume.
  for (const system of systemsWithoutLyrics) {
    for (const neume of system.neumes) {
      if (!firstNeumeBySyllableId.has(neume.lyricSyllableId)) {
        firstNeumeBySyllableId.set(neume.lyricSyllableId, {
          neume,
          systemIndex: system.index,
        })
      }
    }
  }

  const lyricsBySystem = systemsWithoutLyrics.map(() => [] as LyricLayout[])

  for (const syllable of document.syllables) {
    const first = firstNeumeBySyllableId.get(syllable.id)

    if (!first) {
      continue
    }

    const alignmentX = getNeumeLyricAlignmentX(first.neume)

    if (alignmentX === null) {
      continue
    }

    lyricsBySystem[first.systemIndex]?.push({
      syllableId: syllable.id,
      text: syllable.text,
      x: alignmentX,
      y: firstSystemLyricBaselineY + first.systemIndex * systemVerticalAdvance,
      fontSize: 20,
    })
  }

  const systems = systemsWithoutLyrics.map((system) => ({
    ...system,
    lyrics: lyricsBySystem[system.index] ?? [],
  }))

  return {
    title: document.title,
    width: scoreWidth,
    height:
      firstSystemBottomY +
      (systems.length - 1) * systemVerticalAdvance +
      svgBottomPadding,
    systems,
  }
}
