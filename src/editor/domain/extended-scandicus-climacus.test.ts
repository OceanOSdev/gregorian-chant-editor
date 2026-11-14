import { describe, expect, it } from 'vitest';
import {
  monotonicNotes,
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
} from './chant-document';
import { isValidNeume, neumeDisplayName } from './neume';
import { getMoraScope, moraChoices, moraIndexes } from './mora';
import { allowedNoteForms } from './note-forms';
import { resolveEffectivePitches } from './accidentals';
import { deriveScoreOrder, scoreBoundaryAt } from './divisions';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
} from '../persistence/native-document';
import { BrowserDocument } from '../persistence/browser-document';
import { deleteNote } from '../commands/delete-note';
import { deleteNeume } from '../commands/delete-neume';
import { moveNoteVertically } from '../commands/move-note';
import { moveNeumeVertically } from '../commands/move-neume';
import {
  updateMoraScope,
  updateNoteModifiers,
} from '../commands/update-note-modifiers';
import { updateNoteForm } from '../commands/update-note-form';
import { updateAccidental } from '../commands/update-accidental';
import { updateClef } from '../commands/update-clef';
import {
  createEditorSession,
  entryName,
  reduceEditorSession,
} from '../state/editor-session';
import { allocateInsertionIds } from '../interaction/allocate-insertion-ids';
import {
  insertEditorNeume,
  resolveEditorToolbarInsertion,
} from '../interaction/insert-editor-neume';
import { getGraphicalNeumeKind } from '../interaction/get-graphical-neume-kind';
import {
  createNeumeEntryPitches,
  entryNeumeKind,
  semanticNeumeKind,
} from '../neume-entry-pitches';
import {
  climacusFamily,
  entryNoteCount,
  scandicusFamily,
} from '../state/editor-tool';
import { clearSelection, selectNote } from '../state/selection';
import {
  getNoteAccessibleLabel,
  getSelectedNeumeDescription,
} from '../rendering/note-accessible-label';

const kinds = ['scandicus', 'climacus'] as const;
type Kind = (typeof kinds)[number];

/** Independent oracle: three to five notes, each strictly above/below. */
function oracle(kind: Kind, pitches: readonly number[]): boolean {
  if (pitches.length < 3 || pitches.length > 5) return false;
  for (let i = 1; i < pitches.length; i++)
    if (
      kind === 'scandicus'
        ? !(pitches[i - 1] < pitches[i])
        : !(pitches[i - 1] > pitches[i])
    )
      return false;
  return true;
}
function notes(pitches: readonly number[], prefix = 'n'): ChantNote[] {
  return pitches.map((p, i) => ({
    id: prefix + i,
    staffPosition: staffPosition(p),
  }));
}
function group(
  kind: Kind,
  pitches: readonly number[],
  id = 'g',
  prefix = 'n',
): Neume {
  const tuple = monotonicNotes(notes(pitches, prefix));
  if (!tuple) throw Error('fixture needs three to five notes');
  return { id, kind, notes: tuple };
}
function fixture(kind: Kind, pitches: readonly number[]): ChantDocument {
  return {
    ...blankDocument(),
    clef: { type: 'c', staffLine: 4 },
    neumes: [group(kind, pitches)],
    syllables: [
      { id: 's', text: 'ste', boundaryBefore: 'word', startsAtNeumeId: 'g' },
    ],
    divisions: [{ id: 'd', kind: 'minor', beforeNeumeId: 'g' }],
    clefChanges: [],
  };
}
function* tuples(length: number, low = -1, high = 4): Generator<number[]> {
  if (length === 0) {
    yield [];
    return;
  }
  for (const rest of tuples(length - 1, low, high))
    for (let p = low; p <= high; p++) yield [...rest, p];
}
const representative = {
  scandicus: [
    [2, 3, 4, 5],
    [2, 3, 4, 6],
    [0, 2, 3, 6],
    [1, 2, 3, 4, 6],
    [-1, 1, 2, 4, 7],
  ],
  climacus: [
    [5, 4, 3, 2],
    [6, 5, 4, 3],
    [7, 4, 3, 1],
    [6, 5, 4, 3, 2],
    [8, 5, 4, 2, -1],
  ],
} as const;

