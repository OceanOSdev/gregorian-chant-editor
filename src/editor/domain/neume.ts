import { hasValidNoteForms } from './note-forms';
import { getMoraScope } from './mora';
import {
  monotonicNotes,
  pesSubpunctisNotes,
  type ChantDocument,
  type ChantNote,
  type ClivisNeume,
  type Neume,
  type PodatusNeume,
  type PunctumNeume,
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
  if (
    neume.notes.some(
      (note) =>
        !note ||
        ('mora' in note && note.mora !== 1) ||
        ('episema' in note && note.episema !== true) ||
        ('verticalEpisema' in note && note.verticalEpisema !== true),
    )
  )
    return false;
  if (!hasValidNoteForms(neume)) return false;
  if (getMoraScope(neume) === null) return false;
  switch (neume.kind) {
    case 'pes-subpunctis': {
      const [first, apex, ...tail] = neume.notes;
      if (
        (neume.notes.length !== 4 && neume.notes.length !== 5) ||
        !first ||
        !apex ||
        first.staffPosition >= apex.staffPosition
      )
        return false;
      // The tail may end below, at or above the first note.
      return tail.every(
        (note, index) =>
          note.staffPosition <
          (index === 0 ? apex : tail[index - 1]).staffPosition,
      );
    }
    case 'bistropha':
    case 'tristropha':
      return (
        neume.notes.length === (neume.kind === 'bistropha' ? 2 : 3) &&
        neume.notes.every(
          (note) => note.staffPosition === neume.notes[0].staffPosition,
        )
      );
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
    case 'scandicus':
    case 'climacus': {
      // Exactly three, four or five notes (ADR 0024), strictly monotonic.
      const notes: readonly (ChantNote | undefined)[] = neume.notes;
      if (notes.length < 3 || notes.length > 5) return false;
      // Index every slot: array iteration helpers skip holes.
      for (let index = 0; index < notes.length; index++) {
        const note = notes[index];
        const previous = notes[index - 1];
        if (!note) return false;
        if (
          previous &&
          (neume.kind === 'scandicus'
            ? previous.staffPosition >= note.staffPosition
            : previous.staffPosition <= note.staffPosition)
        )
          return false;
      }
      return true;
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
    case 'porrectus': {
      if (neume.notes.length !== 3) {
        return false;
      }

      const [firstNote, secondNote, thirdNote] = neume.notes;

      return (
        Boolean(firstNote && secondNote && thirdNote) &&
        firstNote.staffPosition > secondNote.staffPosition &&
        secondNote.staffPosition < thirdNote.staffPosition
      );
    }
  }
}

/**
 * Preserves the owning neume ID and every surviving note ID while reducing
 * three-note kinds to a supported two-note contour, two-note kinds to Punctum,
 * or Punctum to no neume. Unsupported equal-pitch survivors reject deletion.
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

  if (neume.kind === 'pes-subpunctis') {
    return normalizePesSubpunctisSurvivors(
      neume,
      neume.notes.filter((note) => note.id !== noteId),
    );
  }

  if (neume.kind === 'bistropha' || neume.kind === 'tristropha') {
    const survivors = neume.notes.filter((note) => note.id !== noteId);
    const [a, b] = survivors;
    if (!a) return neume;
    const normalized: Neume = b
      ? { id: neume.id, kind: 'bistropha', notes: [a, b] }
      : { id: neume.id, kind: 'punctum', notes: [a] };
    return isValidNeume(normalized) ? normalized : neume;
  }

  if (
    (neume.kind === 'scandicus' || neume.kind === 'climacus') &&
    neume.notes.length > 3
  ) {
    // Five to four and four to three keep the family. Survivors of a strict
    // contour stay strict; any form or mora that the shorter group does not
    // allow rejects the deletion rather than being dropped or transferred.
    const notes = monotonicNotes(
      neume.notes.filter((note) => note.id !== noteId),
    );
    if (!notes) return neume;
    const shorter: Neume = { id: neume.id, kind: neume.kind, notes };
    return isValidNeume(shorter) ? shorter : neume;
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
      notes: survivingNotes,
    };

    return hasValidNoteForms(podatus) ? podatus : neume;
  }

  if (
    neume.kind === 'torculus' ||
    neume.kind === 'climacus' ||
    neume.kind === 'porrectus'
  ) {
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
        notes: survivingNotes,
      };

      return hasValidNoteForms(podatus) ? podatus : neume;
    }

    const clivis: ClivisNeume = {
      id: neume.id,
      kind: 'clivis',
      notes: survivingNotes,
    };

    return hasValidNoteForms(clivis) ? clivis : neume;
  }

  const [firstNote, secondNote] = neume.notes;
  const survivingNote = noteIndex === 0 ? secondNote : firstNote;
  const punctum: PunctumNeume = {
    id: neume.id,
    kind: 'punctum',
    notes: [survivingNote],
  };

  return hasValidNoteForms(punctum) ? punctum : neume;
}

/**
 * Five-note survivors stay a Pes subpunctis only when they still satisfy its
 * contour. Four-note survivors become the existing three-note kind whose rule
 * the actual contour satisfies. Anything else (for example four descending
 * notes, or equal adjacent pitches) is rejected by returning the input.
 */
function normalizePesSubpunctisSurvivors(
  neume: Neume,
  survivors: readonly ChantNote[],
): Neume {
  const [a, b, c] = survivors;
  const candidates: Neume[] = [];
  const tuple = pesSubpunctisNotes(survivors);
  if (tuple)
    candidates.push({ id: neume.id, kind: 'pes-subpunctis', notes: tuple });
  else if (a && b && c && survivors.length === 3)
    // Survivors of p0 < p1 > p2 > p3 can only rise-fall or strictly descend.
    for (const kind of ['torculus', 'climacus'] as const)
      candidates.push({ id: neume.id, kind, notes: [a, b, c] });
  return candidates.find(isValidNeume) ?? neume;
}

/**
 * Lowercase descriptive name derived from the actual count: Pes subpunctis
 * by its traditional names, extended Scandicus/Climacus by their note count.
 */
export function neumeDisplayName(
  kind: Neume['kind'],
  noteCount: number,
): string {
  if (kind === 'pes-subpunctis')
    return noteCount === 5 ? 'pes subtripunctis' : 'pes subbipunctis';
  if ((kind === 'scandicus' || kind === 'climacus') && noteCount > 3)
    return `${noteCount === 5 ? 'five' : 'four'}-note ${kind}`;
  return kind;
}

/**
 * Rebuilds a neume's own correlated tuple from mapped notes, so commands never
 * widen the Neume union or silently truncate a bounded family. Validation of
 * the mapped result remains the caller's responsibility.
 */
export function mapNeumeNotes(
  neume: Neume,
  map: (note: ChantNote, index: number) => ChantNote,
): Neume | null {
  switch (neume.kind) {
    case 'pes-subpunctis': {
      const notes = pesSubpunctisNotes(neume.notes.map(map));
      return notes ? { ...neume, notes } : null;
    }
    case 'scandicus':
    case 'climacus': {
      const notes = monotonicNotes(neume.notes.map(map));
      return notes ? { id: neume.id, kind: neume.kind, notes } : null;
    }
    case 'punctum':
      return { ...neume, notes: [map(neume.notes[0], 0)] };
    case 'bistropha':
    case 'podatus':
    case 'clivis': {
      const [a, b] = neume.notes;
      return { ...neume, notes: [map(a, 0), map(b, 1)] };
    }
    case 'tristropha':
    case 'torculus':
    case 'porrectus': {
      const [a, b, c] = neume.notes;
      return { ...neume, notes: [map(a, 0), map(b, 1), map(c, 2)] };
    }
  }
}
