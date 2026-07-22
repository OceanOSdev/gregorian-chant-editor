import { describe, expect, it } from 'vitest'
import { insertPunctum } from '../commands/insert-punctum'
import {
  staffPosition,
  type ChantDocument,
  type Punctum,
} from '../domain/chant-document'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import {
  getSingleSystemPunctumPlacement,
  layoutChant,
  singleSystemNoteCapacity,
} from './layout-chant'

function createDocument(noteCount: number): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    notes: Array.from({ length: noteCount }, (_, index) => ({
      id: `note-${index + 1}`,
      kind: 'punctum',
      staffPosition: staffPosition(2),
      lyricSyllableId: 'syllable-1',
    })),
  }
}

function placementGeometry() {
  const layout = layoutChant(createDocument(3))
  const staffYs = layout.staffLines
    .map((line) => line.y)
    .sort((first, second) => first - second)
  const staffStartX = layout.staffLines[0]?.x1
  const staffEndX = layout.staffLines[0]?.x2
  const topStaffY = staffYs[0]
  const nextStaffY = staffYs[1]
  const bottomStaffY = staffYs.at(-1)

  if (
    staffStartX === undefined ||
    staffEndX === undefined ||
    topStaffY === undefined ||
    nextStaffY === undefined ||
    bottomStaffY === undefined
  ) {
    throw new Error('Missing fixed-system layout geometry')
  }

  return {
    layout,
    staffStartX,
    staffEndX,
    topStaffY,
    bottomStaffY,
    staffStep: (nextStaffY - topStaffY) / 2,
    staffMiddleX: (staffStartX + staffEndX) / 2,
  }
}

describe('single-system punctum placement', () => {
  it('snaps staff y-coordinates to StaffPosition steps', () => {
    const { bottomStaffY, staffMiddleX, staffStep } = placementGeometry()

    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY,
        0,
      )?.staffPosition,
    ).toBe(0)
    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY - staffStep,
        0,
      )?.staffPosition,
    ).toBe(1)
  })

  it('snaps exact halfway ties upward', () => {
    const { bottomStaffY, staffMiddleX, staffStep } = placementGeometry()

    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY - staffStep / 2,
        0,
      )?.staffPosition,
    ).toBe(1)
    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY + staffStep / 2,
        0,
      )?.staffPosition,
    ).toBe(0)
  })

  it('rejects points outside the permitted vertical range', () => {
    const {
      bottomStaffY,
      staffMiddleX,
      staffStep,
      topStaffY,
    } = placementGeometry()

    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY + staffStep + 0.1,
        0,
      ),
    ).toBeNull()
    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        topStaffY - staffStep - 0.1,
        0,
      ),
    ).toBeNull()
  })

  it('rejects points outside the horizontal staff bounds', () => {
    const { bottomStaffY, staffEndX, staffStartX } = placementGeometry()

    expect(
      getSingleSystemPunctumPlacement(
        staffStartX - 0.1,
        bottomStaffY,
        0,
      ),
    ).toBeNull()
    expect(
      getSingleSystemPunctumPlacement(
        staffEndX + 0.1,
        bottomStaffY,
        0,
      ),
    ).toBeNull()
  })

  it('derives insertion indexes at note centers and slot midpoints', () => {
    const { bottomStaffY, layout, staffEndX } = placementGeometry()
    const firstNote = layout.notes[0]
    const secondNote = layout.notes[1]
    const thirdNote = layout.notes[2]

    if (!firstNote || !secondNote || !thirdNote) {
      throw new Error('Missing note layout')
    }

    const firstCenter = firstNote.x + firstNote.width / 2
    const secondCenter = secondNote.x + secondNote.width / 2
    const thirdCenter = thirdNote.x + thirdNote.width / 2
    const firstMidpoint = (firstCenter + secondCenter) / 2

    expect(
      getSingleSystemPunctumPlacement(
        firstCenter,
        bottomStaffY,
        3,
      )?.insertionIndex,
    ).toBe(0)
    expect(
      getSingleSystemPunctumPlacement(
        secondCenter,
        bottomStaffY,
        3,
      )?.insertionIndex,
    ).toBe(1)
    expect(
      getSingleSystemPunctumPlacement(
        thirdCenter,
        bottomStaffY,
        3,
      )?.insertionIndex,
    ).toBe(2)
    expect(
      getSingleSystemPunctumPlacement(
        firstMidpoint,
        bottomStaffY,
        3,
      )?.insertionIndex,
    ).toBe(1)
    expect(
      getSingleSystemPunctumPlacement(
        staffEndX,
        bottomStaffY,
        3,
      )?.insertionIndex,
    ).toBe(3)
  })

  it('rejects placement at fixed-system capacity', () => {
    const { bottomStaffY, staffMiddleX } = placementGeometry()

    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY,
        singleSystemNoteCapacity,
      ),
    ).toBeNull()
  })

  it('routes successful placement through undo and redo history', () => {
    const document = createDocument(1)
    const { bottomStaffY, staffMiddleX } = placementGeometry()
    const placement = getSingleSystemPunctumPlacement(
      staffMiddleX,
      bottomStaffY,
      document.notes.length,
    )

    if (!placement) {
      throw new Error('Expected a valid placement')
    }

    const punctum: Punctum = {
      id: 'placed-note',
      kind: 'punctum',
      staffPosition: placement.staffPosition,
      lyricSyllableId: 'syllable-1',
    }
    const placedHistory = applyDocumentEdit(
      createDocumentHistory(document),
      (currentDocument) =>
        insertPunctum(
          currentDocument,
          punctum,
          placement.insertionIndex,
        ),
    )
    const undoneHistory = undoDocumentEdit(placedHistory)
    const redoneHistory = redoDocumentEdit(undoneHistory)

    expect(undoneHistory.present).toBe(document)
    expect(redoneHistory.present).toBe(placedHistory.present)
  })

  it('does not create history for rejected placement', () => {
    const document = createDocument(singleSystemNoteCapacity)
    const history = createDocumentHistory(document)
    const { bottomStaffY, staffMiddleX } = placementGeometry()
    const rejectedHistory = applyDocumentEdit(history, (currentDocument) => {
      const placement = getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY,
        currentDocument.notes.length,
      )

      return placement
        ? insertPunctum(
            currentDocument,
            {
              id: 'rejected-note',
              kind: 'punctum',
              staffPosition: placement.staffPosition,
              lyricSyllableId: 'syllable-1',
            },
            placement.insertionIndex,
          )
        : currentDocument
    })

    expect(rejectedHistory).toBe(history)
  })
})
