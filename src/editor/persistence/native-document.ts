import type {
  ChantDocument,
  ChantNote,
  Neume,
  LyricSyllable,
} from '../domain/chant-document';
import { staffPosition } from '../domain/chant-document';
import { isValidClef } from '../domain/clef';
import {
  hasValidDivisions,
  isValidDivision,
  isValidClefChange,
} from '../domain/divisions';
import { hasValidLyricAnchors } from '../domain/lyrics';
import { isValidNeume } from '../domain/neume';

export const maximumDocumentBytes = 1024 * 1024;
const format = 'gregorian-chant-editor';
function fail(message: string): never {
  throw new Error(message);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) fail('Expected a JSON object.');
  return value;
}
function shape(value: unknown, required: string[], optional: string[] = []) {
  const object = record(value);
  if (
    required.some((k) => !Object.hasOwn(object, k)) ||
    Object.keys(object).some((k) => ![...required, ...optional].includes(k))
  )
    fail(`Expected fields: ${required.join(', ')}.`);
  return object;
}
function string(value: unknown): string {
  return typeof value === 'string' ? value : fail('Expected text.');
}
function id(value: unknown): string {
  const result = string(value);
  return result.trim() ? result : fail('IDs must be nonblank.');
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : fail('Expected an array.');
}
function clef(value: unknown) {
  shape(value, ['type', 'staffLine']);
  return isValidClef(value)
    ? value
    : fail('Clefs require C/F and staff line 1–4.');
}
function note(value: unknown): ChantNote {
  const n = shape(value, ['id', 'staffPosition']);
  if (
    typeof n.staffPosition !== 'number' ||
    !Number.isSafeInteger(n.staffPosition)
  )
    fail('Note positions must be safe integers.');
  return { id: id(n.id), staffPosition: staffPosition(n.staffPosition) };
}
function neume(value: unknown): Neume {
  const n = shape(value, ['id', 'kind', 'notes']);
  const notes = array(n.notes).map(note);
  const [a, b, c] = notes;
  const identity = id(n.id);
  let result: Neume;
  switch (n.kind) {
    case 'punctum':
      if (notes.length !== 1 || !a) return fail('Punctum requires one note.');
      result = { id: identity, kind: n.kind, notes: [a] };
      break;
    case 'podatus':
    case 'clivis':
      if (notes.length !== 2 || !a || !b)
        return fail('Two-note neume requires two notes.');
      result = { id: identity, kind: n.kind, notes: [a, b] };
      break;
    case 'scandicus':
    case 'torculus':
    case 'climacus':
    case 'porrectus':
      if (notes.length !== 3 || !a || !b || !c)
        return fail('Three-note neume requires three notes.');
      result = { id: identity, kind: n.kind, notes: [a, b, c] };
      break;
    default:
      return fail('Unsupported neume kind.');
  }
  return isValidNeume(result) ? result : fail('Invalid neume pitch contour.');
}
function syllable(value: unknown): LyricSyllable {
  const s = shape(
    value,
    ['id', 'text', 'startsAtNeumeId', 'boundaryBefore'],
    ['alignment'],
  );
  if (s.boundaryBefore !== 'word' && s.boundaryBefore !== 'continuation')
    fail('Invalid lyric boundary.');
  const result: LyricSyllable = {
    id: id(s.id),
    text: string(s.text),
    startsAtNeumeId: id(s.startsAtNeumeId),
    boundaryBefore: s.boundaryBefore,
  };
  if (Object.hasOwn(s, 'alignment')) {
    const a = shape(s.alignment, ['start', 'end']);
    if (typeof a.start !== 'number' || typeof a.end !== 'number')
      fail('Alignment requires grapheme indexes.');
    result.alignment = { start: a.start, end: a.end };
  }
  return result;
}
export function validateDocument(value: unknown): ChantDocument {
  const d = shape(value, [
    'title',
    'lyricLanguage',
    'clef',
    'neumes',
    'syllables',
    'divisions',
    'clefChanges',
  ]);
  if (
    d.lyricLanguage !== 'la' &&
    d.lyricLanguage !== 'en' &&
    d.lyricLanguage !== 'el' &&
    d.lyricLanguage !== 'und'
  )
    fail('Unsupported lyric language.');
  const document: ChantDocument = {
    title: string(d.title),
    lyricLanguage: d.lyricLanguage,
    clef: clef(d.clef),
    neumes: array(d.neumes).map(neume),
    syllables: array(d.syllables).map(syllable),
    divisions: array(d.divisions).map((value) => {
      shape(value, ['id', 'kind', 'beforeNeumeId']);
      return isValidDivision(value) ? value : fail('Invalid division.');
    }),
    clefChanges: array(d.clefChanges).map((value) => {
      const c = shape(value, [
        'id',
        'clef',
        'beforeNeumeId',
        'beforeDivisionId',
      ]);
      clef(c.clef);
      return isValidClefChange(value) ? value : fail('Invalid clef change.');
    }),
  };
  if (!hasValidLyricAnchors(document))
    fail('Invalid lyric text, anchor order, boundary or alignment.');
  if (!hasValidDivisions(document))
    fail('Duplicate IDs or invalid division/clef slot anchors.');
  return document;
}
export function decodeDocument(text: string): ChantDocument {
  if (
    text.length > maximumDocumentBytes ||
    new TextEncoder().encode(text).length > maximumDocumentBytes
  )
    fail('Document exceeds the 1 MiB limit.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail('Invalid JSON. Choose an intact .chant.json file.');
  }
  const envelope = shape(value, ['format', 'version', 'document']);
  if (envelope.format !== format)
    fail('This is not a Gregorian Chant Editor file.');
  if (envelope.version !== 1)
    fail('Unsupported schema version. This editor reads version 1 only.');
  return validateDocument(envelope.document);
}
export function encodeDocument(document: ChantDocument): string {
  const text = JSON.stringify(
    { format, version: 1, document: validateDocument(document) },
    null,
    2,
  );
  decodeDocument(text);
  return text;
}
export function documentFilename(title: string): string {
  return `${
    title
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N} -]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'untitled'
  }.chant.json`;
}
export function blankDocument(): ChantDocument {
  return {
    title: 'Untitled chant',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: [],
    syllables: [],
    divisions: [],
    clefChanges: [],
  };
}
