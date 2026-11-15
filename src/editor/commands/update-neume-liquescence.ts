import type {
  ChantDocument,
  ClivisNeume,
  Neume,
  PodatusNeume,
} from '../domain/chant-document';
import {
  isLiquescenceFor,
  neumeLiquescence,
  type NeumeLiquescence,
} from '../domain/liquescence';
import { findNeume, isValidNeume } from '../domain/neume';

/**
 * Changes only a Podatus/Clivis neume-level appearance (ADR 0027). Undefined
 * restores the ordinary figure by removing the field. Unknown targets,
 * unchanged values and invalid results (unsupported value, quilisma, marks on
 * the second note) return the same document, so history and autosave skip
 * them. Neume/note IDs, pitches, marks, anchors and accidentals are untouched.
 */
export function updateNeumeLiquescence(
  document: ChantDocument,
  neumeId: string,
  liquescence: NeumeLiquescence | undefined,
): ChantDocument {
  const located = findNeume(document, neumeId);
  if (!located) return document;
  const { neume } = located;
  if (neumeLiquescence(neume) === liquescence) return document;
  if (liquescence !== undefined && !isLiquescenceFor(neume.kind, liquescence))
    return document;
  const updated = withLiquescence(neume, liquescence);
  if (!updated || !isValidNeume(updated)) return document;
  return {
    ...document,
    neumes: document.neumes.map((n, index) =>
      index === located.neumeIndex ? updated : n,
    ),
  };
}

/** Explicit construction: these kinds carry exactly id, kind, notes and appearance. */
function withLiquescence(
  neume: Neume,
  liquescence: NeumeLiquescence | undefined,
): PodatusNeume | ClivisNeume | null {
  if (neume.kind === 'podatus') {
    const ordinary: PodatusNeume = {
      id: neume.id,
      kind: 'podatus',
      notes: neume.notes,
    };
    if (liquescence === undefined) return ordinary;
    return liquescence === 'diminutive' ||
      liquescence === 'augmentative-descending'
      ? { ...ordinary, liquescence }
      : null;
  }
  if (neume.kind === 'clivis') {
    const ordinary: ClivisNeume = {
      id: neume.id,
      kind: 'clivis',
      notes: neume.notes,
    };
    if (liquescence === undefined) return ordinary;
    return liquescence === 'diminutive' ? { ...ordinary, liquescence } : null;
  }
  return null;
}
