import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type ClivisNeume,
  type Neume,
  type PodatusNeume,
  type PunctumNeume,
  type ScandicusNeume,
} from '../domain/chant-document'
import { deleteNeume } from '../commands/delete-neume'
import { deleteNote } from '../commands/delete-note'
import { insertClivis } from '../commands/insert-clivis'
import { insertPunctum } from '../commands/insert-punctum'
import { moveNeumeVertically } from '../commands/move-neume'
import { countNotes } from '../domain/neume'
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history'
import {
  canInsertPunctumInSingleSystem,
  getNeumeBoundaryCenterX,
  layoutChant,
  singleSystemNoteCapacity,
  type NoteLayout,
} from './layout-chant'

function punctum(
  id: string,
  position: number,
  syllableId = 'syllable-1',
): PunctumNeume {
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
): PodatusNeume {
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
): ClivisNeume {
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

function scandicus(
  id: string,
  firstPosition: number,
  secondPosition: number,
  thirdPosition: number,
  syllableId = 'syllable-1',
): ScandicusNeume {
  return {
    id: `neume-${id}`,
    kind: 'scandicus',
    lyricSyllableId: syllableId,
    notes: [
      { id: `${id}-first`, staffPosition: staffPosition(firstPosition) },
      { id: `${id}-middle`, staffPosition: staffPosition(secondPosition) },
      { id: `${id}-final`, staffPosition: staffPosition(thirdPosition) },
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
    const staffLines = layout.systems[0]?.staffLines ?? []
    const note = layout.systems.flatMap((system) => system.neumes)[0]?.notes[0]

    expect(staffLines).toHaveLength(4)
    expect(note).toBeDefined()
    expect(note ? noteCenterY(note) : undefined).toBe(
      Math.max(...staffLines.map((line) => line.y)),
    )
  })

  it('moves each staff position by half a staff-line interval', () => {
    const layout = layoutChant(
      createDocument([punctum('note-1', 0), punctum('note-2', 1)]),
    )
    const lower = layout.systems.flatMap((system) => system.neumes)[0]?.notes[0]
    const upper = layout.systems.flatMap((system) => system.neumes)[1]?.notes[0]
    const staffYs = (layout.systems[0]?.staffLines ?? [])
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

    expect(layout.systems.flatMap((system) => system.neumes)[0]).toMatchObject({
      neumeId: 'neume-note-1',
      lyricSyllableId: 'syllable-1',
      kind: 'punctum',
    })
    expect(layout.systems.flatMap((system) => system.neumes)[0]?.notes[0]?.noteId).toBe('note-1')
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
    const separateNotes = separateLayout.systems.flatMap((system) => system.neumes).flatMap(
      (neume) => neume.notes,
    )
    const podatusNotes = podatusLayout.systems.flatMap((system) => system.neumes)[0]?.notes
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
    const podatusNotes = layout.systems.flatMap((system) => system.neumes)[0]?.notes
    const clivisNotes = layout.systems.flatMap((system) => system.neumes)[1]?.notes
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
    const podatusNotes = layout.systems.flatMap((system) => system.neumes)[0]?.notes
    const following = layout.systems.flatMap((system) => system.neumes)[1]?.notes[0]
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
    const punctumLayout = layout.systems.flatMap((system) => system.neumes)[0]
    const podatusLayout = layout.systems.flatMap((system) => system.neumes)[1]
    const clivisLayout = layout.systems.flatMap((system) => system.neumes)[2]

    expect(punctumLayout?.connectors).toEqual([])
    expect(punctumLayout && 'connector' in punctumLayout).toBe(false)
    for (const twoNoteLayout of [podatusLayout, clivisLayout]) {
      const first = twoNoteLayout?.notes[0]
      const second = twoNoteLayout?.notes[1]
      const connector = twoNoteLayout?.connectors[0]

      if (
        !first ||
        !second ||
        !connector ||
        twoNoteLayout.connectors.length !== 1
      ) {
        throw new Error('Missing two-note neume geometry')
      }

      expect(connector.x).toBeGreaterThanOrEqual(second.x)
      expect(connector.x).toBeLessThanOrEqual(second.x + second.width)
      expect(connector.y1).toBe(noteCenterY(first))
      expect(connector.y2).toBe(noteCenterY(second))
      expect('connector' in twoNoteLayout).toBe(false)
    }
  })

  it('lays out a Scandicus with three compact notes and two adjacent connectors', () => {
    const neumeLayout = layoutChant(
      createDocument([scandicus('scandicus', 2, 4, 7)]),
    ).systems.flatMap((system) => system.neumes)[0]
    const first = neumeLayout?.notes[0]
    const middle = neumeLayout?.notes[1]
    const final = neumeLayout?.notes[2]

    if (!neumeLayout || !first || !middle || !final) {
      throw new Error('Missing Scandicus layout')
    }

    expect(neumeLayout).toMatchObject({
      neumeId: 'neume-scandicus',
      lyricSyllableId: 'syllable-1',
      kind: 'scandicus',
    })
    expect(neumeLayout.notes.map((note) => note.noteId)).toEqual([
      'scandicus-first',
      'scandicus-middle',
      'scandicus-final',
    ])
    expect(noteCenterX(middle) - noteCenterX(first)).toBe(12)
    expect(noteCenterX(final) - noteCenterX(middle)).toBe(12)
    expect(noteCenterY(first)).toBeGreaterThan(noteCenterY(middle))
    expect(noteCenterY(middle)).toBeGreaterThan(noteCenterY(final))
    expect(neumeLayout.connectors).toHaveLength(2)
    expect(neumeLayout.connectors[0]).toMatchObject({
      y1: noteCenterY(first),
      y2: noteCenterY(middle),
    })
    expect(neumeLayout.connectors[1]).toMatchObject({
      y1: noteCenterY(middle),
      y2: noteCenterY(final),
    })
  })

  it('places a following neume after the final Scandicus note and exposes no interior boundary', () => {
    const neumes = [
      scandicus('scandicus', 2, 4, 7),
      punctum('following', 3),
    ]
    const layout = layoutChant(createDocument(neumes))
    const scandicusNotes = layout.systems.flatMap((system) => system.neumes)[0]?.notes
    const following = layout.systems.flatMap((system) => system.neumes)[1]?.notes[0]
    const final = scandicusNotes?.[2]

    if (!scandicusNotes || !following || !final) {
      throw new Error('Missing Scandicus spacing')
    }

    expect(following.x - (final.x + final.width)).toBe(33)
    expect(getNeumeBoundaryCenterX(neumes, 0)).toBe(
      noteCenterX(scandicusNotes[0]),
    )
    expect(getNeumeBoundaryCenterX(neumes, 1)).toBe(noteCenterX(following))
    expect(getNeumeBoundaryCenterX(neumes, 2)).not.toBeNull()
  })

  it('places a following neume after compact Clivis width and the normal gap', () => {
    const layout = layoutChant(
      createDocument([
        clivis('clivis', 4, 2),
        punctum('following', 3),
      ]),
    )
    const clivisNotes = layout.systems.flatMap((system) => system.neumes)[0]?.notes
    const following = layout.systems.flatMap((system) => system.neumes)[1]?.notes[0]
    const upper = clivisNotes?.[0]
    const lower = clivisNotes?.[1]

    if (!upper || !lower || !following) {
      throw new Error('Missing Clivis layout')
    }

    const normalInterNeumeGap = 48 - upper.width

    expect(following.x - (lower.x + lower.width)).toBe(normalInterNeumeGap)
    expect(noteCenterX(following) - noteCenterX(upper)).toBeLessThan(96)
  })

  it('aligns a Punctum lyric to its sole note center', () => {
    const layout = layoutChant(
      createDocument([punctum('punctum', 2)]),
    )
    const note = layout.systems.flatMap((system) => system.neumes)[0]?.notes[0]

    if (!note) {
      throw new Error('Missing Punctum note layout')
    }

    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(noteCenterX(note))
  })

  it('uses only the first Punctum for several neumes on one syllable', () => {
    const layout = layoutChant(
      createDocument([
        punctum('note-1', 2),
        punctum('note-2', 3),
        punctum('note-3', 4),
      ]),
    )
    const notes = layout.systems.flatMap((system) => system.neumes).flatMap((neume) => neume.notes)
    const lyric = layout.systems.flatMap((system) => system.lyrics)[0]
    const firstNote = notes[0]
    const lastNote = notes[2]

    expect(layout.systems.flatMap((system) => system.lyrics)).toHaveLength(1)
    if (!firstNote || !lastNote) {
      throw new Error('Missing note layout')
    }

    expect(lyric?.x).toBe(noteCenterX(firstNote))
    expect(lyric?.x).not.toBe(noteCenterX(lastNote))
  })

  it('aligns a first Podatus to its first lower note only', () => {
    const layout = layoutChant(
      createDocument([
        podatus('podatus', 2, 3),
        clivis('following-clivis', 4, 2),
        punctum('following-punctum', 4),
      ]),
    )
    const podatusLayout = layout.systems.flatMap((system) => system.neumes)[0]
    const firstNote = podatusLayout?.notes[0]
    const secondNote = podatusLayout?.notes[1]

    if (!podatusLayout || !firstNote || !secondNote) {
      throw new Error('Missing Podatus layout')
    }

    const boundsCenter =
      podatusLayout.bounds.x + podatusLayout.bounds.width / 2

    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(noteCenterX(firstNote))
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).not.toBe(noteCenterX(secondNote))
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).not.toBe(boundsCenter)
  })

  it('aligns a first Scandicus lyric to its first note only', () => {
    const layout = layoutChant(
      createDocument([
        scandicus('scandicus', 2, 4, 7),
        punctum('later', 3),
      ]),
    )
    const neumeLayout = layout.systems.flatMap((system) => system.neumes)[0]
    const first = neumeLayout?.notes[0]
    const middle = neumeLayout?.notes[1]
    const final = neumeLayout?.notes[2]

    if (!neumeLayout || !first || !middle || !final) {
      throw new Error('Missing Scandicus lyric layout')
    }

    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(noteCenterX(first))
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).not.toBe(noteCenterX(middle))
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).not.toBe(noteCenterX(final))
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).not.toBe(
      neumeLayout.bounds.x + neumeLayout.bounds.width / 2,
    )
  })

  it('aligns a first Clivis to its complete raw bounds center', () => {
    const layout = layoutChant(
      createDocument([
        clivis('clivis', 4, 3),
        podatus('following-podatus', 2, 4),
        punctum('following-punctum', 2),
      ]),
    )
    const clivisLayout = layout.systems.flatMap((system) => system.neumes)[0]
    const firstNote = clivisLayout?.notes[0]
    const secondNote = clivisLayout?.notes[1]

    if (!clivisLayout || !firstNote || !secondNote) {
      throw new Error('Missing Clivis layout')
    }

    const boundsCenter =
      clivisLayout.bounds.x + clivisLayout.bounds.width / 2
    const noteMidpoint =
      (noteCenterX(firstNote) + noteCenterX(secondNote)) / 2

    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(boundsCenter)
    expect(boundsCenter).toBe(noteMidpoint)
  })

  it('does not move a lyric when a later neume is appended, moved vertically, or deleted', () => {
    const initial = createDocument([
      punctum('first', 2),
      podatus('later', 3, 5),
    ])
    const appended = {
      ...initial,
      neumes: [...initial.neumes, clivis('appended', 5, 3)],
    }
    const moved = moveNeumeVertically(
      appended,
      'neume-later',
      1,
    )
    const deleted = deleteNeume(moved, 'neume-appended')
    const lyricXs = [initial, appended, moved, deleted].map(
      (document) => layoutChant(document).systems.flatMap((system) => system.lyrics)[0]?.x,
    )

    expect(new Set(lyricXs).size).toBe(1)
  })

  it('reanchors after inserting before or deleting the first neume', () => {
    const initial = createDocument([
      podatus('old-first', 2, 4),
      clivis('next', 5, 3),
    ])
    const inserted = insertPunctum(
      initial,
      punctum('inserted-first', 3),
      0,
    )
    const afterFirstDeletion = deleteNeume(initial, 'neume-old-first')
    const insertedNote = layoutChant(inserted).systems.flatMap((system) => system.neumes)[0]?.notes[0]
    const nextNeume = layoutChant(afterFirstDeletion).systems.flatMap((system) => system.neumes)[0]

    if (!insertedNote || !nextNeume) {
      throw new Error('Missing reanchored layout')
    }

    expect(layoutChant(inserted).systems.flatMap((system) => system.lyrics)[0]?.x).toBe(
      noteCenterX(insertedNote),
    )
    expect(layoutChant(afterFirstDeletion).systems.flatMap((system) => system.lyrics)[0]?.x).toBe(
      nextNeume.bounds.x + nextNeume.bounds.width / 2,
    )
  })

  it('derives insertion anchors again through undo and redo', () => {
    const initial = createDocument([
      podatus('old-first', 2, 4),
      punctum('later', 3),
    ])
    const initialAnchor = layoutChant(initial).systems.flatMap((system) => system.lyrics)[0]?.x
    const insertedHistory = applyDocumentEdit(
      createDocumentHistory(initial),
      (document) =>
        insertClivis(document, clivis('new-first', 5, 3), 0),
    )
    const insertedAnchor = layoutChant(insertedHistory.present).systems.flatMap((system) => system.lyrics)[0]?.x
    const undone = undoDocumentEdit(insertedHistory)
    const redone = redoDocumentEdit(undone)

    expect(insertedAnchor).not.toBe(initialAnchor)
    expect(layoutChant(undone.present).systems.flatMap((system) => system.lyrics)[0]?.x).toBe(initialAnchor)
    expect(layoutChant(redone.present).systems.flatMap((system) => system.lyrics)[0]?.x).toBe(insertedAnchor)
  })

  it.each([
    {
      kind: 'Podatus',
      neume: podatus('first', 2, 4),
      deletedNoteId: 'first-lower',
      survivingNoteId: 'first-upper',
    },
    {
      kind: 'Podatus',
      neume: podatus('first', 2, 4),
      deletedNoteId: 'first-upper',
      survivingNoteId: 'first-lower',
    },
    {
      kind: 'Clivis',
      neume: clivis('first', 5, 3),
      deletedNoteId: 'first-upper',
      survivingNoteId: 'first-lower',
    },
    {
      kind: 'Clivis',
      neume: clivis('first', 5, 3),
      deletedNoteId: 'first-lower',
      survivingNoteId: 'first-upper',
    },
  ])(
    'aligns normalized first $kind to surviving $survivingNoteId',
    ({ neume, deletedNoteId, survivingNoteId }) => {
      const normalized = deleteNote(
        createDocument([neume, punctum('later', 4)]),
        deletedNoteId,
      )
      const layout = layoutChant(normalized)
      const firstNeume = layout.systems.flatMap((system) => system.neumes)[0]
      const survivor = firstNeume?.notes[0]

      if (!survivor) {
        throw new Error('Missing normalized survivor layout')
      }

      expect(firstNeume?.kind).toBe('punctum')
      expect(survivor.noteId).toBe(survivingNoteId)
      expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(noteCenterX(survivor))
    },
  )

  it('omits the lyric after removing the final neume but preserves its semantic syllable', () => {
    const document = createDocument([punctum('only', 2)])
    const deleted = deleteNeume(document, 'neume-only')

    expect(layoutChant(deleted).systems.flatMap((system) => system.lyrics)).toEqual([])
    expect(deleted.syllables).toBe(document.syllables)
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
      layoutChant(document).systems.flatMap((system) => system.lyrics).map((lyric) => lyric.syllableId),
    ).toEqual(['syllable-1', 'syllable-3'])
  })

  it('preserves associated empty and unusual text without filtering', () => {
    const document: ChantDocument = {
      ...createDocument([]),
      syllables: [
        { id: 'syllable-empty', text: '' },
        { id: 'syllable-punctuation', text: '—' },
        { id: 'syllable-whitespace', text: ' ' },
        { id: 'syllable-unassociated', text: 'hidden' },
      ],
      neumes: [
        punctum('empty', 2, 'syllable-empty'),
        punctum('punctuation', 3, 'syllable-punctuation'),
        punctum('whitespace', 4, 'syllable-whitespace'),
      ],
    }
    const lyrics = layoutChant(document).systems.flatMap((system) => system.lyrics)

    expect(lyrics.map(({ syllableId, text }) => ({ syllableId, text })))
      .toEqual([
        { syllableId: 'syllable-empty', text: '' },
        { syllableId: 'syllable-punctuation', text: '—' },
        { syllableId: 'syllable-whitespace', text: ' ' },
      ])
    expect(document.syllables.at(-1)?.id).toBe('syllable-unassociated')
  })

  it('uses each syllable first match and preserves semantic syllable order for interleaved neumes', () => {
    const document: ChantDocument = {
      ...createDocument([]),
      syllables: [
        { id: 'syllable-1', text: 'Ky-' },
        { id: 'syllable-empty', text: '' },
        { id: 'syllable-2', text: 'ri-' },
      ],
      neumes: [
        punctum('syllable-2-first', 3, 'syllable-2'),
        podatus('syllable-1-first', 2, 4, 'syllable-1'),
        clivis('syllable-2-later', 5, 3, 'syllable-2'),
        punctum('syllable-1-later', 4, 'syllable-1'),
      ],
    }
    const layout = layoutChant(document)
    const firstSyllableNeume = layout.systems.flatMap((system) => system.neumes)[1]
    const secondSyllableNeume = layout.systems.flatMap((system) => system.neumes)[0]
    const firstSyllableNote = firstSyllableNeume?.notes[0]
    const secondSyllableNote = secondSyllableNeume?.notes[0]

    if (!firstSyllableNote || !secondSyllableNote) {
      throw new Error('Missing multiple-syllable geometry')
    }

    expect(layout.systems.flatMap((system) => system.lyrics).map((lyric) => lyric.syllableId)).toEqual([
      'syllable-1',
      'syllable-2',
    ])
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(noteCenterX(firstSyllableNote))
    expect(layout.systems.flatMap((system) => system.lyrics)[1]?.x).toBe(noteCenterX(secondSyllableNote))
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
    const first = layout.systems.flatMap((system) => system.neumes)[0]?.notes[0]
    const second = layout.systems.flatMap((system) => system.neumes)[1]?.notes[0]

    if (!first || !second) {
      throw new Error('Missing punctum layout')
    }

    expect(noteCenterX(second) - noteCenterX(first)).toBe(48)
  })

  it('preserves nested Podatus neume and note identities', () => {
    const layout = layoutChant(
      createDocument([podatus('stable', 2, 3)]),
    )

    expect(layout.systems.flatMap((system) => system.neumes)[0]).toMatchObject({
      neumeId: 'neume-stable',
      lyricSyllableId: 'syllable-1',
      kind: 'podatus',
    })
    expect(layout.systems.flatMap((system) => system.neumes)[0]?.notes.map((note) => note.noteId)).toEqual([
      'stable-lower',
      'stable-upper',
    ])
  })

  it('fits the old capacity on one system and wraps the next note', () => {
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
    const staffEndX = atCapacity.systems[0]?.staffLines[0]?.x2
    const finalAtCapacity = atCapacity.systems[0]?.neumes.at(-1)?.notes[0]
    const finalOverflow = overflow.systems[1]?.neumes[0]?.notes[0]

    expect(atCapacity.systems).toHaveLength(1)
    expect(overflow.systems).toHaveLength(2)
    expect(finalAtCapacity && staffEndX !== undefined
      ? finalAtCapacity.x + finalAtCapacity.width
      : undefined).toBeLessThanOrEqual(staffEndX ?? 0)
    expect(finalOverflow && staffEndX !== undefined
      ? finalOverflow.x + finalOverflow.width
      : undefined).toBeLessThanOrEqual(staffEndX ?? 0)
  })

  it.each([
    { neume: punctum('punctum-bounds', 3), kind: 'punctum' },
    { neume: podatus('podatus-bounds', 2, 4), kind: 'podatus' },
    { neume: clivis('clivis-bounds', 5, 3), kind: 'clivis' },
    {
      neume: scandicus('scandicus-bounds', 2, 4, 7),
      kind: 'scandicus',
    },
  ])('$kind bounds contain every constituent note', ({ neume }) => {
    const neumeLayout = layoutChant(createDocument([neume])).systems.flatMap((system) => system.neumes)[0]

    if (!neumeLayout) {
      throw new Error('Missing neume layout')
    }

    for (const note of neumeLayout.notes) {
      expect(neumeLayout.bounds.x).toBeLessThanOrEqual(note.x)
      expect(neumeLayout.bounds.y).toBeLessThanOrEqual(note.y)
      expect(
        neumeLayout.bounds.x + neumeLayout.bounds.width,
      ).toBeGreaterThanOrEqual(note.x + note.width)
      expect(
        neumeLayout.bounds.y + neumeLayout.bounds.height,
      ).toBeGreaterThanOrEqual(note.y + note.height)
    }
  })

  it.each([
    podatus('podatus-connector-bounds', 2, 6),
    clivis('clivis-connector-bounds', 6, 2),
    scandicus('scandicus-connector-bounds', 1, 4, 7),
  ])('includes the $kind connector painted extent in bounds', (neume) => {
    const neumeLayout = layoutChant(createDocument([neume])).systems.flatMap((system) => system.neumes)[0]

    if (!neumeLayout || neumeLayout.connectors.length === 0) {
      throw new Error('Missing connector layout')
    }

    for (const connector of neumeLayout.connectors) {
      expect(neumeLayout.bounds.x).toBeLessThanOrEqual(connector.x - 1.5)
      expect(
        neumeLayout.bounds.x + neumeLayout.bounds.width,
      ).toBeGreaterThanOrEqual(connector.x + 1.5)
      expect(neumeLayout.bounds.y).toBeLessThanOrEqual(
        Math.min(connector.y1, connector.y2) - 1.5,
      )
      expect(
        neumeLayout.bounds.y + neumeLayout.bounds.height,
      ).toBeGreaterThanOrEqual(
        Math.max(connector.y1, connector.y2) + 1.5,
      )
    }
  })

  it('preserves score, note, and spacing geometry while using the first Podatus anchor', () => {
    const layout = layoutChant(
      createDocument([
        podatus('podatus-invariant', 2, 4),
        punctum('punctum-invariant', 3),
      ]),
    )
    const firstNotes = layout.systems.flatMap((system) => system.neumes)[0]?.notes
    const following = layout.systems.flatMap((system) => system.neumes)[1]?.notes[0]

    if (!firstNotes || !following) {
      throw new Error('Missing invariant layout')
    }

    expect(layout.width).toBe(720)
    expect(layout.height).toBe(220)
    expect(firstNotes.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 222.5, y: 94.5 },
      { x: 234.5, y: 70.5 },
    ])
    expect(following.x).toBe(282.5)
    expect(layout.systems.flatMap((system) => system.lyrics)[0]).toMatchObject({
      x: 230,
      y: 180,
      fontSize: 20,
    })
  })

  it('adds geometry only without inventing IDs or selection state', () => {
    const neumeLayout = layoutChant(
      createDocument([podatus('identity-bounds', 2, 4)]),
    ).systems.flatMap((system) => system.neumes)[0]

    expect(neumeLayout).toMatchObject({
      neumeId: 'neume-identity-bounds',
      kind: 'podatus',
      notes: [
        { noteId: 'identity-bounds-lower' },
        { noteId: 'identity-bounds-upper' },
      ],
    })
    expect(Object.keys(neumeLayout?.bounds ?? {})).toEqual([
      'x',
      'y',
      'width',
      'height',
    ])
    expect(neumeLayout).not.toHaveProperty('selection')
    expect(neumeLayout).not.toHaveProperty('selected')
  })
})
