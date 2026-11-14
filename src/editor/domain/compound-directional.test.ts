import { describe, expect, it } from 'vitest';
import {
  fourNotes,
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type CompoundDirectionalKind,
  type Neume,
} from './chant-document';
import {
  isValidNeume,
  mapNeumeNotes,
  neumeDisplayName,
  normalizeNeumeAfterNoteDeletion,
} from './neume';
import { getMoraScope, moraChoices } from './mora';
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
  reduceEditorSession,
} from '../state/editor-session';
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
  porrectusFamily,
  scandicusFamily,
  torculusFamily,
} from '../state/editor-tool';
import {
  nextPaletteTool,
  paletteTools,
} from '../interaction/palette-navigation';
import { clearSelection, selectNote } from '../state/selection';
import { getNoteAccessibleLabel } from '../rendering/note-accessible-label';

const kinds = [
  'torculus-resupinus',
  'porrectus-flexus',
  'scandicus-flexus',
  'climacus-resupinus',
] as const satisfies readonly CompoundDirectionalKind[];

/** Independent oracle: adjacent directions written out per kind. */
const directions: Record<CompoundDirectionalKind, readonly number[]> = {
  'torculus-resupinus': [1, -1, 1],
  'porrectus-flexus': [-1, 1, -1],
  'scandicus-flexus': [1, 1, -1],
  'climacus-resupinus': [-1, -1, 1],
};
function oracle(kind: CompoundDirectionalKind, pitches: readonly number[]) {
  return (
    pitches.length === 4 &&
    directions[kind].every(
      (d, i) => Math.sign(pitches[i + 1] - pitches[i]) === d,
    )
  );
}
/** Independent deletion oracle from the plan's matrix (ADR 0025). */
function deletionOracle(survivors: readonly number[]): string | null {
  const [a, b, c] = survivors;
  if (a === b || b === c) return null;
  if (a < b) return b < c ? 'scandicus' : 'torculus';
  return b > c ? 'climacus' : 'porrectus';
}

const defaults: Record<CompoundDirectionalKind, readonly number[]> = {
  'torculus-resupinus': [2, 4, 3, 5],
  'porrectus-flexus': [4, 2, 5, 3],
  'scandicus-flexus': [2, 3, 5, 4],
  'climacus-resupinus': [5, 4, 2, 3],
};

