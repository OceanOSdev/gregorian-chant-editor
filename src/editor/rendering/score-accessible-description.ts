import { clefName } from '../domain/clef';
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

  const marked = neumes
    .flatMap((n) => n.notes)
    .filter((n) => n.mora || n.episema || n.verticalEpisema).length;
  const clef = layout.systems[0]?.clef;
  const changes = layout.systems.flatMap((system) => system.clefChanges);
  const divisions = layout.systems.flatMap((system) => system.divisions);
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
    )}.${marked ? ' ' + countLabel(marked, 'note with rhythmic modifiers', 'notes with rhythmic modifiers') + '.' : ''}${clef ? ` Initial ${clefName(clef)} clef on staff line ${clef.staffLine} from bottom${changes.length ? '. System openings use their effective clef' : ', repeated on every system'}.` : ''}${changes.length ? ` ${countLabel(changes.length, 'authored clef change', 'authored clef changes')}: ${changes.map((c) => `${clefName(c)} on staff line ${c.staffLine}`).join(', ')}.` : ''}${divisions.length ? ` ${countLabel(divisions.length, 'division', 'divisions')}: ${divisions.map((d) => d.kind).join(', ')}.` : ''}`
  );
}
