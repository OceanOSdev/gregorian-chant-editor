import { reconcileAccidentals } from '../domain/accidentals';
import { deriveScoreOrder, reanchorScoreOrder } from '../domain/divisions';
import { deleteLyricSyllable } from './delete-lyric-syllable';
import { findSyllableAtNeume } from '../domain/lyrics';
import type { ChantDocument } from '../domain/chant-document';
import { findNeume } from '../domain/neume';

function deleteNeumeCandidate(
  document: ChantDocument,
  neumeId: string,
): ChantDocument {
  const order = deriveScoreOrder(document);
  if (!order) return document;
  const locatedNeume = findNeume(document, neumeId);

  if (!locatedNeume) {
    return document;
  }

  const anchored = findSyllableAtNeume(document, neumeId);
  const withoutLyric = anchored
    ? deleteLyricSyllable(document, anchored.id)
    : document;
  return {
    ...withoutLyric,
    ...reanchorScoreOrder(order.filter((item) => item.entity.id !== neumeId)),
    neumes: document.neumes.filter(
      (_, index) => index !== locatedNeume.neumeIndex,
    ),
  };
}

export function deleteNeume(
  ...args: Parameters<typeof deleteNeumeCandidate>
): ChantDocument {
  return (
    reconcileAccidentals(args[0], deleteNeumeCandidate(...args)) ?? args[0]
  );
}
