import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type PunctumNeume,
} from '../domain/chant-document'
import { deleteNeume } from '../commands/delete-neume'
import { moveNoteVertically } from '../commands/move-note'
import {
  firstNeumeCenterX,
  firstSystemBottomStaffY,
  firstSystemLyricBaselineY,
  layoutChant,
  measureNeumeWidth,
  noteHeight,
  staffEndX,
  systemGap,
  systemHeight,
  systemVerticalAdvance,
  wrapNeumes,
} from './layout-chant'

function punctum(id: string, syllableId = 'syllable-1'): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: syllableId,
    notes: [{ id: `note-${id}`, staffPosition: staffPosition(2) }],
  }
}

function compact(
  kind: 'podatus' | 'clivis' | 'scandicus',
  id: string,
  syllableId = 'syllable-1',
): Neume {
  if (kind === 'scandicus') {
    return {
      id: `neume-${id}`,
      kind,
      lyricSyllableId: syllableId,
      notes: [
        { id: `note-${id}-1`, staffPosition: staffPosition(2) },
        { id: `note-${id}-2`, staffPosition: staffPosition(3) },
        { id: `note-${id}-3`, staffPosition: staffPosition(4) },
      ],
    }
  }

  const positions = kind === 'podatus' ? [2, 3] : [3, 2]

  return {
    id: `neume-${id}`,
    kind,
    lyricSyllableId: syllableId,
    notes: [
      { id: `note-${id}-1`, staffPosition: staffPosition(positions[0]) },
      { id: `note-${id}-2`, staffPosition: staffPosition(positions[1]) },
    ],
  }
}

function documentWith(
  neumes: Neume[],
  syllables = [{ id: 'syllable-1', text: 'Ky-' }],
): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables,
    neumes,
  }
}

