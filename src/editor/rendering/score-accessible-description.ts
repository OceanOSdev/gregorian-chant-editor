import type { ChantLayout } from '../layout/layout-chant';

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getScoreAccessibleDescription(layout: ChantLayout) {
  const neumes = layout.systems.flatMap((system) => system.neumes);
  const noteCount = neumes.reduce(
    (count, neume) => count + neume.notes.length,
    0,
  );
  const lyricCount = layout.systems.reduce(
    (count, system) => count + system.lyrics.length,
    0,
  );

  return (
    `A Gregorian chant score with ${countLabel(
      layout.systems.length,
      'four-line system',
      'four-line systems',
    )}, ${countLabel(neumes.length, 'neume', 'neumes')}, ` +
    `${countLabel(noteCount, 'note', 'notes')}, and ${countLabel(
      lyricCount,
      'rendered lyric syllable',
      'rendered lyric syllables',
    )}.`
  );
}