describe('bounded Scandicus/Climacus tuples (ADR 0024)', () => {
  it.each(kinds)(
    '%s accepts exactly three-, four- and five-note strict contours',
    (kind) => {
      let checked = 0;
      for (const length of [2, 3, 4, 5, 6])
        for (const pitches of tuples(length)) {
          const candidate = {
            id: 'g',
            kind,
            notes: notes(pitches),
          } as unknown as Neume;
          expect(isValidNeume(candidate)).toBe(oracle(kind, pitches));
          checked++;
        }
      expect(checked).toBe(6 ** 2 + 6 ** 3 + 6 ** 4 + 6 ** 5 + 6 ** 6);
      // Sparse runtime tuples are rejected rather than iterated past.
      for (const pitches of [
        representative[kind][0].slice(0, 3),
        representative[kind][0],
        representative[kind][3],
      ]) {
        const candidate = group(kind, pitches);
        const holes = [...candidate.notes];
        Reflect.deleteProperty(holes, '1');
        const sparse = { ...candidate, notes: holes } as unknown as Neume;
        expect(isValidNeume(sparse)).toBe(false);
      }
    },
  );

  it('constructs the bounded tuple only from exactly three to five notes', () => {
    for (const length of [0, 1, 2, 6, 7])
      expect(monotonicNotes(notes([...Array(length).keys()]))).toBeNull();
    for (const length of [3, 4, 5]) {
      const source = notes([...Array(length).keys()]);
      const tuple = monotonicNotes(source);
      expect(tuple).toHaveLength(length);
      tuple?.forEach((note, i) => expect(note).toBe(source[i]));
    }
  });

  it('names groups from their actual cardinality without a stored count', () => {
    for (const kind of kinds) {
      expect(neumeDisplayName(kind, 3)).toBe(kind);
      expect(neumeDisplayName(kind, 4)).toBe(`four-note ${kind}`);
      expect(neumeDisplayName(kind, 5)).toBe(`five-note ${kind}`);
      expect(entryNeumeKind(kind, 3)).toBe(kind);
      expect(entryNeumeKind(kind, 4)).toBe(`${kind}-4`);
      expect(entryNeumeKind(kind, 5)).toBe(`${kind}-5`);
      expect(semanticNeumeKind(`${kind}-4`)).toBe(kind);
      expect(semanticNeumeKind(`${kind}-5`)).toBe(kind);
      expect(getNoteAccessibleLabel(kind, 3, 4)).toBe(
        `Select fourth note of four-note ${kind}`,
      );
      expect(getNoteAccessibleLabel(kind, 4, 5)).toBe(
        `Select fifth note of five-note ${kind}`,
      );
      expect(getSelectedNeumeDescription(kind, true, 5)).toContain(
        `Whole five-note ${kind} selected`,
      );
      // Ordinary three-note labels are unchanged.
      expect(getNoteAccessibleLabel(kind, 1, 3)).toBe(
        `Select middle note of ${kind}`,
      );
      for (const length of [4, 5]) {
        const doc = fixture(kind, representative[kind][length === 4 ? 0 : 3]);
        expect(Object.keys(doc.neumes[0]).sort()).toEqual([
          'id',
          'kind',
          'notes',
        ]);
      }
    }
    expect(entryName('scandicus-4')).toBe('Scandicus (4 notes)');
    expect(entryName('climacus-5')).toBe('Climacus (5 notes)');
    expect(entryName('scandicus')).toBe('Scandicus');
    expect(entryName('scandicus', 'quilisma')).toBe('Quilisma Scandicus');
  });
});

