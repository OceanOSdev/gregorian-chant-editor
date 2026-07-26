import { describe, expect, it } from 'vitest'
import {
  staffPosition,
  type ChantDocument,
} from '../domain/chant-document'
import { layoutChant } from '../layout/layout-chant'
import {
  placePunctumTool,
  selectTool,
} from '../state/editor-tool'
import {
  canUseGraphicalPlacement,
  getSurvivingFocusNoteId,
  shouldCancelGraphicalPlacement,
} from './multi-system-editing'

function documentWith(count: number): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: [{ id: 'syllable-1', text: 'Ky-' }],
    neumes: Array.from({ length: count }, (_, index) => ({
      id: `neume-${index}`,
      kind: 'punctum',
      lyricSyllableId: 'syllable-1',
      notes: [
        {
          id: `note-${index}`,
          staffPosition: staffPosition(2),
        },
      ],
    })),
  }
}

describe('multi-system editing safeguards', () => {
  it('permits one-system placement and disables multi-system placement', () => {
    const oneSystem = layoutChant(documentWith(9))
    const multiSystem = layoutChant(documentWith(10))

    expect(canUseGraphicalPlacement(oneSystem)).toBe(true)
    expect(canUseGraphicalPlacement(multiSystem)).toBe(false)
    expect(shouldCancelGraphicalPlacement(
      multiSystem,
      placePunctumTool(),
    )).toBe(true)
    expect(shouldCancelGraphicalPlacement(multiSystem, selectTool()))
      .toBe(false)
  })

  it('restores only an invoking note that survives the edit', () => {
    const document = documentWith(1)

    expect(getSurvivingFocusNoteId(document, 'note-0')).toBe('note-0')
    expect(getSurvivingFocusNoteId(document, 'deleted')).toBeNull()
  })
})
