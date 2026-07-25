import { describe, expect, it } from 'vitest'
import {
  getNoteAccessibleLabel,
  getSelectedNeumeDescription,
  wholeNeumeSelectionInstruction,
} from './note-accessible-label'

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

  it('provides a concise whole-neume keyboard instruction', () => {
    expect(wholeNeumeSelectionInstruction).toBe(
      'Shift plus Enter or Space selects the whole neume.',
    )
  })

  it.each([
    {
      kind: 'punctum' as const,
      description:
        'Whole punctum selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
    {
      kind: 'podatus' as const,
      description:
        'Whole podatus selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
    {
      kind: 'clivis' as const,
      description:
        'Whole clivis selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.',
    },
  ])(
    'describes selected $kind state',
    ({ kind, description }) => {
      expect(getSelectedNeumeDescription(kind, true)).toBe(description)
    },
  )

  it('omits selected-neume status for an unrelated constituent', () => {
    expect(getSelectedNeumeDescription('podatus', false)).toBeNull()
  })
})
