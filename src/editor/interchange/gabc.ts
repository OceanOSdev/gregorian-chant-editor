import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
  type StaffLine,
} from '../domain/chant-document';
import { validateChantDocument } from '../persistence/chant-file';

const plainLyric = /^[\p{L}\p{M}\p{N}’'.,!?]+$/u;

/** Deliberately strict subset: C clef, plain syllables and seven neume kinds. */
export function importGabc(source: string): ChantDocument {
  if (source.length > 1_000_000) throw new Error('GABC file is too large.');
  const split = source.indexOf('%%');
  if (split < 0) throw new Error('GABC needs a header ending in %%.');
  const header = source.slice(0, split);
  let title = 'Imported chant';
  let language: ChantDocument['lyricLanguage'] = 'und';
  for (const line of header.split(/\r?\n/).filter((s) => s.trim())) {
    const match = /^\s*([\w-]+)\s*:\s*([^;]*);\s*$/.exec(line);
    if (!match) throw new Error('Unsupported GABC header syntax.');
    if (match[1] === 'name') title = match[2].trim() || title;
    if (match[1] === 'language')
      language =
        ({ latin: 'la', english: 'en', greek: 'el' } as const)[
          match[2].trim().toLowerCase() as 'latin' | 'english' | 'greek'
        ] ?? 'und';
    if (!['name', 'language', 'comment', 'generated-by'].includes(match[1]))
      throw new Error(`Unsupported GABC header: ${match[1]}.`);
  }
  let body = source.slice(split + 2).trim();
  const clef = /^\(c([1-4])\)/.exec(body);
  if (!clef)
    throw new Error('The score must begin with (c1), (c2), (c3), or (c4).');
  body = body.slice(clef[0].length);
  const document: ChantDocument = {
    title,
    lyricLanguage: language,
    clef: { type: 'c', staffLine: Number(clef[1]) as StaffLine },
    neumes: [],
    syllables: [],
  };
  let sequence = 0;
  const id = () => `gabc-${++sequence}`;
  let previousWasWordEnd = true;
  while (body.trim()) {
    const token = /^(\s*)([^()]*)\(([^()]*)\)/.exec(body);
    if (!token) throw new Error('Unsupported GABC body syntax.');
    body = body.slice(token[0].length);
    const lyric = token[2].trim();
    const groups = token[3].split('/');
    if (!groups.length || groups.some((g) => !/^[a-mA-M]{1,3}$/.test(g)))
      throw new Error(
        'Only plain one-to-three-note neumes separated by / are supported. Bars, ornaments and clef changes are not supported.',
      );
    let anchor = '';
    for (const group of groups) {
      const notes = [...group].map((letter): ChantNote => ({
        id: id(),
        staffPosition: staffPosition(letter.toLowerCase().charCodeAt(0) - 100),
      }));
      const [a, b, c] = notes;
      const neumeId = id();
      if (!anchor) anchor = neumeId;
      let neume: Neume;
      if (notes.length === 1 && a && /^[a-m]$/.test(group))
        neume = { id: neumeId, kind: 'punctum', notes: [a] };
      else if (
        notes.length === 2 &&
        a &&
        b &&
        /^[a-m]+$/.test(group) &&
        a.staffPosition !== b.staffPosition
      )
        neume = {
          id: neumeId,
          kind: a.staffPosition < b.staffPosition ? 'podatus' : 'clivis',
          notes: [a, b],
        };
      else if (notes.length === 3 && a && b && c) {
        const up = a.staffPosition < b.staffPosition;
        const down = a.staffPosition > b.staffPosition;
        const kind =
          /^[a-m][A-M]{2}$/.test(group) &&
          down &&
          b.staffPosition > c.staffPosition
            ? 'climacus'
            : /^[a-m]{3}$/.test(group)
              ? up && b.staffPosition < c.staffPosition
                ? 'scandicus'
                : up && b.staffPosition > c.staffPosition
                  ? 'torculus'
                  : down && b.staffPosition < c.staffPosition
                    ? 'porrectus'
                    : null
              : null;
        if (!kind) throw new Error(`Unsupported GABC neume: ${group}.`);
        neume = { id: neumeId, kind, notes: [a, b, c] };
      } else throw new Error(`Unsupported GABC neume: ${group}.`);
      document.neumes.push(neume);
    }
    if (lyric) {
      if (!plainLyric.test(lyric))
        throw new Error(
          'Use plain GABC syllables; formatting and entry delimiters are unsupported.',
        );
      document.syllables.push({
        id: id(),
        text: lyric,
        startsAtNeumeId: anchor,
        boundaryBefore:
          document.syllables.length === 0 ||
          previousWasWordEnd ||
          token[1].length > 0
            ? 'word'
            : 'continuation',
      });
    }
    previousWasWordEnd = /^\s/.test(body);
  }
  return validateChantDocument(document);
}

export function exportGabc(document: ChantDocument): string {
  validateChantDocument(document);
  if (/[%;\r\n]/.test(document.title))
    throw new Error(
      'GABC titles cannot contain percent signs, semicolons or line breaks.',
    );
  const syllables = new Map(
    document.syllables.map((s) => [s.startsAtNeumeId, s]),
  );
  let body = `(c${document.clef.staffLine})`;
  let hasMusic = false;
  for (const neume of document.neumes) {
    const syllable = syllables.get(neume.id);
    if (syllable && !plainLyric.test(syllable.text))
      throw new Error(
        'This lyric contains punctuation unsupported by the GABC adapter. Save JSON for a lossless copy.',
      );
    const pitches = neume.notes
      .map((n, i) => {
        const value = n.staffPosition + 100;
        if (value < 97 || value > 109)
          throw new Error('GABC supports staff positions −3 through 9 (a–m).');
        const letter = String.fromCharCode(value);
        return neume.kind === 'climacus' && i > 0
          ? letter.toUpperCase()
          : letter;
      })
      .join('');
    // Group music between anchors with /; whitespace marks word boundaries only.
    if (!syllable && hasMusic) body = body.slice(0, -1) + '/' + pitches + ')';
    else
      body += `${syllable?.boundaryBefore === 'word' ? ' ' : ''}${syllable?.text ?? ''}(${pitches})`;
    hasMusic = true;
  }
  const language = {
    la: 'Latin',
    en: 'English',
    el: 'Greek',
    und: 'Unspecified',
  }[document.lyricLanguage];
  return `name: ${document.title};\nlanguage: ${language};\ngenerated-by: Gregorian Chant Editor;\n%%\n${body}\n`;
}
