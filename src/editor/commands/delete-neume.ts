import { deleteLyricSyllable } from './delete-lyric-syllable';
import { findSyllableAtNeume } from '../domain/lyrics';
import type { ChantDocument } from '../domain/chant-document';
import { findNeume } from '../domain/neume';

export function deleteNeume(
  document: ChantDocument,
  neumeId: string,
): ChantDocument {
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
    neumes: document.neumes.filter(
      (_, index) => index !== locatedNeume.neumeIndex,
    ),
  };
}