describe('count-aware forms and mora', () => {
  it('keeps the three-note quilisma and rejects every authored form on longer groups', () => {
    expect(allowedNoteForms('scandicus', 1, 3)).toEqual(['quilisma']);
    for (const count of [4, 5])
      for (let i = 0; i < count; i++) {
        expect(allowedNoteForms('scandicus', i, count)).toEqual([]);
        expect(allowedNoteForms('climacus', i, count)).toEqual([]);
      }
    const three = fixture('scandicus', [2, 3, 5]);
    expect(
      updateNoteForm(three, 'n1', 'quilisma').neumes[0].notes.at(1)?.form,
    ).toBe('quilisma');
    for (const kind of kinds)
      for (const pitches of representative[kind]) {
        const doc = fixture(kind, pitches);
        for (let i = 0; i < pitches.length; i++)
          for (const form of ['virga', 'inclinatum', 'quilisma'] as const)
            expect(updateNoteForm(doc, 'n' + i, form)).toBe(doc);
        const forged = structuredClone(doc);
        const forgedNote = forged.neumes[0].notes.at(1);
        if (forgedNote) forgedNote.form = 'quilisma';
        expect(isValidNeume(forged.neumes[0])).toBe(false);
      }
  });

  it('keeps the three-note matrix and provisionally allows only none on longer groups', () => {
    for (const kind of kinds) {
      expect(moraChoices(kind, 3).map((c) => c.value)).toEqual([
        'none',
        'final',
        'final-two',
      ]);
      for (const count of [4, 5])
        expect(moraChoices(kind, count)).toEqual([
          { value: 'none', label: 'None' },
        ]);
      for (const pitches of representative[kind]) {
        const doc = fixture(kind, pitches);
        // Every nonempty subset is rejected by validation, commands and decoding.
        for (let mask = 1; mask < 2 ** pitches.length; mask++) {
          const copy = structuredClone(doc);
          copy.neumes[0].notes.forEach((n, i) => {
            if (mask & (1 << i)) n.mora = 1;
          });
          expect(getMoraScope(copy.neumes[0])).toBeNull();
          expect(isValidNeume(copy.neumes[0])).toBe(false);
          expect(() => decodeDocument(encodeDocument(copy))).toThrow();
        }
        for (const scope of ['final', 'final-two', 'sole', 'both'] as const)
          expect(updateMoraScope(doc, 'g', scope)).toBe(doc);
        for (let i = 0; i < pitches.length; i++)
          expect(
            updateNoteModifiers(doc, 'n' + i, { kind: 'mora', value: 1 }),
          ).toBe(doc);
        expect(getMoraScope(doc.neumes[0])).toBe('none');
        expect(moraIndexes('final', pitches.length)).toEqual([
          pitches.length - 1,
        ]);
      }
    }
  });

  it('authors independent horizontal and vertical episemata on every constituent', () => {
    for (const kind of kinds)
      for (const pitches of representative[kind]) {
        let doc = fixture(kind, pitches);
        for (let i = 0; i < pitches.length; i++)
          for (const sign of ['episema', 'verticalEpisema'] as const) {
            const next = updateNoteModifiers(doc, 'n' + i, {
              kind: sign,
              value: true,
            });
            expect(next).not.toBe(doc);
            expect(next.neumes[0].notes[i][sign]).toBe(true);
            doc = next;
          }
        expect(doc.neumes[0].notes).toHaveLength(pitches.length);
        expect(decodeDocument(encodeDocument(doc))).toEqual(doc);
      }
  });
});

