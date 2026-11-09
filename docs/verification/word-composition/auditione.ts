import {
  staffPosition,
  type ChantDocument,
} from '../../../src/editor/domain/chant-document';
import type { CompositionCase } from './corpus';

/** GABC source: (c3) au(h)di(h)ti(h)ó(h)ne(hi). h is staff position 5, i is 6. */
function specimen(
  id: string,
  accented: boolean,
  podatus: boolean,
  centered = false,
): CompositionCase {
  const words = [['au', 'di', 'ti', accented ? 'ó' : 'o', 'ne']];
  const document: ChantDocument = {
    title: `Auditione — ${id}`,
    clefChanges: [],
    divisions: [],
    lyricLanguage: centered ? 'und' : 'la',
    clef: { type: 'c', staffLine: 3 },
    syllables: words[0].map((text, i) => ({
      id: `${id}-s${i}`,
      text,
      startsAtNeumeId: `${id}-n${i}`,
      boundaryBefore: i === 0 ? 'word' : 'continuation',
    })),
    neumes: words[0].map((_, i) =>
      i === 4 && podatus
        ? {
            id: `${id}-n${i}`,
            kind: 'podatus',
            notes: [
              { id: `${id}-note${i}`, staffPosition: staffPosition(5) },
              { id: `${id}-upper`, staffPosition: staffPosition(6) },
            ],
          }
        : {
            id: `${id}-n${i}`,
            kind: 'punctum',
            notes: [{ id: `${id}-note${i}`, staffPosition: staffPosition(5) }],
          },
    ),
  };
  return { id, name: 'Auditione', arrangement: 'reference', words, document };
}
export const auditioneCorpus = [
  specimen('auditione-reference', true, true),
  specimen('auditione-unaccented', false, true),
  specimen('auditione-puncta', true, false),
  specimen('auditione-centered-control', true, true, true),
];
