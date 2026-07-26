import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document'
import { layoutChant, type GraphicalNeumeKind } from '../layout/layout-chant'
import { resolveGraphicalNeumePlacement } from './resolve-graphical-neume-placement'

function punctum(id: string, syllableId = 'syllable-1'): Neume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    lyricSyllableId: syllableId,
    notes: [{ id: `note-${id}`, staffPosition: staffPosition(2) }],
  }
}

function documentWith(neumes: Neume[] = []): ChantDocument {
  return {
    title: 'Test',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'empty-first', text: '' },
      { id: 'syllable-1', text: 'Ky-' },
      { id: 'empty-middle', text: '' },
      { id: 'syllable-2', text: 'ri-' },
      { id: 'empty-final', text: '' },
    ],
    neumes,
  }
}

function resolveOn(
  document: ChantDocument,
  systemIndex: number,
  syllableId: string | null,
  kind: GraphicalNeumeKind = 'punctum',
  x = 300,
) {
  const layout = layoutChant(document)
  const system = layout.systems[systemIndex]
  const bottom = system
    ? Math.max(...system.staffLines.map((line) => line.y))
    : undefined

  if (!system || bottom === undefined) {
    throw new Error('Missing system')
  }

  return resolveGraphicalNeumePlacement(document, layout, syllableId, kind, {
    x,
    y: bottom - 24,
  })
}

describe('resolveGraphicalNeumePlacement', () => {
  it.each([
    ['punctum', [2]],
    ['podatus', [2, 3]],
    ['clivis', [2, 1]],
    ['scandicus', [2, 3, 4]],
  ] as const)('returns a coupled %s result and preview', (kind, positions) => {
    const result = resolveOn(documentWith(), 0, 'empty-first', kind)

    expect(result).toMatchObject({
      kind,
      staffPositions: positions,
      insertionIndex: 0,
      preview: { kind },
    })
  })

  it('hits first, middle, and final systems and rejects gaps/outside', () => {
    const document = documentWith(
      Array.from({ length: 30 }, (_, index) => punctum(`${index}`)),
    )
    const layout = layoutChant(document)

    expect(layout.systems.length).toBeGreaterThan(2)
    expect(resolveOn(document, 0, 'syllable-1')).not.toBeNull()
    expect(resolveOn(document, 1, 'syllable-1')).not.toBeNull()
    expect(
      resolveOn(document, layout.systems.length - 1, 'syllable-1'),
    ).not.toBeNull()

    const first = layout.systems[0]
    const second = layout.systems[1]

    if (!first || !second) {
      throw new Error('Missing systems')
    }

    expect(
      resolveGraphicalNeumePlacement(
        document,
        layout,
        'syllable-1',
        'punctum',
        { x: 300, y: (first.y + first.height + second.y) / 2 },
      ),
    ).toBeNull()
    expect(
      resolveGraphicalNeumePlacement(
        document,
        layout,
        'syllable-1',
        'punctum',
        { x: 300, y: -1 },
      ),
    ).toBeNull()
    expect(
      resolveGraphicalNeumePlacement(
        document,
        layout,
        'syllable-1',
        'punctum',
        { x: 300, y: layout.height + 1 },
      ),
    ).toBeNull()
  })

  it('rejects null and unknown syllables and clamps empty groups', () => {
    const document = documentWith([
      punctum('one', 'syllable-1'),
      punctum('two', 'syllable-2'),
    ])

    expect(resolveOn(document, 0, null)).toBeNull()
    expect(resolveOn(document, 0, 'unknown')).toBeNull()
    expect(
      resolveOn(document, 0, 'empty-first', 'punctum', 656)?.insertionIndex,
    ).toBe(0)
    expect(
      resolveOn(document, 0, 'empty-middle', 'punctum', 656)?.insertionIndex,
    ).toBe(1)
    expect(
      resolveOn(document, 0, 'empty-final', 'punctum', 64)?.insertionIndex,
    ).toBe(2)
  })

  it('clamps across systems and previews the actual destination', () => {
    const neumes = [
      ...Array.from({ length: 11 }, (_, index) =>
        punctum(`first-${index}`, 'syllable-1'),
      ),
      ...Array.from({ length: 11 }, (_, index) =>
        punctum(`second-${index}`, 'syllable-2'),
      ),
    ]
    const document = documentWith(neumes)
    const layout = layoutChant(document)
    const result = resolveOn(
      document,
      layout.systems.length - 1,
      'syllable-1',
      'punctum',
      656,
    )
    const destination = layoutChant({
      ...document,
      neumes: [
        ...document.neumes.slice(0, result?.insertionIndex),
        punctum('candidate', 'syllable-1'),
        ...document.neumes.slice(result?.insertionIndex),
      ],
    })
      .systems.flatMap((system) => system.neumes)
      .find((neume) => neume.neumeId === 'neume-candidate')

    expect(result?.insertionIndex).toBe(11)
    expect(result?.preview.notes).toEqual(
      destination?.notes.map(({ noteId: _noteId, ...note }) => note),
    )
  })

  it('keeps resolving long documents without a global capacity', () => {
    const document = documentWith(
      Array.from({ length: 100 }, (_, index) => punctum(`${index}`)),
    )
    const finalIndex = layoutChant(document).systems.length - 1

    for (const kind of ['punctum', 'podatus', 'clivis', 'scandicus'] as const) {
      expect(
        resolveOn(document, finalIndex, 'syllable-1', kind, 656),
      ).not.toBeNull()
    }
  })
})
