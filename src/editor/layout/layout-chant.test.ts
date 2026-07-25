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

function podatus(
  id: string,
  lowerPosition: number,
  upperPosition: number,
  syllableId = 'syllable-1',
): Neume {
  return {
    id: `neume-${id}`,
    kind: 'podatus',
    lyricSyllableId: syllableId,
    notes: [
      {
        id: `${id}-lower`,
        staffPosition: staffPosition(lowerPosition),
      },
      {
        id: `${id}-upper`,
        staffPosition: staffPosition(upperPosition),
      },
    ],
  }
}

function clivis(
  id: string,
  upperPosition: number,
  lowerPosition: number,
  syllableId = 'syllable-1',
): Neume {
  return {
    id: `neume-${id}`,
    kind: 'clivis',
    lyricSyllableId: syllableId,
    notes: [
      {
        id: `${id}-upper`,
        staffPosition: staffPosition(upperPosition),
      },
      {
        id: `${id}-lower`,
        staffPosition: staffPosition(lowerPosition),
      },
    ],
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

  it('places Podatus notes closer than notes in separate neumes', () => {
    const separateLayout = layoutChant(
      createDocument([
        punctum('separate-1', 2),
        punctum('separate-2', 4),
      ]),
    )
    const podatusLayout = layoutChant(
      createDocument([podatus('podatus', 2, 4)]),
    )
    const separateNotes = separateLayout.neumes.flatMap(
      (neume) => neume.notes,
    )
    const podatusNotes = podatusLayout.neumes[0]?.notes
    const separateFirst = separateNotes[0]
    const separateSecond = separateNotes[1]
    const lower = podatusNotes?.[0]
    const upper = podatusNotes?.[1]

    if (!separateFirst || !separateSecond || !lower || !upper) {
      throw new Error('Missing note layout')
    }

    expect(noteCenterX(upper) - noteCenterX(lower)).toBeLessThan(
      noteCenterX(separateSecond) - noteCenterX(separateFirst),
    )
  })

  it('uses compact spacing and the expected visual contour for both two-note kinds', () => {
    const layout = layoutChant(
      createDocument([
        podatus('podatus', 2, 4),
        clivis('clivis', 5, 3),
      ]),
    )
    const podatusNotes = layout.neumes[0]?.notes
    const clivisNotes = layout.neumes[1]?.notes
    const podatusFirst = podatusNotes?.[0]
    const podatusSecond = podatusNotes?.[1]
    const clivisFirst = clivisNotes?.[0]
    const clivisSecond = clivisNotes?.[1]

    if (!podatusFirst || !podatusSecond || !clivisFirst || !clivisSecond) {
      throw new Error('Missing two-note neume layout')
    }

    expect(noteCenterX(podatusSecond) - noteCenterX(podatusFirst)).toBe(12)
    expect(noteCenterX(clivisSecond) - noteCenterX(clivisFirst)).toBe(12)
    expect(noteCenterY(podatusSecond)).toBeLessThan(
      noteCenterY(podatusFirst),
    )
    expect(noteCenterY(clivisFirst)).toBeLessThan(noteCenterY(clivisSecond))
  })

  it('places the following neume after the compact rendered width and normal gap', () => {
    const layout = layoutChant(
      createDocument([
        podatus('podatus', 2, 4),
        punctum('following', 3),
      ]),
    )
    const podatusNotes = layout.neumes[0]?.notes
    const following = layout.neumes[1]?.notes[0]
    const lower = podatusNotes?.[0]
    const upper = podatusNotes?.[1]

    if (!lower || !upper || !following) {
      throw new Error('Missing note layout')
    }

    const normalInterNeumeGap = 48 - lower.width

    expect(following.x - (upper.x + upper.width)).toBe(normalInterNeumeGap)
    expect(following.x).toBeGreaterThanOrEqual(upper.x + upper.width)
    expect(noteCenterX(following) - noteCenterX(lower)).toBeLessThan(96)
  })

  it('provides aligned connector geometry for both two-note kinds', () => {
    const layout = layoutChant(
      createDocument([
        punctum('punctum', 3),
        podatus('podatus', 2, 4),
        clivis('clivis', 5, 3),
      ]),
    )
    const punctumLayout = layout.neumes[0]
    const podatusLayout = layout.neumes[1]
    const clivisLayout = layout.neumes[2]

    expect(punctumLayout?.connector).toBeUndefined()
    for (const twoNoteLayout of [podatusLayout, clivisLayout]) {
      const first = twoNoteLayout?.notes[0]
      const second = twoNoteLayout?.notes[1]
      const connector = twoNoteLayout?.connector

      if (!first || !second || !connector) {
        throw new Error('Missing two-note neume geometry')
      }

      expect(connector.x).toBeGreaterThanOrEqual(second.x)
      expect(connector.x).toBeLessThanOrEqual(second.x + second.width)
      expect(connector.y1).toBe(noteCenterY(first))
      expect(connector.y2).toBe(noteCenterY(second))
    }
  })

  it('places a following neume after compact Clivis width and the normal gap', () => {
    const layout = layoutChant(
      createDocument([
        clivis('clivis', 4, 2),
        punctum('following', 3),
      ]),
    )
    const clivisNotes = layout.neumes[0]?.notes
    const following = layout.neumes[1]?.notes[0]
    const upper = clivisNotes?.[0]
    const lower = clivisNotes?.[1]

    if (!upper || !lower || !following) {
      throw new Error('Missing Clivis layout')
    }

    const normalInterNeumeGap = 48 - upper.width

    expect(following.x - (lower.x + lower.width)).toBe(normalInterNeumeGap)
    expect(noteCenterX(following) - noteCenterX(upper)).toBeLessThan(96)
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

  it('centers lyrics using compact Podatus note centers', () => {
    const layout = layoutChant(
      createDocument([
        podatus('podatus', 2, 3),
        punctum('following', 4),
      ]),
    )
    const notes = layout.neumes.flatMap((neume) => neume.notes)
    const firstNote = notes[0]
    const lastNote = notes.at(-1)

    if (!firstNote || !lastNote) {
      throw new Error('Missing note layout')
    }

    expect(layout.lyrics[0]?.x).toBe(
      (noteCenterX(firstNote) + noteCenterX(lastNote)) / 2,
    )
  })

  it('centers lyrics using actual compact Clivis note centers', () => {
    const layout = layoutChant(
      createDocument([
        clivis('clivis', 4, 3),
        punctum('following', 2),
      ]),
    )
    const notes = layout.neumes.flatMap((neume) => neume.notes)
    const firstNote = notes[0]
    const lastNote = notes.at(-1)

    if (!firstNote || !lastNote) {
      throw new Error('Missing note layout')
    }

    expect(layout.lyrics[0]?.x).toBe(
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
    const puncta = Array.from(
      { length: singleSystemNoteCapacity - 2 },
      (_, index) => punctum(`note-${index + 3}`, 3),
    )
    const neumes = [podatus('podatus', 2, 4), ...puncta]

    expect(countNotes(neumes)).toBe(singleSystemNoteCapacity)
    expect(canInsertPunctumInSingleSystem(countNotes(neumes))).toBe(false)
    expect(
      canInsertPunctumInSingleSystem(countNotes(neumes.slice(0, -1))),
    ).toBe(true)
  })

  it('counts compact Clivis notes as two capacity units', () => {
    const puncta = Array.from(
      { length: singleSystemNoteCapacity - 2 },
      (_, index) => punctum(`note-${index + 3}`, 3),
    )
    const neumes = [clivis('clivis', 4, 3), ...puncta]

    expect(countNotes(neumes)).toBe(singleSystemNoteCapacity)
    expect(canInsertPunctumInSingleSystem(countNotes(neumes))).toBe(false)
  })

  it('preserves ordinary spacing between separate puncta', () => {
    const layout = layoutChant(
      createDocument([
        punctum('first', 2),
        punctum('second', 3),
      ]),
    )
    const first = layout.neumes[0]?.notes[0]
    const second = layout.neumes[1]?.notes[0]

    if (!first || !second) {
      throw new Error('Missing punctum layout')
    }

    expect(noteCenterX(second) - noteCenterX(first)).toBe(48)
  })

  it('preserves nested Podatus neume and note identities', () => {
    const layout = layoutChant(
      createDocument([podatus('stable', 2, 3)]),
    )

    expect(layout.neumes[0]).toMatchObject({
      neumeId: 'neume-stable',
      lyricSyllableId: 'syllable-1',
      kind: 'podatus',
    })
    expect(layout.neumes[0]?.notes.map((note) => note.noteId)).toEqual([
      'stable-lower',
      'stable-upper',
    ])
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
