import type { Neume } from '../domain/chant-document'

export function getNoteAccessibleLabel(
  kind: Neume['kind'],
  noteIndex: number,
): string {
  if (kind === 'podatus') {
    return noteIndex === 0
      ? 'Select lower note of podatus'
      : 'Select upper note of podatus'
  }

  if (kind === 'clivis') {
    return noteIndex === 0
      ? 'Select upper note of clivis'
      : 'Select lower note of clivis'
  }

  if (kind === 'scandicus') {
    if (noteIndex === 0) {
      return 'Select lowest note of scandicus'
    }

    return noteIndex === 1
      ? 'Select middle note of scandicus'
      : 'Select highest note of scandicus'
  }

  return 'Select punctum'
}

export const wholeNeumeSelectionInstruction =
  'Shift plus Enter or Space selects the whole neume.'

export function getSelectedNeumeDescription(
  kind: Neume['kind'],
  isSelected: boolean,
): string | null {
  if (!isSelected) {
    return null
  }

  return `Whole ${kind} selected. Arrow Up or Arrow Down moves it. Delete or Backspace removes it.`
}
