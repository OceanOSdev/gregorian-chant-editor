import { deriveScoreOrder } from '../domain/divisions';
import { deleteLyricSyllable } from './delete-lyric-syllable';
import { findSyllableAtNeume } from '../domain/lyrics';
import type { ChantDocument } from '../domain/chant-document';
import { findNeume } from '../domain/neume';

export function deleteNeume(
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
    divisions: order.flatMap((item) =>
      item.type === 'division'
        ? [
            {
              ...item.entity,
              beforeNeumeId:
                item.entity.beforeNeumeId === neumeId
                  ? (document.neumes[locatedNeume.neumeIndex + 1]?.id ?? null)
                  : item.entity.beforeNeumeId,
            },
          ]
        : [],
    ),
    neumes: document.neumes.filter(
      (_, index) => index !== locatedNeume.neumeIndex,
    ),
  };
}
