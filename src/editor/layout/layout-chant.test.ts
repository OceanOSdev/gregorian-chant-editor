import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document'
import { countNotes } from '../domain/neume'
import {
  canInsertPunctumInSingleSystem,
  layoutChant,
  singleSystemNoteCapacity,
  type NoteLayout,
} from './layout-chant'

function punctum(id: string, position: number, syllableId = 'syllable-1'): Neume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: syllableId,
    notes: [{ id, staffPosition: staffPosition(position) }],
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

function noteCenterY(note: NoteLayout) {
  return note.y + note.height / 2
}

function noteCenterX(note: NoteLayout) {
  return note.x + note.width / 2
}

describe('layoutChant', () => {
  it('produces four staff lines and places staff position zero on the bottom line', () => {
    const layout = layoutChant(createDocument([punctum('note-1', 0)]))
    const note = layout.neumes[0]?.notes[0]

    expect(layout.staffLines).toHaveLength(4)
    expect(note).toBeDefined()
    expect(note ? noteCenterY(note) : undefined).toBe(
      Math.max(...layout.staffLines.map((line) => line.y)),
    )
  })

  it('moves each staff position by half a staff-line interval', () => {
    const layout = layoutChant(
      createDocument([punctum('note-1', 0), punctum('note-2', 1)]),
    )
    const lower = layout.neumes[0]?.notes[0]
    const upper = layout.neumes[1]?.notes[0]
    const staffYs = layout.staffLines
      .map((line) => line.y)
      .sort((first, second) => first - second)

    if (!lower || !upper || staffYs[0] === undefined || staffYs[1] === undefined) {
      throw new Error('Missing layout geometry')
    }

    expect(noteCenterY(lower) - noteCenterY(upper)).toBe(
      (staffYs[1] - staffYs[0]) / 2,
    )
  })

  it('preserves neume and note identity in nested layout data', () => {
    const layout = layoutChant(createDocument([punctum('note-1', 2)]))

    expect(layout.neumes[0]).toMatchObject({
      neumeId: 'neume-note-1',
      lyricSyllableId: 'syllable-1',
      kind: 'punctum',
    })
    expect(layout.neumes[0]?.notes[0]?.noteId).toBe('note-1')
  })

  it('lays out every multi-note neume note in the existing fixed slots', () => {
    const podatus: Neume = {
      id: 'neume-podatus',
      kind: 'podatus',
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'note-1', staffPosition: staffPosition(2) },
        { id: 'note-2', staffPosition: staffPosition(4) },
      ],
    }
    const layout = layoutChant(
      createDocument([podatus, punctum('note-3', 3)]),
    )
    const notes = layout.neumes.flatMap((neume) => neume.notes)
    const [firstNote, secondNote, thirdNote] = notes

    expect(notes).toHaveLength(3)
    if (!firstNote || !secondNote || !thirdNote) {
      throw new Error('Missing note layout')
    }

    expect(noteCenterX(secondNote) - noteCenterX(firstNote)).toBe(
      noteCenterX(thirdNote) - noteCenterX(secondNote),
    )
  })

  it('centers one lyric across notes in multiple associated neumes', () => {
    const layout = layoutChant(
      createDocument([
        punctum('note-1', 2),
        punctum('note-2', 3),
        punctum('note-3', 4),
      ]),
    )
    const notes = layout.neumes.flatMap((neume) => neume.notes)
    const lyric = layout.lyrics[0]
    const firstNote = notes[0]
    const lastNote = notes[2]

    expect(layout.lyrics).toHaveLength(1)
    if (!firstNote || !lastNote) {
      throw new Error('Missing note layout')
    }

    expect(lyric?.x).toBe(
      (noteCenterX(firstNote) + noteCenterX(lastNote)) / 2,
    )
  })

  it('renders associated syllables once and omits syllables without notes', () => {
    const document: ChantDocument = {
      ...createDocument([]),
      syllables: [
        { id: 'syllable-1', text: 'Ky-' },
        { id: 'syllable-2', text: '' },
        { id: 'syllable-3', text: 'ri-' },
      ],
      neumes: [
        punctum('note-1', 2),
        punctum('note-2', 3),
        punctum('note-3', 4, 'syllable-3'),
      ],
    }

    expect(
      layoutChant(document).lyrics.map((lyric) => lyric.syllableId),
    ).toEqual(['syllable-1', 'syllable-3'])
  })

  it('bases fixed-system capacity on total nested notes', () => {
    const podatus: Neume = {
      id: 'neume-podatus',
      kind: 'podatus',
      lyricSyllableId: 'syllable-1',
      notes: [
        { id: 'note-1', staffPosition: staffPosition(2) },
        { id: 'note-2', staffPosition: staffPosition(4) },
      ],
    }
    const puncta = Array.from(
      { length: singleSystemNoteCapacity - 2 },
      (_, index) => punctum(`note-${index + 3}`, 3),
    )
    const neumes = [podatus, ...puncta]

    expect(countNotes(neumes)).toBe(singleSystemNoteCapacity)
    expect(canInsertPunctumInSingleSystem(countNotes(neumes))).toBe(false)
    expect(
      canInsertPunctumInSingleSystem(countNotes(neumes.slice(0, -1))),
    ).toBe(true)
  })

  it('fits the maximum rendered-note count and overflows one beyond it', () => {
    const atCapacity = layoutChant(
      createDocument(
        Array.from({ length: singleSystemNoteCapacity }, (_, index) =>
          punctum(`note-${index}`, 3),
        ),
      ),
    )
    const overflow = layoutChant(
      createDocument(
        Array.from({ length: singleSystemNoteCapacity + 1 }, (_, index) =>
          punctum(`note-${index}`, 3),
        ),
      ),
    )
    const staffEndX = atCapacity.staffLines[0]?.x2
    const finalAtCapacity = atCapacity.neumes.at(-1)?.notes[0]
    const finalOverflow = overflow.neumes.at(-1)?.notes[0]

    expect(finalAtCapacity && staffEndX !== undefined
      ? finalAtCapacity.x + finalAtCapacity.width
      : undefined).toBeLessThanOrEqual(staffEndX ?? 0)
    expect(finalOverflow && staffEndX !== undefined
      ? finalOverflow.x + finalOverflow.width
      : undefined).toBeGreaterThan(staffEndX ?? 0)
  })
})