describe('extended group editing', () => {
  it.each(kinds)(
    '%s moves single notes only while strictly monotonic and transposes whole groups with stable IDs',
    (kind) => {
      let accepted = 0;
      let rejected = 0;
      for (const length of [4, 5])
        for (const pitches of tuples(length, -1, 6)) {
          if (!oracle(kind, pitches)) continue;
          const doc = fixture(kind, pitches);
          pitches.forEach((_, index) => {
            for (const delta of [-1, 1] as const) {
              const moved = pitches.map((p, i) =>
                i === index ? p + delta : p,
              );
              const result = moveNoteVertically(doc, 'n' + index, delta);
              if (!oracle(kind, moved)) {
                expect(result).toBe(doc);
                rejected++;
                continue;
              }
              accepted++;
              const neume = result.neumes[0];
              expect(neume.kind).toBe(kind);
              expect(neume.id).toBe('g');
              expect(neume.notes.map((n) => n.staffPosition)).toEqual(moved);
              expect(neume.notes.map((n) => n.id)).toEqual(
                doc.neumes[0].notes.map((n) => n.id),
              );
              neume.notes.forEach((n, i) => {
                if (i !== index) expect(n).toBe(doc.neumes[0].notes[i]);
              });
            }
          });
          const transposed = moveNeumeVertically(doc, 'g', -2).neumes[0];
          expect(transposed.notes.map((n) => n.staffPosition)).toEqual(
            pitches.map((p) => p - 2),
          );
          expect(transposed.notes.map((n) => n.id)).toEqual(
            doc.neumes[0].notes.map((n) => n.id),
          );
        }
      expect(accepted).toBeGreaterThan(0);
      expect(rejected).toBeGreaterThan(0);
    },
  );

  it.each(kinds)(
    '%s keeps its family from five to four and four to three, then uses the established three-note rule',
    (kind) => {
      for (const length of [4, 5])
        for (const pitches of tuples(length, -1, 6)) {
          if (!oracle(kind, pitches)) continue;
          const doc = fixture(kind, pitches);
          pitches.forEach((_, index) => {
            const result = deleteNote(doc, 'n' + index);
            const neume = result.neumes[0];
            expect(neume.id).toBe('g');
            expect(neume.kind).toBe(kind);
            expect(neume.notes).toHaveLength(length - 1);
            neume.notes.forEach((n) =>
              expect(n).toBe(doc.neumes[0].notes.find((o) => o.id === n.id)),
            );
            expect(neume.notes.map((n) => n.id)).toEqual(
              doc.neumes[0].notes
                .filter((_, i) => i !== index)
                .map((n) => n.id),
            );
            expect(result.syllables).toBe(doc.syllables);
            expect(result.divisions).toEqual(doc.divisions);
            expect(isValidNeume(neume)).toBe(true);
          });
        }
      // Three to two is unchanged: Podatus or Clivis with stable IDs.
      const three = fixture(kind, kind === 'scandicus' ? [2, 3, 4] : [4, 3, 2]);
      const two = deleteNote(three, 'n1').neumes[0];
      expect(two.kind).toBe(kind === 'scandicus' ? 'podatus' : 'clivis');
      expect(two.notes.map((n) => n.id)).toEqual(['n0', 'n2']);
      // Surviving marks stay on their own notes, never transferred.
      const five = fixture(kind, representative[kind][3]);
      const marked = updateNoteModifiers(
        updateNoteModifiers(five, 'n4', { kind: 'episema', value: true }),
        'n2',
        { kind: 'verticalEpisema', value: true },
      );
      const earlier = deleteNote(marked, 'n0').neumes[0];
      expect(earlier.notes.find((n) => n.id === 'n4')?.episema).toBe(true);
      expect(earlier.notes.find((n) => n.id === 'n2')?.verticalEpisema).toBe(
        true,
      );
      const markedRemoved = deleteNote(marked, 'n4').neumes[0];
      expect(markedRemoved.notes.some((n) => n.episema)).toBe(false);
      expect(deleteNeume(marked, 'g').neumes).toEqual([]);
    },
  );

  it('keeps the accepted Pes subtripunctis rejection when four descending notes would remain (amendment pending owner approval)', () => {
    const tuple = notes([2, 5, 4, 3, 2]);
    const [a, b, c, d, e] = tuple;
    const pes: ChantDocument = {
      ...blankDocument(),
      neumes: [{ id: 'g', kind: 'pes-subpunctis', notes: [a, b, c, d, e] }],
    };
    expect(deleteNote(pes, 'n0')).toBe(pes);
  });

  it('preserves ADR 0021 B ownership on later constituents, owner deletion and clef changes', () => {
    // C clef on line 4: staff position 5 is B.
    const base = fixture('scandicus', [2, 3, 4, 5, 6]);
    const signed = updateAccidental(base, 'n3', 'flat', 'a');
    expect(signed.accidentals).toEqual([
      { id: 'a', kind: 'flat', ownerNoteId: 'n3' },
    ]);
    const altered = () =>
      [...(resolveEffectivePitches(signed)?.values() ?? [])].filter(
        (p) => p.alteration !== 0,
      );
    expect(altered()).toHaveLength(1);
    expect(deleteNote(signed, 'n0').accidentals).toEqual(signed.accidentals);
    const ownerDeleted = deleteNote(signed, 'n3');
    expect(ownerDeleted.neumes[0].kind).toBe('scandicus');
    expect(ownerDeleted.accidentals).toEqual([]);
    const changed = updateClef(signed, { type: 'f', staffLine: 2 });
    expect(changed.accidentals).toEqual(signed.accidentals);
    const climacus = fixture('climacus', [6, 5, 4, 3]);
    expect(updateAccidental(climacus, 'n1', 'flat', 'b').accidentals).toEqual([
      { id: 'b', kind: 'flat', ownerNoteId: 'n1' },
    ]);
  });
});