function notes(pitches: readonly number[], prefix = 'n'): ChantNote[] {
  return pitches.map((p, i) => ({
    id: prefix + i,
    staffPosition: staffPosition(p),
  }));
}
function group(
  kind: CompoundDirectionalKind,
  pitches: readonly number[],
  id = 'g',
  prefix = 'n',
): Neume {
  const tuple = fourNotes(notes(pitches, prefix));
  if (!tuple) throw Error('fixture needs four notes');
  return { id, kind, notes: tuple };
}
function fixture(
  kind: CompoundDirectionalKind,
  pitches: readonly number[],
): ChantDocument {
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
function* tuples(length: number, low = -1, high = 5): Generator<number[]> {
  if (length === 0) {
    yield [];
    return;
  }
  for (const rest of tuples(length - 1, low, high))
    for (let p = low; p <= high; p++) yield [...rest, p];
}

describe('compound directional tuples (ADR 0025)', () => {
  it.each(kinds)(
    '%s validity matches the independent contour oracle',
    (kind) => {
      let valid = 0;
      for (const pitches of tuples(4)) {
        const expected = oracle(kind, pitches);
        expect(isValidNeume(group(kind, pitches))).toBe(expected);
        if (expected) valid++;
      }
      expect(valid).toBeGreaterThan(100);
      expect(oracle(kind, defaults[kind])).toBe(true);
    },
  );

  it('accepts nonadjacent unisons and crossings, and rejects other cardinalities and holes', () => {
    // Printed specimens: n0 = n2 and n1 = n3 (Liber p. xxj), n0 = n3.
    expect(isValidNeume(group('torculus-resupinus', [2, 3, 2, 3]))).toBe(true);
    expect(isValidNeume(group('porrectus-flexus', [6, 5, 6, 3]))).toBe(true);
    expect(isValidNeume(group('scandicus-flexus', [2, 3, 4, 2]))).toBe(true);
    expect(isValidNeume(group('climacus-resupinus', [6, 5, 4, 5]))).toBe(true);
    expect(isValidNeume(group('torculus-resupinus', [2, 3, 1, 4]))).toBe(true);
    expect(isValidNeume(group('climacus-resupinus', [4, 3, 1, 6]))).toBe(true);
    for (const kind of kinds) {
      const [a, b, c, d] = notes(defaults[kind]);
      const malformed = [
        [a, b, c],
        [a, b, c, d, a],
        [a, b, undefined, d],
      ];
      for (const list of malformed)
        expect(
          isValidNeume({ id: 'g', kind, notes: list } as unknown as Neume),
        ).toBe(false);
      expect(fourNotes([a, b, c])).toBeNull();
      expect(fourNotes([a, b, c, d, a])).toBeNull();
      // Adjacent unisons always fail.
      const unison = [...defaults[kind]];
      unison[2] = unison[1];
      expect(isValidNeume(group(kind, unison))).toBe(false);
    }
  });

  it('names the figures and labels every constituent', () => {
    expect(kinds.map((k) => neumeDisplayName(k, 4))).toEqual([
      'torculus resupinus',
      'porrectus flexus',
      'scandicus flexus',
      'climacus resupinus',
    ]);
    expect(getNoteAccessibleLabel('porrectus-flexus', 3, 4)).toBe(
      'Select fourth note of porrectus flexus',
    );
  });

  it('rebuilds the exact tuple through mapNeumeNotes', () => {
    for (const kind of kinds) {
      const neume = group(kind, defaults[kind]);
      const mapped = mapNeumeNotes(neume, (n) => ({
        ...n,
        staffPosition: staffPosition(n.staffPosition + 1),
      }));
      expect(mapped?.kind).toBe(kind);
      expect(mapped?.notes.map((n) => n.id)).toEqual(['n0', 'n1', 'n2', 'n3']);
    }
  });
});

describe('forms, mora and episemata', () => {
  it('offers no authored forms and exactly none or final mora', () => {
    for (const kind of kinds) {
      for (let i = 0; i < 4; i++)
        expect(allowedNoteForms(kind, i, 4)).toEqual([]);
      expect(moraChoices(kind, 4).map((c) => c.value)).toEqual([
        'none',
        'final',
      ]);
      const doc = fixture(kind, defaults[kind]);
      expect(updateNoteForm(doc, 'n0', 'virga')).toBe(doc);
      expect(updateNoteForm(doc, 'n1', 'quilisma')).toBe(doc);
      expect(updateMoraScope(doc, 'g', 'final-two')).toBe(doc);
      const marked = updateMoraScope(doc, 'g', 'final');
      expect(marked.neumes[0].notes.map((n) => n.mora)).toEqual([
        undefined,
        undefined,
        undefined,
        1,
      ]);
      expect(getMoraScope(marked.neumes[0])).toBe('final');
      // Earlier-note mora is not a supported scope.
      const invalid = structuredClone(doc);
      (invalid.neumes[0].notes[1] as ChantNote).mora = 1;
      expect(isValidNeume(invalid.neumes[0])).toBe(false);
    }
  });

  it('authors independent horizontal and vertical episemata on all four notes', () => {
    for (const kind of kinds) {
      let doc = fixture(kind, defaults[kind]);
      for (const id of ['n0', 'n1', 'n2', 'n3']) {
        doc = updateNoteModifiers(doc, id, { kind: 'episema', value: true });
        doc = updateNoteModifiers(doc, id, {
          kind: 'verticalEpisema',
          value: true,
        });
      }
      expect(
        doc.neumes[0].notes.every((n) => n.episema && n.verticalEpisema),
      ).toBe(true);
      expect(decodeDocument(encodeDocument(doc))).toEqual(doc);
    }
  });
});

describe('editing and normalization', () => {
  it.each(kinds)(
    '%s deletion yields the contour-named three-note kind for every index and bounded contour',
    (kind) => {
      const outcomes = new Set<string>();
      for (const pitches of tuples(4)) {
        if (!oracle(kind, pitches)) continue;
        const doc = updateMoraScope(fixture(kind, pitches), 'g', 'final');
        for (let index = 0; index < 4; index++) {
          const survivors = pitches.filter((_, i) => i !== index);
          const expected = deletionOracle(survivors);
          const result = deleteNote(doc, `n${index}`);
          if (!expected) {
            expect(result).toBe(doc);
            continue;
          }
          outcomes.add(`${index}:${expected}`);
          const neume = result.neumes[0];
          expect(neume.id).toBe('g');
          expect(neume.kind).toBe(expected);
          // Survivor objects, IDs and order are retained.
          expect(neume.notes).toEqual(
            doc.neumes[0].notes.filter((_, i) => i !== index),
          );
          // A final mora stays on its own note or leaves with it.
          expect(getMoraScope(neume)).toBe(index === 3 ? 'none' : 'final');
          expect(result.syllables).toEqual(doc.syllables);
          expect(result.divisions).toEqual(doc.divisions);
        }
      }
      // The plan's matrix, per deleted index.
      const matrix: Record<CompoundDirectionalKind, string[]> = {
        'torculus-resupinus': [
          '0:porrectus',
          '1:scandicus',
          '1:porrectus',
          '2:scandicus',
          '2:torculus',
          '3:torculus',
        ],
        'porrectus-flexus': [
          '0:torculus',
          '1:climacus',
          '1:torculus',
          '2:climacus',
          '2:porrectus',
          '3:porrectus',
        ],
        'scandicus-flexus': [
          '0:torculus',
          '1:torculus',
          '2:scandicus',
          '2:torculus',
          '3:scandicus',
        ],
        'climacus-resupinus': [
          '0:porrectus',
          '1:porrectus',
          '2:climacus',
          '2:porrectus',
          '3:climacus',
        ],
      };
      expect([...outcomes].sort()).toEqual([...matrix[kind]].sort());
    },
  );

  it('rejects deletion that leaves adjacent unisons, without inventing a kind', () => {
    const doc = fixture('torculus-resupinus', [2, 4, 2, 3]);
    expect(deleteNote(doc, 'n1')).toBe(doc);
    expect(normalizeNeumeAfterNoteDeletion(doc.neumes[0], 'n1')).toBe(
      doc.neumes[0],
    );
    let session = createEditorSession(doc);
    session = reduceEditorSession(session, {
      type: 'edit',
      formDeletionNoteId: 'n1',
      edit: (d) => deleteNote(d, 'n1'),
    });
    expect(session.history.present).toBe(doc);
    expect(session.announcement.text).toMatch(/two equal adjacent pitches/);
  });

  it.each(kinds)(
    '%s individual movement preserves the strict contour or rejects atomically',
    (kind) => {
      for (const pitches of tuples(4, 0, 4)) {
        if (!oracle(kind, pitches)) continue;
        const doc = fixture(kind, pitches);
        for (let index = 0; index < 4; index++)
          for (const delta of [1, -1] as const) {
            const moved = pitches.map((p, i) => (i === index ? p + delta : p));
            const result = moveNoteVertically(doc, `n${index}`, delta);
            if (oracle(kind, moved)) {
              expect(
                result.neumes[0].notes.map((n) => n.staffPosition),
              ).toEqual(moved);
              expect(result.neumes[0].notes.map((n) => n.id)).toEqual([
                'n0',
                'n1',
                'n2',
                'n3',
              ]);
            } else expect(result).toBe(doc);
          }
      }
      // Moving the second note onto the first's pitch is rejected and announced.
      const [first, second] = defaults[kind];
      let session = createEditorSession(fixture(kind, defaults[kind]));
      const before = session.history;
      const delta = first > second ? 1 : -1;
      session = reduceEditorSession(session, {
        type: 'edit',
        noteMoveId: 'n1',
        edit: (d) => moveNoteVertically(d, 'n1', delta),
      });
      if (Math.abs(first - second) === 1) {
        expect(session.history).toBe(before);
        expect(session.announcement.text).toContain(neumeDisplayName(kind, 4));
      }
    },
  );

  it('transposes the whole neume, keeping intervals, IDs and marks', () => {
    for (const kind of kinds) {
      const doc = updateMoraScope(fixture(kind, defaults[kind]), 'g', 'final');
      const moved = moveNeumeVertically(doc, 'g', 2).neumes[0];
      expect(moved.notes.map((n) => n.staffPosition)).toEqual(
        defaults[kind].map((p) => p + 2),
      );
      expect(moved.notes.map((n) => n.id)).toEqual(['n0', 'n1', 'n2', 'n3']);
      expect(getMoraScope(moved)).toBe('final');
    }
  });

  it('records exact undo/redo for a normalizing deletion', () => {
    const doc = updateMoraScope(
      fixture('scandicus-flexus', [2, 3, 5, 4]),
      'g',
      'final',
    );
    let session = createEditorSession(doc);
    session = reduceEditorSession(session, {
      type: 'edit',
      formDeletionNoteId: 'n0',
      edit: (d) => deleteNote(d, 'n0'),
    });
    const after = session.history.present;
    expect(after.neumes[0].kind).toBe('torculus');
    const undone = reduceEditorSession(session, {
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
    ).toBe(after);
  });

  it('preserves ADR 0021 B ownership on constituents, owner deletion and clef changes', () => {
    // C clef on line 4: staff position 5 is B.
    const base = fixture('torculus-resupinus', [2, 4, 3, 5]);
    const signed = updateAccidental(base, 'n3', 'flat', 'a');
    expect(signed.accidentals).toEqual([
      { id: 'a', kind: 'flat', ownerNoteId: 'n3' },
    ]);
    expect(
      [...(resolveEffectivePitches(signed)?.values() ?? [])].filter(
        (p) => p.alteration !== 0,
      ),
    ).toHaveLength(1);
    const earlier = deleteNote(signed, 'n0');
    expect(earlier.neumes[0].kind).toBe('porrectus');
    expect(earlier.accidentals).toEqual(signed.accidentals);
    const ownerDeleted = deleteNote(signed, 'n3');
    expect(ownerDeleted.neumes[0].kind).toBe('torculus');
    expect(ownerDeleted.accidentals).toEqual([]);
    expect(updateClef(signed, { type: 'f', staffLine: 2 }).accidentals).toEqual(
      signed.accidentals,
    );
  });
});

describe('native v9 persistence', () => {
  it.each(kinds)(
    '%s round trips in v9 and is rejected by every exact v1–v8 reader without touching cache bytes',
    (kind) => {
      const doc = updateMoraScope(fixture(kind, defaults[kind]), 'g', 'final');
      const text = encodeDocument(doc);
      expect(JSON.parse(text).version).toBe(9);
      expect(decodeDocument(text)).toEqual(doc);
      for (const version of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const payload = JSON.parse(text);
        payload.version = version;
        if (version < 5) delete payload.document.accidentals;
        if (version < 2)
          for (const n of payload.document.neumes[0].notes) delete n.mora;
        const original = JSON.stringify(payload);
        expect(() => decodeDocument(original)).toThrow(
          /Unsupported neume kind for this schema version/,
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
    },
  );

  it.each(kinds)(
    '%s rejects malformed tuples, contours, forms, mora, extra fields and variant kinds',
    (kind) => {
      const good = JSON.parse(encodeDocument(fixture(kind, defaults[kind])));
      const mutations: ((p: typeof good) => void)[] = [
        (p) => p.document.neumes[0].notes.splice(3, 1),
        (p) => p.document.neumes[0].notes.push({ id: 'n4', staffPosition: 1 }),
        (p) =>
          (p.document.neumes[0].notes[1].staffPosition =
            p.document.neumes[0].notes[0].staffPosition),
        (p) =>
          (p.document.neumes[0].notes[3].staffPosition =
            p.document.neumes[0].notes[2].staffPosition),
        (p) => (p.document.neumes[0].notes[3].id = 'n2'),
        (p) => (p.document.neumes[0].notes[0].form = 'virga'),
        (p) => (p.document.neumes[0].notes[1].form = 'quilisma'),
        (p) => (p.document.neumes[0].notes[0].mora = 1),
        (p) => {
          p.document.neumes[0].notes[2].mora = 1;
          p.document.neumes[0].notes[3].mora = 1;
        },
        (p) => (p.document.neumes[0].variant = 'flexus'),
        (p) => (p.document.neumes[0].kind = `${kind}-4`),
        (p) => (p.version = 10),
      ];
      for (const change of mutations) {
        const value = structuredClone(good);
        change(value);
        expect(() => decodeDocument(JSON.stringify(value))).toThrow();
      }
    },
  );
});

describe('entry', () => {
  it('exposes six split families with exact named variants', () => {
    expect(torculusFamily).toEqual(['torculus', 'torculus-resupinus']);
    expect(porrectusFamily).toEqual(['porrectus', 'porrectus-flexus']);
    expect(scandicusFamily.at(-1)).toBe('scandicus-flexus');
    expect(climacusFamily.at(-1)).toBe('climacus-resupinus');
    expect(paletteTools.filter((t) => t.endsWith('-menu'))).toEqual([
      'punctum-menu',
      'podatus-menu',
      'scandicus-menu',
      'torculus-menu',
      'climacus-menu',
      'porrectus-menu',
    ]);
    expect(nextPaletteTool('torculus', 'ArrowRight')).toBe('torculus-menu');
    expect(nextPaletteTool('porrectus-menu', 'ArrowRight')).toBe('c-clef');
    for (const kind of kinds) {
      expect(entryNoteCount(kind)).toBe(4);
      expect(semanticNeumeKind(kind)).toBe(kind);
      expect(entryNeumeKind(kind, 4)).toBe(kind);
      expect(
        createNeumeEntryPitches(kind, staffPosition(defaults[kind][0]))
          .staffPositions,
      ).toEqual(defaults[kind]);
    }
  });

  it('inserts all four notes with supplied IDs at every mixed-event boundary and rejects insufficient or duplicate IDs', () => {
    const doc: ChantDocument = {
      ...blankDocument(),
      neumes: [
        group('scandicus-flexus', [1, 2, 4, 3], 'x', 'x'),
        group('climacus-resupinus', [5, 4, 2, 3], 'y', 'y'),
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
    for (const kind of kinds)
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
        expect(added?.kind).toBe(kind);
        expect(added?.notes.map((n) => n.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
        expect(deriveScoreOrder(inserted)?.map((i) => i.entity.id)).toEqual([
          ...order.slice(0, slot).map((i) => i.entity.id),
          'new',
          ...order.slice(slot).map((i) => i.entity.id),
        ]);
        expect(deleteNeume(inserted, 'new')).toEqual(doc);
        for (const noteIds of [
          ['p1', 'p2', 'p3'],
          ['p1', 'p2', 'p1', 'p4'],
          ['p1', 'x0', 'p3', 'p4'],
        ] as const)
          expect(
            insertEditorNeume(doc, insertion, { neumeId: 'new', noteIds }),
          ).toBe(doc);
      }
  });

  it.each(kinds)(
    'arms %s, recalls it with I/T through its family menu and inserts contextually',
    (kind) => {
      const family = {
        'torculus-resupinus': 'torculus',
        'porrectus-flexus': 'porrectus',
        'scandicus-flexus': 'scandicus',
        'climacus-resupinus': 'climacus',
      }[kind];
      let state = createEditorSession(fixture(kind, defaults[kind]));
      const clean = state.history;
      state = reduceEditorSession(state, {
        type: 'arm',
        tool: { kind: `place-${kind}` },
      });
      expect(getGraphicalNeumeKind(state.activeTool)).toBe(kind);
      expect(state.announcement.text).toBe(
        `Placing ${kind[0].toUpperCase()}${kind.slice(1).replace('-', ' ')}.`,
      );
      state = reduceEditorSession(state, { type: 'select-tool' });
      state = reduceEditorSession(state, { type: 'focus-palette' });
      expect(state.history).toBe(clean);
      expect(state.rememberedKind).toBe(kind);
      expect(state.focusRequest).toEqual({
        kind: 'palette',
        tool: `${family}-menu`,
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
      expect(added[1].notes).toHaveLength(4);
      expect(
        resolveEditorToolbarInsertion(
          fixture(kind, defaults[kind]),
          clearSelection(),
          kind,
        )?.kind,
      ).toBe(kind);
    },
  );
});
