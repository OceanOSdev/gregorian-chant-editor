import { describe, expect, it } from 'vitest';
import {
  pesSubpunctisNotes,
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
} from './chant-document';
import { isValidNeume, neumeDisplayName } from './neume';
import {
  getMoraScope,
  moraChoices,
  moraIndexes,
  resolveMoraScope,
  type MoraScope,
} from './mora';
import { resolveEffectivePitches } from './accidentals';
import { deriveScoreOrder, scoreBoundaryAt } from './divisions';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
} from '../persistence/native-document';
import { BrowserDocument } from '../persistence/browser-document';
import { insertNeume } from '../commands/insert-neume';
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
import { entryNoteCount } from '../state/editor-tool';
import { clearSelection, selectNote } from '../state/selection';
import {
  getNoteAccessibleLabel,
  getSelectedNeumeDescription,
} from '../rendering/note-accessible-label';

/** Independent oracle for the documented contour: p0 < p1 > p2 > p3 (> p4). */
function oracle(pitches: readonly number[]): boolean {
  if (pitches.length !== 4 && pitches.length !== 5) return false;
  if (!(pitches[0] < pitches[1])) return false;
  for (let i = 2; i < pitches.length; i++)
    if (!(pitches[i] < pitches[i - 1])) return false;
  return true;
}
function notes(pitches: readonly number[], prefix = 'n'): ChantNote[] {
  return pitches.map((p, i) => ({
    id: prefix + i,
    staffPosition: staffPosition(p),
  }));
}
function group(pitches: readonly number[], id = 'g', prefix = 'n'): Neume {
  const tuple = pesSubpunctisNotes(notes(pitches, prefix));
  if (!tuple) throw Error('fixture needs four or five notes');
  return { id, kind: 'pes-subpunctis', notes: tuple };
}
function fixture(pitches: readonly number[]): ChantDocument {
  return {
    ...blankDocument(),
    clef: { type: 'c', staffLine: 4 },
    neumes: [group(pitches)],
    syllables: [
      { id: 's', text: 'ste', boundaryBefore: 'word', startsAtNeumeId: 'g' },
    ],
    divisions: [{ id: 'd', kind: 'minor', beforeNeumeId: 'g' }],
    clefChanges: [],
  };
}
function envelope(document: unknown, version: number) {
  return JSON.stringify({
    format: 'gregorian-chant-editor',
    version,
    document,
  });
}
function* tuples(length: number, low = -1, high = 4): Generator<number[]> {
  if (length === 0) {
    yield [];
    return;
  }
  for (const rest of tuples(length - 1, low, high))
    for (let p = low; p <= high; p++) yield [...rest, p];
}
const kyrie = {
  // Kyrie XI Christe, GABC jkJH'G (c4): ictus on H.
  christe: [6, 7, 6, 4, 3],
  // Kyrie XI final Kyrie, GABC fgFD'C (c4): ictus on D.
  last: [2, 3, 2, 0, -1],
};