describe('multi-system chant layout', () => {
  it('returns one empty system and preserves first-system geometry', () => {
    const layout = layoutChant(documentWith([]))
    const system = layout.systems[0]

    expect(layout.systems).toHaveLength(1)
    expect(layout.height).toBe(220)
    expect(system).toMatchObject({
      index: 0,
      x: 0,
      y: 0,
      width: 720,
      height: 220,
      startNeumeIndex: 0,
      neumes: [],
      lyrics: [],
    })
    expect(system?.staffLines).toHaveLength(4)
    expect(Math.max(...(system?.staffLines.map((line) => line.y) ?? []))).toBe(
      firstSystemBottomStaffY,
    )
    expect(system?.clef.x).toBe(100)
  })

  it('preserves identity and global order exactly once across systems', () => {
    const neumes = Array.from({ length: 20 }, (_, index) =>
      punctum(String(index)),
    )
    const layout = layoutChant(documentWith(neumes))
    const flattened = layout.systems.flatMap((system) => system.neumes)

    expect(layout.systems.length).toBeGreaterThan(2)
    expect(flattened.map((neume) => neume.neumeId)).toEqual(
      neumes.map((neume) => neume.id),
    )
    expect(
      flattened.flatMap((neume) => neume.notes.map((note) => note.noteId)),
    ).toEqual(neumes.flatMap((neume) => neume.notes.map((note) => note.id)))
    expect(layout.systems.map((system) => system.startNeumeIndex)).toEqual([
      0, 9, 18,
    ])
    expect(
      layout.systems.map(
        (system) => system.startNeumeIndex + system.neumes.length,
      ),
    ).toEqual([9, 18, 20])
    expect(flattened.every((neume) => !('systemIndex' in neume))).toBe(true)
  })

  it('measures compact kinds from their complete rendered geometry', () => {
    const punctumWidth = measureNeumeWidth(punctum('punctum'))
    const podatusWidth = measureNeumeWidth(compact('podatus', 'podatus'))
    const clivisWidth = measureNeumeWidth(compact('clivis', 'clivis'))
    const scandicusWidth = measureNeumeWidth(compact('scandicus', 'scandicus'))

    expect(punctumWidth).toBe(15)
    expect(podatusWidth).toBe(27)
    expect(clivisWidth).toBe(27)
    expect(scandicusWidth).toBe(39)
    expect(scandicusWidth).toBeLessThan(punctumWidth * 3)
  })

  it('keeps exact fits and wraps the next complete neume', () => {
    const nine = Array.from({ length: 9 }, (_, index) => punctum(String(index)))
    const exactRightBound = 621.5

    expect(wrapNeumes(nine, exactRightBound)).toHaveLength(1)
    expect(
      wrapNeumes([...nine, punctum('overflow')], exactRightBound),
    ).toHaveLength(2)
    expect(wrapNeumes([...nine, punctum('overflow')])).toMatchObject([
      { startNeumeIndex: 0, neumes: nine },
      { startNeumeIndex: 9, neumes: [{ id: 'neume-overflow' }] },
    ])
  })

  it.each([
    compact('podatus', 'podatus'),
    compact('clivis', 'clivis'),
    compact('scandicus', 'scandicus'),
  ])('never splits a complete $kind', (neume) => {
    const prefix = Array.from({ length: 9 }, (_, index) =>
      punctum(String(index)),
    )
    const systems = wrapNeumes([...prefix, neume])

    expect(systems[1]?.neumes).toEqual([neume])
  })

  it('places an unexpectedly wide candidate once and terminates', () => {
    const neume = punctum('wide')

    expect(wrapNeumes([neume], firstNeumeCenterX - 1)).toEqual([
      { startNeumeIndex: 0, neumes: [neume] },
    ])
  })

  it('repeats absolute staff and clef geometry with an explicit gap', () => {
    const layout = layoutChant(
      documentWith(
        Array.from({ length: 10 }, (_, index) => punctum(String(index))),
      ),
    )
    const first = layout.systems[0]
    const second = layout.systems[1]

    expect(second?.y - (first?.y ?? 0)).toBe(systemVerticalAdvance)
    expect((second?.y ?? 0) - ((first?.y ?? 0) + systemHeight)).toBe(systemGap)
    expect(first?.staffLines.map(({ x1, x2 }) => ({ x1, x2 }))).toEqual(
      second?.staffLines.map(({ x1, x2 }) => ({ x1, x2 })),
    )
    expect(
      second?.staffLines.map(
        (line, index) => line.y - (first?.staffLines[index]?.y ?? 0),
      ),
    ).toEqual([244, 244, 244, 244])
    expect(first?.clef.staffLine).toBe(3)
    expect(second?.clef.staffLine).toBe(3)
    expect((second?.clef.y ?? 0) - (first?.clef.y ?? 0)).toBe(244)
    expect(layout.height).toBe(systemHeight + systemVerticalAdvance)
    expect((second?.y ?? 0) + (second?.height ?? 0)).toBeLessThanOrEqual(
      layout.height,
    )
  })

  it('keeps relative note, connector, bounds, and off-staff geometry', () => {
    const neumes = [
      ...Array.from({ length: 9 }, (_, index) => punctum(String(index))),
      {
        ...compact('scandicus', 'high'),
        notes: [
          { id: 'note-high-1', staffPosition: staffPosition(7) },
          { id: 'note-high-2', staffPosition: staffPosition(8) },
          { id: 'note-high-3', staffPosition: staffPosition(9) },
        ],
      } as Neume,
    ]
    const layout = layoutChant(documentWith(neumes))
    const firstPunctum = layout.systems[0]?.neumes[0]
    const high = layout.systems[1]?.neumes[0]
    const firstHighNote = high?.notes[0]
    const finalHighNote = high?.notes[2]

    expect(firstPunctum?.notes[0]?.x).toBe(222.5)
    expect(firstHighNote?.x).toBe(222.5)
    expect(high?.connectors).toHaveLength(2)
    expect(high?.bounds.y).toBeGreaterThanOrEqual(layout.systems[1]?.y ?? 0)
    expect((finalHighNote?.y ?? 0) + noteHeight).toBeLessThan(
      firstSystemLyricBaselineY + systemVerticalAdvance,
    )
  })

  it('owns a crossing melisma lyric only in the first system', () => {
    const neumes = Array.from({ length: 10 }, (_, index) =>
      punctum(String(index)),
    )
    const layout = layoutChant(documentWith(neumes))

    expect(layout.systems[0]?.lyrics).toMatchObject([
      { syllableId: 'syllable-1', x: 230, y: 180 },
    ])
    expect(layout.systems[1]?.lyrics).toEqual([])
  })

  it('anchors each syllable to the system containing its first neume', () => {
    const firstSyllable = Array.from({ length: 9 }, (_, index) =>
      punctum(String(index)),
    )
    const layout = layoutChant(
      documentWith(
        [...firstSyllable, compact('clivis', 'second', 'syllable-2')],
        [
          { id: 'syllable-1', text: 'Ky-' },
          { id: 'syllable-2', text: 'ri-' },
          { id: 'unassociated', text: 'hidden' },
        ],
      ),
    )
    const secondNeume = layout.systems[1]?.neumes[0]

    expect(layout.systems[0]?.lyrics).toHaveLength(1)
    expect(layout.systems[1]?.lyrics).toMatchObject([
      {
        syllableId: 'syllable-2',
        x: (secondNeume?.bounds.x ?? 0) + (secondNeume?.bounds.width ?? 0) / 2,
        y: firstSystemLyricBaselineY + systemVerticalAdvance,
      },
    ])
    expect(layout.systems.flatMap((system) => system.lyrics)).toHaveLength(2)
  })

  it('reflows stable IDs after deletion and not after pitch movement', () => {
    const neumes = Array.from({ length: 10 }, (_, index) =>
      punctum(String(index)),
    )
    const document = documentWith(neumes)
    const before = layoutChant(document)
    const deleted = layoutChant(deleteNeume(document, 'neume-0'))
    const moved = layoutChant(moveNoteVertically(document, 'note-0', 1))

    expect(before.systems[1]?.neumes[0]?.neumeId).toBe('neume-9')
    expect(deleted.systems).toHaveLength(1)
    expect(deleted.systems[0]?.neumes.at(-1)?.neumeId).toBe('neume-9')
    expect(
      moved.systems.map((system) =>
        system.neumes.map((neume) => neume.neumeId),
      ),
    ).toEqual(
      before.systems.map((system) =>
        system.neumes.map((neume) => neume.neumeId),
      ),
    )
  })

  it('does not render a permanent empty trailing system', () => {
    const layout = layoutChant(
      documentWith(
        Array.from({ length: 9 }, (_, index) => punctum(String(index))),
      ),
    )

    expect(layout.systems).toHaveLength(1)
    expect(layout.systems[0]?.neumes).toHaveLength(9)
    expect(layout.systems[0]?.staffLines[0]?.x2).toBe(staffEndX)
  })
})
