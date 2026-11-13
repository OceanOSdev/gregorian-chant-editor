import { reconcileAccidentalsResult } from '../domain/accidentals';
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

function moveNeumeVerticallyCandidate(
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
  if (movedNeume.notes.some((n) => !Number.isSafeInteger(n.staffPosition)))
    return document;

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
    case 'bistropha':
    case 'podatus':
    case 'clivis': {
      const [firstNote, secondNote] = neume.notes;

      return {
        ...neume,
        notes: [moveNote(firstNote, delta), moveNote(secondNote, delta)],
      };
    }
    case 'scandicus':
    case 'tristropha':
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

export function moveNeumeVerticallyResult(
  ...args: Parameters<typeof moveNeumeVerticallyCandidate>
) {
  return reconcileAccidentalsResult(
    args[0],
    moveNeumeVerticallyCandidate(...args),
  );
}

export function moveNeumeVertically(
  ...args: Parameters<typeof moveNeumeVerticallyCandidate>
): ChantDocument {
  return moveNeumeVerticallyResult(...args).document;
}
