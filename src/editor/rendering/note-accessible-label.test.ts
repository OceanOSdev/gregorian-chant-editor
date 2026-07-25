import { describe, expect, it } from 'vitest'
import { getNoteAccessibleLabel } from './note-accessible-label'

describe('getNoteAccessibleLabel', () => {
  it.each([
    { kind: 'punctum' as const, noteIndex: 0, label: 'Select punctum' },
    {
      kind: 'podatus' as const,
      noteIndex: 0,
      label: 'Select lower note of podatus',
    },
    {
      kind: 'podatus' as const,
      noteIndex: 1,
      label: 'Select upper note of podatus',
    },
    {
      kind: 'clivis' as const,
      noteIndex: 0,
      label: 'Select upper note of clivis',
    },
    {
      kind: 'clivis' as const,
      noteIndex: 1,
      label: 'Select lower note of clivis',
    },
  ])('labels $kind note $noteIndex', ({ kind, noteIndex, label }) => {
    expect(getNoteAccessibleLabel(kind, noteIndex)).toBe(label)
  })
})
