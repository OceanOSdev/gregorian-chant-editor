import type { InsertionIds } from './insert-editor-neume';

/**
 * Longest entry variants (Pes subtripunctis, five-note Scandicus/Climacus);
 * extra IDs are simply unused.
 */
export const maximumEntryNoteCount = 5;

/**
 * The single interaction-boundary allocation of distinct IDs for one entry.
 * Pure reducers and insertion bridges never generate IDs.
 */
export function allocateInsertionIds(
  randomId: () => string = () => crypto.randomUUID(),
): InsertionIds {
  const [a, b, c, ...rest] = Array.from(
    { length: maximumEntryNoteCount },
    randomId,
  );
  return { neumeId: randomId(), noteIds: [a, b, c, ...rest] };
}
