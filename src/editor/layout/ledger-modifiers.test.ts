import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantNote,
  type Neume,
  type NoteAppearance,
} from '../domain/chant-document';
import { allowedNoteForms } from '../domain/note-forms';
import { moraChoices, moraIndexes } from '../domain/mora';
import { isValidNeume } from '../domain/neume';
import {
  createNeumeEntryPitches,
  entryLiquescence,
  semanticNeumeKind,
  type GraphicalNeumeKind,
} from '../neume-entry-pitches';
import { ledgerStrokesNear } from './ledger-lines';
import { buildNeumeGeometry } from './neume-geometry';
import { geometryKindFor } from './neumes/shared';

const bottom = 124;

/**
 * Stage 11A follow-up: every valid mark combination (each mora scope, every
 * subset of horizontally and of vertically episematized notes, with and
 * without an allowed form, filtered by isValidNeume) on every entry family,
 * at pitches that need ledgers on both sides of the staff. Authored marks must all survive, stay clear of
 * every ledger stroke, and vertical episema placement must not throw.
 */
const families: GraphicalNeumeKind[] = [
  'epiphonus',
  'cephalicus',
  'augmentative-pes',
  'scandicus',
  'scandicus-4',
  'scandicus-5',
  'climacus',
  'climacus-4',
  'climacus-5',
  'porrectus',
  'porrectus-flexus',
  'torculus-resupinus',
  'scandicus-flexus',
  'climacus-resupinus',
  'pes-subbipunctis',
  'pes-subtripunctis',
  'punctum',
  'podatus',
  'clivis',
  'torculus',
  'bistropha',
  'tristropha',
];

/** First pitches that put some or all notes on ledgers below or above. */
const firsts = [-9, -7, -5, -4, -3, -2, 6, 7, 8, 9, 11, 13];

/**
 * Five-note families have 1,024 episema × vertical-episema subsets per mora
 * scope; four representative first pitches (wholly below, straddling the
 * lower ledgers, straddling and wholly above the upper ones) keep the suite
 * fast. A one-off run over all twelve first pitches also passed (see the
 * verification record).
 */
const fiveNoteFirsts = [-7, -3, 8, 11];

function candidates(kind: GraphicalNeumeKind, first: number): Neume[] {
  const { staffPositions } = createNeumeEntryPitches(
    kind,
    staffPosition(first),
  );
  const semantic = semanticNeumeKind(kind);
  const liquescence = entryLiquescence(kind);
  const count = staffPositions.length;
  const result: Neume[] = [];
  for (const mora of moraChoices(semantic, count, liquescence))
    for (let episemaMask = 0; episemaMask < 1 << count; episemaMask++)
      for (let verticalMask = 0; verticalMask < 1 << count; verticalMask++)
        for (const withForm of [false, true]) {
          const moraed = moraIndexes(mora.value, count);
          const notes = staffPositions.map((position, index): ChantNote => {
            const form = withForm
              ? allowedNoteForms(semantic, index, count)[0]
              : undefined;
            return {
              id: `n${index}`,
              staffPosition: position,
              ...(form ? { form } : {}),
              ...(moraed.includes(index) ? { mora: 1 as const } : {}),
              ...(episemaMask & (1 << index) ? { episema: true as const } : {}),
              ...(verticalMask & (1 << index)
                ? { verticalEpisema: true as const }
                : {}),
            };
          });
          // The tuple shapes are checked by isValidNeume below.
          const neume = {
            id: 'n',
            kind: semantic,
            notes,
            ...(liquescence ? { liquescence } : {}),
          } as Neume;
          if (isValidNeume(neume)) result.push(neume);
        }
  return result;
}

function appearance(note: ChantNote): NoteAppearance {
  const { id: _id, staffPosition: _position, ...rest } = note;
  return rest;
}

describe('ledger-aware marks across families', () => {
  it.each(families)(
    '%s keeps every valid authored mark, clear of ledger strokes',
    (kind) => {
      let checked = 0;
      const count = createNeumeEntryPitches(kind, staffPosition(0))
        .staffPositions.length;
      for (const first of count === 5 ? fiveNoteFirsts : firsts)
        for (const neume of candidates(kind, first)) {
          const geometryKind = geometryKindFor(neume);
          const pitches = neume.notes.map((note) => note.staffPosition);
          const forms = neume.notes.map((note) =>
            note.form ? { form: note.form } : {},
          );
          const plain = buildNeumeGeometry(
            geometryKind,
            pitches,
            100,
            bottom,
            forms,
          );
          const label = `${kind} ${JSON.stringify(neume.notes)}`;
          let marked;
          try {
            marked = buildNeumeGeometry(
              geometryKind,
              pitches,
              100,
              bottom,
              neume.notes.map(appearance),
            );
          } catch (error) {
            throw new Error(`${label}: ${String(error)}`);
          }
          // Ledgers derive from pitches and forms alone, never from marks.
          expect(marked.ledgers, label).toEqual(plain.ledgers);
          const signs = marked.ink.slice(plain.ink.length);
          const expected = neume.notes.reduce(
            (total, note) =>
              total +
              (note.mora ? 1 : 0) +
              (note.episema ? 1 : 0) +
              (note.verticalEpisema ? 1 : 0),
            0,
          );
          expect(signs.length, label).toBe(expected);
          neume.notes.forEach((note, index) => {
            const own = note.mora || note.episema || note.verticalEpisema;
            expect(Boolean(marked.notes[index].modifierBounds), label).toBe(
              Boolean(own),
            );
          });
          for (const sign of signs)
            expect(
              ledgerStrokesNear(marked.ledgers ?? [], sign.bounds, 0),
              label,
            ).toEqual([]);
          checked++;
        }
      expect(checked).toBeGreaterThan(0);
    },
    30_000,
  );
});