describe('pes subpunctis semantic family', () => {
  it('accepts exactly the documented four/five-note contours, including tails crossing the first pitch', () => {
    let checked = 0;
    for (const length of [4, 5])
      for (const pitches of tuples(length)) {
        const candidate = {
          id: 'g',
          kind: 'pes-subpunctis',
          notes: notes(pitches),
        } as unknown as Neume;
        expect(isValidNeume(candidate)).toBe(oracle(pitches));
        checked++;
      }
    expect(checked).toBe(6 ** 4 + 6 ** 5);
    for (const valid of [
      [2, 4, 3, 2],
      [2, 4, 3, 1],
      [2, 5, 4, 3],
      [2, 4, 3, 2, 1],
      [0, 5, 4, 3, 2],
      kyrie.christe,
      kyrie.last,
    ])
      expect(isValidNeume(group(valid))).toBe(true);
    for (const length of [0, 1, 2, 3, 6, 7])
      expect(
        isValidNeume({
          id: 'g',
          kind: 'pes-subpunctis',
          notes: notes([2, 4, 3, 2, 1, 0, -1].slice(0, length)),
        } as unknown as Neume),
      ).toBe(false);
    expect(pesSubpunctisNotes(notes([2, 4, 3]))).toBeNull();
    expect(pesSubpunctisNotes(notes([2, 4, 3, 2, 1, 0]))).toBeNull();
  });

  it('names the family from its actual cardinality without a stored count', () => {
    expect(neumeDisplayName('pes-subpunctis', 4)).toBe('pes subbipunctis');
    expect(neumeDisplayName('pes-subpunctis', 5)).toBe('pes subtripunctis');
    expect(neumeDisplayName('torculus', 3)).toBe('torculus');
    expect(Object.keys(group([2, 4, 3, 2]))).toEqual(['id', 'kind', 'notes']);
    expect(getNoteAccessibleLabel('pes-subpunctis', 3, 5)).toBe(
      'Select fourth note of pes subtripunctis',
    );
    expect(getSelectedNeumeDescription('pes-subpunctis', true, 4)).toContain(
      'Whole pes subbipunctis selected',
    );
    expect(semanticNeumeKind('pes-subbipunctis')).toBe('pes-subpunctis');
    expect(semanticNeumeKind('pes-subtripunctis')).toBe('pes-subpunctis');
    expect(entryNeumeKind('pes-subpunctis', 4)).toBe('pes-subbipunctis');
    expect(entryNeumeKind('pes-subpunctis', 5)).toBe('pes-subtripunctis');
    expect(entryNoteCount('pes-subbipunctis')).toBe(4);
    expect(entryNoteCount('pes-subtripunctis')).toBe(5);
    expect(
      createNeumeEntryPitches('pes-subbipunctis', staffPosition(2))
        .staffPositions,
    ).toEqual([2, 4, 3, 2]);
    expect(
      createNeumeEntryPitches('pes-subtripunctis', staffPosition(2))
        .staffPositions,
    ).toEqual([2, 5, 4, 3, 2]);
  });

  it('allows exactly none or a final-note mora, derived from the actual tuple length', () => {
    expect(moraChoices('pes-subpunctis')).toEqual([
      { value: 'none', label: 'None' },
      { value: 'final', label: 'Final note' },
    ]);
    expect(moraIndexes('final', 3)).toEqual([2]);
    expect(moraIndexes('final-two', 3)).toEqual([1, 2]);
    expect(moraIndexes('final', 4)).toEqual([3]);
    expect(moraIndexes('final', 5)).toEqual([4]);
    expect(moraIndexes('final-two', 4)).toEqual([2, 3]);
    for (const kind of [
      'scandicus',
      'torculus',
      'climacus',
      'porrectus',
    ] as const)
      expect(moraChoices(kind).map((c) => c.value)).toEqual([
        'none',
        'final',
        'final-two',
      ]);
    for (const pitches of [[2, 4, 3, 2], kyrie.christe, [2, 5, 4, 3, 2]]) {
      const doc = fixture(pitches);
      const last = pitches.length - 1;
      const finalMask = 1 << last;
      // Independent of moraChoices: only the empty set and the last note.
      for (let mask = 0; mask < 2 ** pitches.length; mask++) {
        const copy = structuredClone(doc);
        copy.neumes[0].notes.forEach((n, i) => {
          if (mask & (1 << i)) n.mora = 1;
        });
        const valid = mask === 0 || mask === finalMask;
        expect(isValidNeume(copy.neumes[0])).toBe(valid);
        expect(
          resolveMoraScope(
            'pes-subpunctis',
            copy.neumes[0].notes.map((n) => n.mora),
          ),
        ).toBe(mask === 0 ? 'none' : valid ? 'final' : null);
        if (valid) expect(decodeDocument(envelope(copy, 7))).toEqual(copy);
        else expect(() => decodeDocument(envelope(copy, 7))).toThrow();
        if (!valid) expect(() => encodeDocument(copy)).toThrow();
      }
      for (const scope of [
        'sole',
        'first',
        'second',
        'both',
        'final-two',
      ] satisfies MoraScope[])
        expect(updateMoraScope(doc, 'g', scope)).toBe(doc);
      const marked = updateMoraScope(doc, 'g', 'final');
      expect(getMoraScope(marked.neumes[0])).toBe('final');
      expect(marked.neumes[0].notes.map((n) => n.mora)).toEqual(
        pitches.map((_, i) => (i === last ? 1 : undefined)),
      );
      // Unaffected notes keep their objects; the mark sits on the stable ID.
      marked.neumes[0].notes
        .slice(0, last)
        .forEach((n, i) => expect(n).toBe(doc.neumes[0].notes[i]));
      expect(marked.neumes[0].notes[last].id).toBe('n' + last);
      expect(updateMoraScope(marked, 'g', 'none')).toEqual(doc);
      expect(updateMoraScope(marked, 'g', 'final')).toBe(marked);
      doc.neumes[0].notes.forEach((note, index) => {
        const single = updateNoteModifiers(doc, note.id, {
          kind: 'mora',
          value: 1,
        });
        if (index === last) expect(single).toEqual(marked);
        else expect(single).toBe(doc);
        for (const form of ['virga', 'inclinatum', 'quilisma'] as const)
          expect(updateNoteForm(doc, note.id, form)).toBe(doc);
      });
      // A second mark on the marked group is never accepted.
      for (let i = 0; i < last; i++)
        expect(
          updateNoteModifiers(marked, 'n' + i, { kind: 'mora', value: 1 }),
        ).toBe(marked);
    }
  });

  it('keeps a final-note mora on its stable note through movement, deletion, history and v7 persistence', () => {
    const marked = (pitches: number[]) =>
      updateMoraScope(fixture(pitches), 'g', 'final');
    // Movement never moves the mark.
    const five = marked([2, 5, 4, 3, 2]);
    const moved = moveNoteVertically(five, 'n4', -1);
    expect(moved.neumes[0].notes[4]).toMatchObject({ id: 'n4', mora: 1 });
    const transposed = moveNeumeVertically(five, 'g', 2);
    expect(transposed.neumes[0].notes.map((n) => n.mora)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      1,
    ]);
    // Deleting an earlier constituent keeps the surviving final mora.
    const fiveToFour = deleteNote(five, 'n1');
    expect(fiveToFour.neumes[0].kind).toBe('pes-subpunctis');
    expect(fiveToFour.neumes[0].notes.at(-1)).toBe(five.neumes[0].notes[4]);
    expect(getMoraScope(fiveToFour.neumes[0])).toBe('final');
    const four = marked([2, 4, 3, 2]);
    for (const [deleted, kind] of [
      ['n0', 'climacus'],
      ['n2', 'torculus'],
      ['n1', 'torculus'],
    ] as const) {
      const result = deleteNote(four, deleted).neumes[0];
      expect(result.kind).toBe(kind);
      expect(result.notes.at(-1)).toBe(four.neumes[0].notes[3]);
      expect(getMoraScope(result)).toBe('final');
    }
    // Deleting the marked note removes the mora; it never transfers.
    const withoutMark = deleteNote(five, 'n4').neumes[0];
    expect(withoutMark.kind).toBe('pes-subpunctis');
    expect(withoutMark.notes.map((n) => n.id)).toEqual([
      'n0',
      'n1',
      'n2',
      'n3',
    ]);
    expect(withoutMark.notes.some((n) => n.mora)).toBe(false);
    const fourWithoutMark = deleteNote(four, 'n3').neumes[0];
    expect(fourWithoutMark.kind).toBe('torculus');
    expect(fourWithoutMark.notes.some((n) => n.mora)).toBe(false);
    // Unsupported survivors still reject with the mark intact.
    expect(deleteNote(five, 'n0')).toBe(five);
    // Persistence and exact v1–v6 rejection keep the mark untouched.
    const text = encodeDocument(five);
    expect(JSON.parse(text).version).toBe(7);
    expect(decodeDocument(text)).toEqual(five);
    for (const version of [2, 3, 4, 5, 6]) {
      const payload = JSON.parse(text);
      payload.version = version;
      if (version < 5) delete payload.document.accidentals;
      expect(() => decodeDocument(JSON.stringify(payload))).toThrow();
    }
    // History: one entry per accepted edit, exact undo/redo.
    let session = createEditorSession(fixture([2, 5, 4, 3, 2]));
    const original = session.history.present;
    session = reduceEditorSession(session, {
      type: 'edit',
      edit: (d) => updateMoraScope(d, 'g', 'final'),
    });
    const scoped = session.history.present;
    expect(scoped).toEqual(five);
    session = reduceEditorSession(session, {
      type: 'edit',
      formDeletionNoteId: 'n1',
      edit: (d) => deleteNote(d, 'n1'),
    });
    expect(session.history.present).toEqual(fiveToFour);
    session = reduceEditorSession(session, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(session.history.present).toBe(scoped);
    session = reduceEditorSession(session, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(session.history.present).toBe(original);
    const rejected = reduceEditorSession(session, {
      type: 'edit',
      edit: (d) => updateMoraScope(d, 'g', 'final-two'),
    });
    expect(rejected.history).toBe(session.history);
  });

  it('authors independent horizontal and vertical episemata on every constituent, including the Kyrie ictus', () => {
    const doc = fixture(kyrie.christe);
    let edited = doc;
    for (const note of doc.neumes[0].notes) {
      edited = updateNoteModifiers(edited, note.id, {
        kind: 'episema',
        value: true,
      });
      edited = updateNoteModifiers(edited, note.id, {
        kind: 'verticalEpisema',
        value: true,
      });
    }
    expect(edited.neumes[0].notes.every((n) => n.episema)).toBe(true);
    expect(edited.neumes[0].notes.every((n) => n.verticalEpisema)).toBe(true);
    expect(edited.neumes[0].notes.map((n) => n.id)).toEqual(
      doc.neumes[0].notes.map((n) => n.id),
    );
    const ictus = updateNoteModifiers(doc, 'n3', {
      kind: 'verticalEpisema',
      value: true,
    });
    expect(ictus.neumes[0].notes.map((n) => !!n.verticalEpisema)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(decodeDocument(encodeDocument(ictus))).toEqual(ictus);
  });

  it('allows individual moves only when the contour stays valid and transposes whole groups with stable IDs', () => {
    for (const pitches of [
      [2, 4, 3, 2],
      [2, 3, 2, 1],
      [2, 5, 4, 3, 2],
      [2, 3, 2, 1, 0],
      kyrie.christe,
      kyrie.last,
    ]) {
      const doc = fixture(pitches);
      pitches.forEach((_, index) => {
        for (const delta of [-1, 1] as const) {
          const expected = pitches.map((p, i) => (i === index ? p + delta : p));
          const moved = moveNoteVertically(doc, 'n' + index, delta);
          if (!oracle(expected)) {
            expect(moved).toBe(doc);
            continue;
          }
          expect(moved.neumes[0].notes.map((n) => n.staffPosition)).toEqual(
            expected,
          );
          expect(moved.neumes[0].kind).toBe('pes-subpunctis');
          expect(moved.neumes[0].notes.map((n) => n.id)).toEqual(
            doc.neumes[0].notes.map((n) => n.id),
          );
          moved.neumes[0].notes.forEach((n, i) => {
            if (i !== index) expect(n).toBe(doc.neumes[0].notes[i]);
          });
          expect(moved.syllables).toBe(doc.syllables);
        }
      });
      for (const delta of [-3, -1, 1, 4]) {
        const moved = moveNeumeVertically(doc, 'g', delta);
        expect(moved.neumes[0].notes.map((n) => n.staffPosition)).toEqual(
          pitches.map((p) => p + delta),
        );
        expect(moved.neumes[0].notes.map((n) => n.id)).toEqual(
          doc.neumes[0].notes.map((n) => n.id),
        );
        expect(moved.neumes[0].id).toBe('g');
        expect(moved.neumes[0].notes).toHaveLength(pitches.length);
      }
    }
  });

  it('normalizes constituent deletion from the surviving contour, never from tuple length alone', () => {
    let fiveToFour = 0;
    let rejected = 0;
    const seen = new Set<string>();
    for (const length of [4, 5])
      for (const pitches of tuples(length, -1, 5)) {
        if (!oracle(pitches)) continue;
        const doc = fixture(pitches);
        pitches.forEach((_, index) => {
          const survivors = pitches.filter((_, i) => i !== index);
          const [a, b, c] = survivors;
          const expectedKind =
            survivors.length === 4
              ? oracle(survivors)
                ? 'pes-subpunctis'
                : null
              : a < b && b > c
                ? 'torculus'
                : a > b && b > c
                  ? 'climacus'
                  : null;
          const result = deleteNote(doc, 'n' + index);
          if (!expectedKind) {
            expect(result).toBe(doc);
            rejected++;
            return;
          }
          seen.add(`${length}->${expectedKind}`);
          if (expectedKind === 'pes-subpunctis') fiveToFour++;
          const neume = result.neumes[0];
          expect(neume.id).toBe('g');
          expect(neume.kind).toBe(expectedKind);
          expect(neume.notes).toEqual(
            doc.neumes[0].notes.filter((_, i) => i !== index),
          );
          neume.notes.forEach((n) =>
            expect(n).toBe(doc.neumes[0].notes.find((o) => o.id === n.id)),
          );
          expect(result.syllables).toBe(doc.syllables);
          expect(result.divisions).toEqual(doc.divisions);
          expect(isValidNeume(neume)).toBe(true);
        });
      }
    expect([...seen].sort()).toEqual([
      '4->climacus',
      '4->torculus',
      '5->pes-subpunctis',
    ]);
    expect(fiveToFour).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
    // Named cases: first-note deletion of a five leaves four descending notes.
    const five = fixture([2, 5, 4, 3, 2]);
    expect(deleteNote(five, 'n0')).toBe(five);
    expect(deleteNote(five, 'n4').neumes[0].kind).toBe('pes-subpunctis');
    // Peak deletion: survivors decide (rise -> pes, equal or fall -> reject).
    expect(deleteNote(five, 'n1').neumes[0].kind).toBe('pes-subpunctis');
    const equal = fixture([4, 5, 4, 3, 2]);
    expect(deleteNote(equal, 'n1')).toBe(equal);
    const four = fixture([2, 4, 3, 2]);
    expect(deleteNote(four, 'n0').neumes[0].kind).toBe('climacus');
    expect(deleteNote(four, 'n1').neumes[0].kind).toBe('torculus');
    expect(deleteNote(four, 'n2').neumes[0].kind).toBe('torculus');
    expect(deleteNote(four, 'n3').neumes[0].kind).toBe('torculus');
    expect(deleteNote(fixture([1, 4, 3, 2]), 'n1').neumes[0].kind).toBe(
      'torculus',
    );
    expect(deleteNote(fixture([3, 4, 2, 1]), 'n1').neumes[0].kind).toBe(
      'climacus',
    );
    // Surviving episemata stay on their own notes.
    const marked = updateNoteModifiers(four, 'n3', {
      kind: 'verticalEpisema',
      value: true,
    });
    const normalized = deleteNote(marked, 'n0').neumes[0];
    expect(normalized.notes.at(-1)).toBe(marked.neumes[0].notes[3]);
    expect(deleteNeume(marked, 'g').neumes).toEqual([]);
  });

  it('preserves ADR 0021 B ownership when the contour revisits B, owner deletion and clef changes', () => {
    // C clef on line 4: staff position 5 is B. The contour revisits it.
    const base = fixture([5, 6, 5, 4]);
    const signed = updateAccidental(base, 'n2', 'flat', 'a');
    expect(signed.accidentals).toEqual([
      { id: 'a', kind: 'flat', ownerNoteId: 'n0' },
    ]);
    const effective = (doc: ChantDocument) => {
      const result = resolveEffectivePitches(doc);
      if (!result) throw Error('Invalid pitches');
      return [...result.values()];
    };
    const bs = effective(signed).filter((n) => n.alteration !== 0);
    expect(bs).toHaveLength(2);
    expect(deleteNote(signed, 'n2').accidentals).toEqual(signed.accidentals);
    const ownerDeleted = deleteNote(signed, 'n0');
    expect(ownerDeleted.neumes[0].kind).toBe('climacus');
    expect(ownerDeleted.accidentals).toEqual([]);
    const changed = updateClef(signed, { type: 'f', staffLine: 2 });
    expect(changed.accidentals).toEqual(signed.accidentals);
    expect(effective(changed).map((n) => [n.degree, n.alteration])).toEqual(
      effective(signed).map((n) => [n.degree, n.alteration]),
    );
  });
});

describe('pes subpunctis native v7', () => {
  it('round trips both counts and rejects the kind under every exact v1–v6 reader without touching cache bytes', () => {
    for (const pitches of [[2, 4, 3, 2], kyrie.christe]) {
      const doc = fixture(pitches);
      const text = encodeDocument(doc);
      expect(JSON.parse(text).version).toBe(7);
      expect(decodeDocument(text)).toEqual(doc);
      for (const version of [1, 2, 3, 4, 5, 6]) {
        const payload = JSON.parse(text);
        payload.version = version;
        if (version < 5) delete payload.document.accidentals;
        const original = JSON.stringify(payload);
        expect(() => decodeDocument(original)).toThrow(/kind/);
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
  });

  it('rejects malformed tuples, contours, forms, duplicate IDs, unknown fields and versions', () => {
    const doc = fixture([2, 5, 4, 3, 2]);
    const good = JSON.parse(encodeDocument(doc));
    const mutations: ((p: typeof good) => void)[] = [
      (p) => p.document.neumes[0].notes.splice(3, 2),
      (p) => p.document.neumes[0].notes.splice(1, 2),
      (p) => p.document.neumes[0].notes.push({ id: 'n5', staffPosition: 1 }),
      (p) => (p.document.neumes[0].notes[2].staffPosition = 6),
      (p) => (p.document.neumes[0].notes[1].staffPosition = 1),
      (p) => (p.document.neumes[0].notes[3].staffPosition = 4),
      (p) => (p.document.neumes[0].notes[3].id = 'n2'),
      (p) => (p.document.neumes[0].notes[2].form = 'inclinatum'),
      (p) => (p.document.neumes[0].notes[3].mora = 1),
      (p) => {
        p.document.neumes[0].notes[3].mora = 1;
        p.document.neumes[0].notes[4].mora = 1;
      },
      (p) => (p.document.neumes[0].notes[4].mora = 2),
      (p) => (p.document.neumes[0].count = 5),
      (p) => (p.document.neumes[0].variant = 'subtripunctis'),
      (p) => (p.document.neumes[0].kind = 'pes-subtripunctis'),
      (p) => (p.version = 8),
    ];
    for (const change of mutations) {
      const value = structuredClone(good);
      change(value);
      expect(() => decodeDocument(JSON.stringify(value))).toThrow();
    }
    expect(decodeDocument(JSON.stringify(good))).toEqual(doc);
  });
});

describe('pes subpunctis entry', () => {
  it('inserts the exact entry count with supplied IDs at every mixed-event boundary and rejects insufficient IDs', () => {
    const doc: ChantDocument = {
      ...blankDocument(),
      neumes: [group([2, 4, 3, 2], 'x', 'x'), group([1, 3, 2, 1], 'y', 'y')],
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
    for (const kind of ['pes-subbipunctis', 'pes-subtripunctis'] as const)
      for (let slot = 0; slot <= order.length; slot++) {
        const insertion = {
          ...createNeumeEntryPitches(kind, staffPosition(1)),
          boundary: scoreBoundaryAt(order, slot),
          insertionIndex: 0,
        };
        const ids = {
          neumeId: 'new',
          noteIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
        } as const;
        const inserted = insertEditorNeume(doc, insertion, ids);
        const added = inserted.neumes.find((n) => n.id === 'new');
        expect(added?.kind).toBe('pes-subpunctis');
        expect(added?.notes.map((n) => n.id)).toEqual(
          ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, entryNoteCount(kind)),
        );
        const after = deriveScoreOrder(inserted);
        expect(after?.map((i) => i.entity.id)).toEqual([
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
      }
    const ids = allocateInsertionIds();
    expect(new Set([ids.neumeId, ...ids.noteIds]).size).toBe(6);
    expect(insertNeume(doc, group([2, 4, 3, 2], 'x', 'z'), 0)).toBe(doc);
  });

  it('arms exact variants, recalls them with I/T including selected boundaries, and announces rejected edits', () => {
    for (const kind of ['pes-subbipunctis', 'pes-subtripunctis'] as const) {
      let state = createEditorSession(fixture([2, 4, 3, 2]));
      state = reduceEditorSession(state, {
        type: 'arm',
        tool: { kind: `place-${kind}` },
      });
      expect(getGraphicalNeumeKind(state.activeTool)).toBe(kind);
      const armedHistory = state.history;
      state = reduceEditorSession(state, { type: 'select-tool' });
      state = reduceEditorSession(state, { type: 'focus-palette' });
      expect(state.history).toBe(armedHistory);
      expect(state.rememberedKind).toBe(kind);
      expect(state.focusRequest).toEqual({
        kind: 'palette',
        tool: 'podatus-menu',
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
      expect(added[1].notes).toHaveLength(entryNoteCount(kind));
      expect(
        resolveEditorToolbarInsertion(
          fixture([2, 4, 3, 2]),
          clearSelection(),
          kind,
        )?.kind,
      ).toBe(kind);
    }
    // Primary Podatus re-arms plain Podatus and is remembered as such.
    let state = createEditorSession(blankDocument());
    state = reduceEditorSession(state, {
      type: 'arm',
      tool: { kind: 'place-pes-subtripunctis' },
    });
    state = reduceEditorSession(state, {
      type: 'arm',
      tool: { kind: 'place-podatus' },
    });
    expect(state.rememberedKind).toBe('podatus');
    expect(
      reduceEditorSession(state, { type: 'focus-palette' }).focusRequest,
    ).toEqual({ kind: 'palette', tool: 'podatus' });

    const doc = fixture([2, 5, 4, 3, 2]);
    const session = createEditorSession(doc);
    const move = reduceEditorSession(session, {
      type: 'edit',
      noteMoveId: 'n2',
      focusNoteId: 'n2',
      edit: (d) => moveNoteVertically(d, 'n2', 1),
    });
    expect(move.history).toBe(session.history);
    expect(move.announcement.text).toContain('strictly descend');
    const deletion = reduceEditorSession(session, {
      type: 'edit',
      formDeletionNoteId: 'n0',
      edit: (d) => deleteNote(d, 'n0'),
    });
    expect(deletion.history).toBe(session.history);
    expect(deletion.announcement.text).toContain('four descending notes');
    const accepted = reduceEditorSession(session, {
      type: 'edit',
      formDeletionNoteId: 'n4',
      edit: (d) => deleteNote(d, 'n4'),
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
  });
});
