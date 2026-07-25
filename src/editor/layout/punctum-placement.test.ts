import { describe, expect, it } from 'vitest'
import { insertPunctum } from '../commands/insert-punctum'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type PunctumNeume,
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

function punctum(id: string): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: 'syllable-1',
    notes: [{ id, staffPosition: staffPosition(2) }],
  }
}

function createDocument(neumes: Neume[]): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes,
  }
}

function placementGeometry(neumes: Neume[] = [
  punctum('note-1'),
  punctum('note-2'),
  punctum('note-3'),
]) {
  const layout = layoutChant(createDocument(neumes))
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
    throw new Error('Missing fixed-system geometry')
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
  it('snaps y-coordinates to staff positions with upward halfway ties', () => {
    const { bottomStaffY, staffMiddleX, staffStep } = placementGeometry()

    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY,
        [],
      )?.staffPosition,
    ).toBe(0)
    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY - staffStep / 2,
        [],
      )?.staffPosition,
    ).toBe(1)
  })

  it('rejects points outside horizontal and vertical placement bounds', () => {
    const {
      bottomStaffY,
      staffEndX,
      staffMiddleX,
      staffStartX,
      staffStep,
      topStaffY,
    } = placementGeometry()

    expect(
      getSingleSystemPunctumPlacement(
        staffStartX - 0.1,
        bottomStaffY,
        [],
      ),
    ).toBeNull()
    expect(
      getSingleSystemPunctumPlacement(
        staffEndX + 0.1,
        bottomStaffY,
        [],
      ),
    ).toBeNull()
    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY + staffStep + 0.1,
        [],
      ),
    ).toBeNull()
    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        topStaffY - staffStep - 0.1,
        [],
      ),
    ).toBeNull()
  })

  it('returns current punctum neume boundaries for existing note slots', () => {
    const neumes = [punctum('note-1'), punctum('note-2'), punctum('note-3')]
    const { bottomStaffY, layout, staffEndX } = placementGeometry(neumes)
    const notes = layout.neumes.flatMap((neume) => neume.notes)
    const firstNote = notes[0]
    const secondNote = notes[1]

    if (!firstNote || !secondNote) {
      throw new Error('Missing note layout')
    }

    expect(
      getSingleSystemPunctumPlacement(
        firstNote.x + firstNote.width / 2,
        bottomStaffY,
        neumes,
      )?.neumeInsertionIndex,
    ).toBe(0)
    expect(
      getSingleSystemPunctumPlacement(
        secondNote.x + secondNote.width / 2,
        bottomStaffY,
        neumes,
      )?.neumeInsertionIndex,
    ).toBe(1)
    expect(
      getSingleSystemPunctumPlacement(
        staffEndX,
        bottomStaffY,
        neumes,
      )?.neumeInsertionIndex,
    ).toBe(3)
  })

  it('never returns an index inside a two-note neume', () => {
    const podatus: Neume = {
      id: 'neume-podatus',
      kind: 'podatus',
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'note-1', staffPosition: staffPosition(2) },
        { id: 'note-2', staffPosition: staffPosition(4) },
      ],
    }
    const neumes = [podatus, punctum('note-3')]
    const { bottomStaffY, layout } = placementGeometry(neumes)
    const secondPodatusNote = layout.neumes[0]?.notes[1]

    if (!secondPodatusNote) {
      throw new Error('Missing podatus layout')
    }

    expect(
      getSingleSystemPunctumPlacement(
        secondPodatusNote.x + secondPodatusNote.width / 2,
        bottomStaffY,
        neumes,
      )?.neumeInsertionIndex,
    ).toBe(1)
  })

  it('rejects placement at total nested-note capacity', () => {
    const neumes = Array.from(
      { length: singleSystemNoteCapacity },
      (_, index) => punctum(`note-${index}`),
    )
    const { bottomStaffY, staffMiddleX } = placementGeometry(neumes)

    expect(
      getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY,
        neumes,
      ),
    ).toBeNull()
  })

  it('routes successful boundary placement through undo and redo', () => {
    const document = createDocument([punctum('note-1')])
    const { bottomStaffY, staffMiddleX } = placementGeometry(document.neumes)
    const placement = getSingleSystemPunctumPlacement(
      staffMiddleX,
      bottomStaffY,
      document.neumes,
    )

    if (!placement) {
      throw new Error('Expected valid placement')
    }

    const placed = applyDocumentEdit(
      createDocumentHistory(document),
      (current) =>
        insertPunctum(
          current,
          {
            id: 'neume-placed',
            kind: 'punctum',
            lyricSyllableId: 'syllable-1',
            notes: [
              {
                id: 'note-placed',
                staffPosition: placement.staffPosition,
              },
            ],
          },
          placement.neumeInsertionIndex,
        ),
    )
    const undone = undoDocumentEdit(placed)
    const redone = redoDocumentEdit(undone)

    expect(undone.present).toBe(document)
    expect(redone.present).toBe(placed.present)
  })

  it('does not create history for rejected capacity placement', () => {
    const document = createDocument(
      Array.from(
        { length: singleSystemNoteCapacity },
        (_, index) => punctum(`note-${index}`),
      ),
    )
    const history = createDocumentHistory(document)
    const { bottomStaffY, staffMiddleX } = placementGeometry(document.neumes)
    const rejected = applyDocumentEdit(history, (current) => {
      const placement = getSingleSystemPunctumPlacement(
        staffMiddleX,
        bottomStaffY,
        current.neumes,
      )

      return placement
        ? insertPunctum(
            current,
            {
              id: 'neume-rejected',
              kind: 'punctum',
              lyricSyllableId: 'syllable-1',
              notes: [
                {
                  id: 'note-rejected',
                  staffPosition: placement.staffPosition,
                },
              ],
            },
            placement.neumeInsertionIndex,
          )
        : current
    })

    expect(rejected).toBe(history)
  })
})
