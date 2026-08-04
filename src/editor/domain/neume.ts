import type {
  ChantDocument,
  ChantNote,
  ClivisNeume,
  Neume,
  PodatusNeume,
  PunctumNeume,
} from './chant-document';

export interface LocatedNote {
  neume: Neume;
  neumeIndex: number;
  note: ChantNote;
  noteIndex: number;
}

export interface LocatedNeume {
  neume: Neume;
  neumeIndex: number;
}

export function findNeume(
  document: ChantDocument,
  neumeId: string,
): LocatedNeume | null {
  const neumeIndex = document.neumes.findIndex((neume) => neume.id === neumeId);
  const neume = document.neumes[neumeIndex];

  return neume ? { neume, neumeIndex } : null;
}

export function findNote(
  document: ChantDocument,
  noteId: string,
): LocatedNote | null {
  for (const [neumeIndex, neume] of document.neumes.entries()) {
    const noteIndex = neume.notes.findIndex((note) => note.id === noteId);
    const note = neume.notes[noteIndex];

    if (note) {
      return { neume, neumeIndex, note, noteIndex };
    }
  }

  return null;
}

export function countNotes(neumes: readonly Neume[]): number {
  return neumes.reduce((count, neume) => count + neume.notes.length, 0);
}

/**
 * Defensively checks runtime cardinality and pitch order even though the
 * semantic interfaces express each supported neume with a tuple.
 */
export function isValidNeume(neume: Neume): boolean {
  switch (neume.kind) {
    case 'punctum':
      return neume.notes.length === 1 && Boolean(neume.notes[0]);
    case 'podatus':
    case 'clivis': {
      if (neume.notes.length !== 2) {
        return false;
      }

      const [firstNote, secondNote] = neume.notes;

      if (!firstNote || !secondNote) {
        return false;
      }

      return neume.kind === 'podatus'
        ? firstNote.staffPosition < secondNote.staffPosition
        : firstNote.staffPosition > secondNote.staffPosition;
    }
    case 'scandicus': {
      if (neume.notes.length !== 3) {
        return false;
      }

      const [firstNote, secondNote, thirdNote] = neume.notes;

      return (
        Boolean(firstNote && secondNote && thirdNote) &&
        firstNote.staffPosition < secondNote.staffPosition &&
        secondNote.staffPosition < thirdNote.staffPosition
      );
    }
    case 'torculus': {
      if (neume.notes.length !== 3) {
        return false;
      }

      const [firstNote, secondNote, thirdNote] = neume.notes;

      return (
        Boolean(firstNote && secondNote && thirdNote) &&
        firstNote.staffPosition < secondNote.staffPosition &&
        secondNote.staffPosition > thirdNote.staffPosition
      );
    }
  }
}

/**
 * Preserves the owning neume ID and every surviving note ID while reducing
 * Scandicus to Podatus, a two-note neume to Punctum, or Punctum to no neume.
 */
export function normalizeNeumeAfterNoteDeletion(
  neume: Neume,
  noteId: string,
): Neume | null {
  const noteIndex = neume.notes.findIndex((note) => note.id === noteId);

  if (noteIndex < 0) {
    return neume;
  }

  if (neume.kind === 'punctum') {
    return null;
  }

  if (neume.kind === 'scandicus') {
    const [firstNote, secondNote, thirdNote] = neume.notes;
    let survivingNotes: [ChantNote, ChantNote];

    if (noteIndex === 0) {
      survivingNotes = [secondNote, thirdNote];
    } else if (noteIndex === 1) {
      survivingNotes = [firstNote, thirdNote];
    } else {
      survivingNotes = [firstNote, secondNote];
    }

    const podatus: PodatusNeume = {
      id: neume.id,
      kind: 'podatus',
      lyricSyllableId: neume.lyricSyllableId,
      notes: survivingNotes,
    };

    return podatus;
  }

  if (neume.kind === 'torculus') {
    const [firstNote, secondNote, thirdNote] = neume.notes;
    let survivingNotes: [ChantNote, ChantNote];

    if (noteIndex === 0) {
      survivingNotes = [secondNote, thirdNote];
    } else if (noteIndex === 1) {
      survivingNotes = [firstNote, thirdNote];
    } else {
      survivingNotes = [firstNote, secondNote];
    }

    if (survivingNotes[0].staffPosition === survivingNotes[1].staffPosition) {
      // Equal outer notes cannot form either supported two-note neume.
      return neume;
    }

    if (survivingNotes[0].staffPosition < survivingNotes[1].staffPosition) {
      const podatus: PodatusNeume = {
        id: neume.id,
        kind: 'podatus',
        lyricSyllableId: neume.lyricSyllableId,
        notes: survivingNotes,
      };

      return podatus;
    }

    const clivis: ClivisNeume = {
      id: neume.id,
      kind: 'clivis',
      lyricSyllableId: neume.lyricSyllableId,
      notes: survivingNotes,
    };

    return clivis;
  }

  const [firstNote, secondNote] = neume.notes;
  const survivingNote = noteIndex === 0 ? secondNote : firstNote;
  const punctum: PunctumNeume = {
    id: neume.id,
    kind: 'punctum',
    lyricSyllableId: neume.lyricSyllableId,
    notes: [survivingNote],
  };

  return punctum;
}
