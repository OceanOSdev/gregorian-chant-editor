import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
} from '../domain/chant-document';
import { isValidNeume } from '../domain/neume';
import { hasValidLyricAnchors } from '../domain/lyrics';

export const maxFileBytes = 2_000_000;
export const chantFileFormat = 'gregorian-chant-editor';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a document object.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 1000): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    throw new Error(`Invalid ${label}.`);
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new Error('Invalid or oversized document collection.');
  return value;
}

/** The only untyped JSON boundary. Build fresh typed records; never trust a cast. */
export function validateChantDocument(value: unknown): ChantDocument {
  const source = record(value);
  const ids = new Set<string>();
  function id(value: unknown) {
    const result = text(value, 'entity ID', 200);
    if (!result || ids.has(result))
      throw new Error('Entity IDs must be nonempty and globally unique.');
    ids.add(result);
    return result;
  }
  const neumes = list(source.neumes).map((raw): Neume => {
    const item = record(raw);
    const neumeId = id(item.id);
    const notes = list(item.notes).map((raw): ChantNote => {
      const note = record(raw);
      if (
        typeof note.staffPosition !== 'number' ||
        !Number.isSafeInteger(note.staffPosition) ||
        Math.abs(note.staffPosition) > 1024
      )
        throw new Error('Invalid or unsupported staff position.');
      return {
        id: id(note.id),
        staffPosition: staffPosition(note.staffPosition),
      };
    });
    const [a, b, c] = notes;
    let neume: Neume;
    switch (item.kind) {
      case 'punctum':
        if (notes.length !== 1 || !a)
          throw new Error('Punctum requires one note.');
        neume = { id: neumeId, kind: item.kind, notes: [a] };
        break;
      case 'podatus':
      case 'clivis':
        if (notes.length !== 2 || !a || !b)
          throw new Error('Two-note neume has invalid notes.');
        neume = { id: neumeId, kind: item.kind, notes: [a, b] };
        break;
      case 'scandicus':
      case 'torculus':
      case 'climacus':
      case 'porrectus':
        if (notes.length !== 3 || !a || !b || !c)
          throw new Error('Three-note neume has invalid notes.');
        neume = { id: neumeId, kind: item.kind, notes: [a, b, c] };
        break;
      default:
        throw new Error('Unsupported neume kind.');
    }
    if (!isValidNeume(neume))
      throw new Error('Neume pitches do not match its contour.');
    return neume;
  });
  const clef = record(source.clef);
  if (
    clef.type !== 'c' ||
    (clef.staffLine !== 1 &&
      clef.staffLine !== 2 &&
      clef.staffLine !== 3 &&
      clef.staffLine !== 4)
  )
    throw new Error('Expected a C clef on line 1–4.');
  const language = source.lyricLanguage;
  if (
    language !== 'la' &&
    language !== 'en' &&
    language !== 'el' &&
    language !== 'und'
  )
    throw new Error('Invalid lyric language.');
  const document: ChantDocument = {
    title: text(source.title, 'title', 200),
    lyricLanguage: language,
    clef: { type: 'c', staffLine: clef.staffLine },
    neumes,
    syllables: list(source.syllables).map((raw) => {
      const item = record(raw);
      if (
        item.boundaryBefore !== 'word' &&
        item.boundaryBefore !== 'continuation'
      )
        throw new Error('Invalid word boundary.');
      const alignment =
        item.alignment === undefined ? undefined : record(item.alignment);
      if (
        alignment &&
        (typeof alignment.start !== 'number' ||
          typeof alignment.end !== 'number')
      )
        throw new Error('Invalid alignment range.');
      return {
        id: id(item.id),
        text: text(item.text, 'syllable'),
        startsAtNeumeId: text(item.startsAtNeumeId, 'lyric anchor', 200),
        boundaryBefore: item.boundaryBefore,
        ...(alignment
          ? {
              alignment: {
                start: Number(alignment.start),
                end: Number(alignment.end),
              },
            }
          : {}),
      };
    }),
  };
  if (!document.title.trim()) throw new Error('A chant needs a title.');
  if (!hasValidLyricAnchors(document))
    throw new Error('Invalid syllable text, alignment, or lyric anchors.');
  return document;
}

export function serializeChant(document: ChantDocument): string {
  const result = JSON.stringify(
    {
      format: chantFileFormat,
      version: 1,
      document: validateChantDocument(document),
    },
    null,
    2,
  );
  if (new TextEncoder().encode(result).length > maxFileBytes)
    throw new Error('Document exceeds the 2 MB file limit.');
  return result;
}
export function parseChant(source: string): ChantDocument {
  if (new TextEncoder().encode(source).length > maxFileBytes)
    throw new Error('File exceeds the 2 MB limit.');
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('This is not valid JSON.');
  }
  const file = record(value);
  if (file.format !== chantFileFormat || file.version !== 1)
    throw new Error(
      'Unsupported chant format or version. Expected a version 1 chant file.',
    );
  return validateChantDocument(file.document);
}
export function createChant(): ChantDocument {
  return {
    title: 'Untitled chant',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    syllables: [],
    neumes: [],
  };
}
