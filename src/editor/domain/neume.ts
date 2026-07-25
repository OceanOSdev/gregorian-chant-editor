import type {
  ChantDocument,
  ChantNote,
  Neume,
  PunctumNeume,
} from './chant-document'

export interface LocatedNote {
  neume: Neume
  neumeIndex: number
  note: ChantNote
  noteIndex: number
}

export interface LocatedNeume {
  neume: Neume
  neumeIndex: number
}

export function findNeume(
  document: ChantDocument,
  neumeId: string,
): LocatedNeume | null {
  const neumeIndex = document.neumes.findIndex(
    (neume) => neume.id === neumeId,
  )
  const neume = document.neumes[neumeIndex]

  return neume ? { neume, neumeIndex } : null
}

export function findNote(
  document: ChantDocument,
  noteId: string,
): LocatedNote | null {
  for (const [neumeIndex, neume] of document.neumes.entries()) {
    const noteIndex = neume.notes.findIndex((note) => note.id === noteId)
    const note = neume.notes[noteIndex]

    if (note) {
      return { neume, neumeIndex, note, noteIndex }
    }
  }

  return null
}

export function countNotes(neumes: readonly Neume[]): number {
  return neumes.reduce((count, neume) => count + neume.notes.length, 0)
}

export function isValidNeume(neume: Neume): boolean {
  if (neume.kind === 'punctum') {
    return neume.notes.length === 1
  }

  if (neume.notes.length !== 2) {
    return false
  }

  const [firstNote, secondNote] = neume.notes

  if (!firstNote || !secondNote) {
    return false
  }

  return neume.kind === 'podatus'
    ? secondNote.staffPosition > firstNote.staffPosition
    : secondNote.staffPosition < firstNote.staffPosition
}

export function normalizeNeumeAfterNoteDeletion(
  neume: Neume,
  noteId: string,
): Neume | null {
  const survivingNotes = neume.notes.filter((note) => note.id !== noteId)

  if (survivingNotes.length === neume.notes.length) {
    return neume
  }

  const survivingNote = survivingNotes[0]

  if (!survivingNote) {
    return null
  }

  const punctum: PunctumNeume = {
    id: neume.id,
    kind: 'punctum',
    lyricSyllableId: neume.lyricSyllableId,
    notes: [survivingNote],
  }

  return punctum
}
