import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
} from '../domain/chant-document';
import { findNeume, isValidNeume } from '../domain/neume';

function moveNote(note: ChantNote, delta: number): ChantNote {
  return {
    ...note,
    staffPosition: staffPosition(note.staffPosition + delta),
  };
}

export function moveNeumeVertically(
  document: ChantDocument,
  neumeId: string,
  delta: number,
): ChantDocument {
  if (!Number.isInteger(delta)) {
    throw new TypeError('Neume movement deltas must be integers');
  }

  if (delta === 0) {
    return document;
  }

  const locatedNeume = findNeume(document, neumeId);

  if (!locatedNeume) {
    return document;
  }

  const movedNeume = transposeNeume(locatedNeume.neume, delta);

  if (!isValidNeume(movedNeume)) {
    return document;
  }

  return {
    ...document,
    neumes: document.neumes.map((neume, index) =>
      index === locatedNeume.neumeIndex ? movedNeume : neume,
    ),
  };
}

/** Translate every note while retaining kind-correlated tuples and identities. */
export function transposeNeume(neume: Neume, delta: number): Neume {
  switch (neume.kind) {
    case 'punctum': {
      const [note] = neume.notes;

      return {
        ...neume,
        notes: [moveNote(note, delta)],
      };
    }
    case 'podatus':
    case 'clivis': {
      const [firstNote, secondNote] = neume.notes;

      return {
        ...neume,
        notes: [moveNote(firstNote, delta), moveNote(secondNote, delta)],
      };
    }
    case 'scandicus':
    case 'climacus':
    case 'porrectus':
    case 'torculus': {
      const [firstNote, secondNote, thirdNote] = neume.notes;

      return {
        ...neume,
        notes: [
          moveNote(firstNote, delta),
          moveNote(secondNote, delta),
          moveNote(thirdNote, delta),
        ],
      };
    }
  }
}
