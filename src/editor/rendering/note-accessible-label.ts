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

  return 'Select punctum'
}