describe('native v8 persistence', () => {
  it.each(kinds)(
    '%s round trips four and five notes and rejects them under every exact v1–v7 reader without touching cache bytes',
    (kind) => {
      for (const pitches of representative[kind]) {
        const doc = fixture(kind, pitches);
        const text = encodeDocument(doc);
        expect(JSON.parse(text).version).toBe(8);
        expect(decodeDocument(text)).toEqual(doc);
        for (const version of [1, 2, 3, 4, 5, 6, 7]) {
          const payload = JSON.parse(text);
          payload.version = version;
          if (version < 5) delete payload.document.accidentals;
          const original = JSON.stringify(payload);
          expect(() => decodeDocument(original)).toThrow(/three notes/);
          // The same old kind with three notes still reads under that version.
          const legacy = structuredClone(payload);
          legacy.document.neumes[0].notes.length = 3;
          expect(decodeDocument(JSON.stringify(legacy)).neumes[0].kind).toBe(
            kind,
          );
          let bytes = original;
          let writes = 0;
          const adapter = new BrowserDocument(() => ({
            getItem: () => bytes,
            setItem: (_key, value) => {
              writes++;
              bytes = value;
            },
          }));
          const fallback = blankDocument();
          expect(adapter.load(fallback)).toBe(fallback);
          adapter.save(doc);
          expect(bytes).toBe(original);
          expect(writes).toBe(0);
          expect(adapter.recoverySource).toBe(original);
        }
      }
    },
  );

  it.each(kinds)(
    '%s rejects malformed tuples, contours, forms, mora, extra fields, variant kinds and unknown versions',
    (kind) => {
      const doc = fixture(kind, representative[kind][3]);
      const good = JSON.parse(encodeDocument(doc));
      const mutations: ((p: typeof good) => void)[] = [
        (p) => p.document.neumes[0].notes.splice(1, 3),
        (p) =>
          p.document.neumes[0].notes.push({
            id: 'n5',
            staffPosition: kind === 'scandicus' ? 9 : -5,
          }),
        (p) => (p.document.neumes[0].notes[2].staffPosition = 0),
        (p) =>
          (p.document.neumes[0].notes[3].staffPosition =
            p.document.neumes[0].notes[2].staffPosition),
        (p) => (p.document.neumes[0].notes[3].id = 'n2'),
        (p) => (p.document.neumes[0].notes[1].form = 'quilisma'),
        (p) => (p.document.neumes[0].notes[4].mora = 1),
        (p) => {
          p.document.neumes[0].notes[3].mora = 1;
          p.document.neumes[0].notes[4].mora = 1;
        },
        (p) => (p.document.neumes[0].count = 5),
        (p) => (p.document.neumes[0].kind = `${kind}-5`),
        (p) => (p.version = 9),
      ];
      for (const change of mutations) {
        const value = structuredClone(good);
        change(value);
        expect(() => decodeDocument(JSON.stringify(value))).toThrow();
      }
      expect(decodeDocument(JSON.stringify(good))).toEqual(doc);
      // Existing three-note forms and morae still round trip in v8.
      const three = updateMoraScope(
        updateNoteForm(fixture('scandicus', [2, 3, 5]), 'n1', 'quilisma'),
        'g',
        'final-two',
      );
      expect(getMoraScope(three.neumes[0])).toBe('final-two');
      expect(decodeDocument(encodeDocument(three))).toEqual(three);
    },
  );
});

