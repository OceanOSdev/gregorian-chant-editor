import { reconcileAccidentalsResult } from '../domain/accidentals';
import { deriveScoreOrder, reanchorScoreOrder } from '../domain/divisions';
import { deleteLyricSyllableCandidate } from './delete-lyric-syllable';
import { findSyllableAtNeume } from '../domain/lyrics';
import type { ChantDocument } from '../domain/chant-document';
import { findNeume } from '../domain/neume';

/** Intermediate candidate: finalize the complete command before adoption. */
export function deleteNeumeCandidate(
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
    ? deleteLyricSyllableCandidate(document, anchored.id)
    : document;
  return {
    ...withoutLyric,
    ...reanchorScoreOrder(order.filter((item) => item.entity.id !== neumeId)),
    neumes: document.neumes.filter(
      (_, index) => index !== locatedNeume.neumeIndex,
    ),
  };
}

export function deleteNeumeResult(
  ...args: Parameters<typeof deleteNeumeCandidate>
) {
  return reconcileAccidentalsResult(args[0], deleteNeumeCandidate(...args));
}

export function deleteNeume(
  ...args: Parameters<typeof deleteNeumeCandidate>
): ChantDocument {
  return deleteNeumeResult(...args).document;
}