describe('extended entry', () => {
  it('exposes the ordinary member first and exact four/five-note variants', () => {
    expect(scandicusFamily).toEqual([
      'scandicus',
      'scandicus-4',
      'scandicus-5',
    ]);
    expect(climacusFamily).toEqual(['climacus', 'climacus-4', 'climacus-5']);
    for (const kind of kinds) {
      expect(entryNoteCount(kind)).toBe(3);
      expect(entryNoteCount(`${kind}-4`)).toBe(4);
      expect(entryNoteCount(`${kind}-5`)).toBe(5);
      const sign = kind === 'scandicus' ? 1 : -1;
      expect(
        createNeumeEntryPitches(`${kind}-5`, staffPosition(2)).staffPositions,
      ).toEqual([0, 1, 2, 3, 4].map((i) => 2 + sign * i));
    }
  });

  it('inserts the exact entry count with supplied IDs at every mixed-event boundary and rejects insufficient or duplicate IDs', () => {
    const doc: ChantDocument = {
      ...blankDocument(),
      neumes: [
        group('scandicus', [1, 2, 3, 4], 'x', 'x'),
        group('climacus', [5, 4, 3, 2, 1], 'y', 'y'),
      ],
      syllables: [
        { id: 's', text: 'A', boundaryBefore: 'word', startsAtNeumeId: 'x' },
      ],
      divisions: [{ id: 'd', kind: 'minor', beforeNeumeId: 'y' }],
      clefChanges: [
        {
          id: 'c',
          clef: { type: 'f', staffLine: 3 },
          beforeNeumeId: 'y',
          beforeDivisionId: null,
        },
      ],
    };
    const order = deriveScoreOrder(doc);
    if (!order) throw Error('order');
    for (const kind of [
      'scandicus-4',
      'scandicus-5',
      'climacus-4',
      'climacus-5',
    ] as const)
      for (let slot = 0; slot <= order.length; slot++) {
        const insertion = {
          ...createNeumeEntryPitches(kind, staffPosition(2)),
          boundary: scoreBoundaryAt(order, slot),
          insertionIndex: 0,
        };
        const ids = {
          neumeId: 'new',
          noteIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
        } as const;
        const inserted = insertEditorNeume(doc, insertion, ids);
        const added = inserted.neumes.find((n) => n.id === 'new');
        expect(added?.kind).toBe(semanticNeumeKind(kind));
        expect(added?.notes.map((n) => n.id)).toEqual(
          ids.noteIds.slice(0, entryNoteCount(kind)),
        );
        expect(deriveScoreOrder(inserted)?.map((i) => i.entity.id)).toEqual([
          ...order.slice(0, slot).map((i) => i.entity.id),
          'new',
          ...order.slice(slot).map((i) => i.entity.id),
        ]);
        expect(deleteNeume(inserted, 'new')).toEqual(doc);
        expect(
          insertEditorNeume(doc, insertion, {
            neumeId: 'new',
            noteIds: ['p1', 'p2', 'p3'],
          }),
        ).toBe(doc);
        expect(
          insertEditorNeume(doc, insertion, {
            neumeId: 'new',
            noteIds: ['p1', 'p2', 'p3', 'p1', 'p5'],
          }),
        ).toBe(doc);
        expect(
          insertEditorNeume(doc, insertion, {
            neumeId: 'new',
            noteIds: ['p1', 'p2', 'x0', 'p4', 'p5'],
          }),
        ).toBe(doc);
      }
    const ids = allocateInsertionIds();
    expect(new Set([ids.neumeId, ...ids.noteIds]).size).toBe(6);
  });

  it.each(kinds)(
    'arms exact %s variants, recalls them with I/T, resets with the primary and announces rejected edits',
    (kind) => {
      for (const variant of [`${kind}-4`, `${kind}-5`] as const) {
        let state = createEditorSession(fixture(kind, representative[kind][0]));
        const clean = state.history;
        state = reduceEditorSession(state, {
          type: 'arm',
          tool: { kind: `place-${variant}` },
        });
        expect(getGraphicalNeumeKind(state.activeTool)).toBe(variant);
        expect(state.announcement.text).toBe(
          `Placing ${kind[0].toUpperCase()}${kind.slice(1)} (${variant.at(-1)} notes).`,
        );
        state = reduceEditorSession(state, { type: 'select-tool' });
        state = reduceEditorSession(state, { type: 'focus-palette' });
        expect(state.history).toBe(clean);
        expect(state.rememberedKind).toBe(variant);
        expect(state.focusRequest).toEqual({
          kind: 'palette',
          tool: `${kind}-menu`,
        });
        state = reduceEditorSession(state, {
          type: 'select',
          selection: selectNote('n1'),
        });
        const inserted = reduceEditorSession(state, {
          type: 'insert',
          ids: { neumeId: 'new', noteIds: ['p1', 'p2', 'p3', 'p4', 'p5'] },
        });
        const added = inserted.history.present.neumes;
        expect(added.map((n) => n.id)).toEqual(['g', 'new']);
        expect(added[1].kind).toBe(kind);
        expect(added[1].notes).toHaveLength(entryNoteCount(variant));
        expect(
          resolveEditorToolbarInsertion(
            fixture(kind, representative[kind][0]),
            clearSelection(),
            variant,
          )?.kind,
        ).toBe(variant);
      }
      // The primary re-arms the ordinary default-form figure.
      let state = createEditorSession(blankDocument());
      state = reduceEditorSession(state, {
        type: 'arm',
        tool: { kind: `place-${kind}-5` },
      });
      state = reduceEditorSession(state, {
        type: 'arm',
        tool: { kind: `place-${kind}` },
      });
      expect(state.rememberedKind).toBe(kind);
      expect(state.rememberedForm).toBeUndefined();
      expect(
        reduceEditorSession(state, { type: 'focus-palette' }).focusRequest,
      ).toEqual({ kind: 'palette', tool: kind });

      const doc = fixture(kind, representative[kind][3]);
      const session = createEditorSession(doc);
      // Moving the first note onto its neighbour breaks the strict contour.
      const move = reduceEditorSession(session, {
        type: 'edit',
        noteMoveId: 'n0',
        focusNoteId: 'n0',
        edit: (d) => moveNoteVertically(d, 'n0', kind === 'scandicus' ? 1 : -1),
      });
      expect(move.history).toBe(session.history);
      expect(move.announcement.text).toContain(
        `five-note ${kind} must be strictly`,
      );
      const accepted = reduceEditorSession(session, {
        type: 'edit',
        formDeletionNoteId: 'n2',
        edit: (d) => deleteNote(d, 'n2'),
      });
      expect(accepted.history.present.neumes[0].notes).toHaveLength(4);
      const undone = reduceEditorSession(accepted, {
        type: 'history',
        direction: 'undo',
        focusedNoteId: null,
      });
      expect(undone.history.present).toBe(doc);
      expect(
        reduceEditorSession(undone, {
          type: 'history',
          direction: 'redo',
          focusedNoteId: null,
        }).history.present,
      ).toBe(accepted.history.present);
    },
  );
});
