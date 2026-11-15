import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
} from '../domain/chant-document';
import { resolveEffectivePitches } from '../domain/accidentals';
import { deriveScoreOrder } from '../domain/divisions';
import {
  bundledExamples,
  loadBundledExample,
} from '../examples/bundled-examples';
import {
  encodeDocument,
  validateDocument,
} from '../persistence/native-document';
import type { EditorSelection } from '../state/selection';
import {
  copyMusicalPassage,
  pasteIdCount,
  pasteMusicalPassage,
  pasteRejectionMessage,
  type MusicalClipboard,
} from './musical-passage-clipboard';

const p = staffPosition;
const note = (id: string, position: number, extra = {}): ChantNote => ({
  id,
  staffPosition: p(position),
  ...extra,
});
const punctum = (id: string, position: number, extra = {}): Neume => ({
  id,
  kind: 'punctum',
  notes: [note(`${id}.0`, position, extra)],
});
// C clef on line 3: position 4 is do (degree 0); position 3 is B (degree -1).
const doc = (
  neumes: Neume[],
  more: Partial<ChantDocument> = {},
): ChantDocument => ({
  title: 'Clipboard',
  lyricLanguage: 'la',
  clef: { type: 'c', staffLine: 3 },
  accidentals: [],
  divisions: [],
  clefChanges: [],
  syllables: [],
  neumes,
  ...more,
});
const whole = (neumeId: string): EditorSelection => ({
  kind: 'neume',
  neumeId,
});
const range = (anchor: string, endpoint: string): EditorSelection => ({
  kind: 'neume-range',
  anchorNeumeId: anchor,
  endpointNeumeId: endpoint,
});
const none: EditorSelection = { kind: 'none' };

function copy(document: ChantDocument, selection: EditorSelection) {
  const result = copyMusicalPassage(document, selection);
  if (!result.clipboard) throw Error(`copy rejected: ${result.rejection}`);
  return result.clipboard;
}
let serial = 0;
const freshIds = (clipboard: MusicalClipboard) =>
  Array.from({ length: pasteIdCount(clipboard) }, () => `fresh-${++serial}`);
function paste(
  document: ChantDocument,
  selection: EditorSelection,
  clipboard: MusicalClipboard,
) {
  const result = pasteMusicalPassage(
    document,
    selection,
    clipboard,
    freshIds(clipboard),
  );
  if (!result.document)
    throw Error(`paste rejected: ${pasteRejectionMessage(result.rejection)}`);
  return result;
}
const rejection = (
  document: ChantDocument,
  selection: EditorSelection,
  clipboard: MusicalClipboard | null,
  ids = clipboard ? freshIds(clipboard) : [],
) => pasteMusicalPassage(document, selection, clipboard, ids).rejection;
/** Exact mixed score order as compact tokens (neume IDs, |kind, clef). */
const orderTokens = (document: ChantDocument, rename = new Map()) =>
  (deriveScoreOrder(document) ?? []).map((item) =>
    item.type === 'neume'
      ? (rename.get(item.entity.id) ?? item.entity.id)
      : item.type === 'division'
        ? `|${item.entity.kind}`
        : `${item.entity.clef.type}${item.entity.clef.staffLine}`,
  );
const positions = (document: ChantDocument, ids: readonly string[]) =>
  ids.map((id) =>
    document.neumes.find((n) => n.id === id)?.notes.map((n) => n.staffPosition),
  );
const stripIds = (neume: Neume) => ({
  kind: neume.kind,
  notes: neume.notes.map(({ id: _id, ...rest }) => rest),
});

const variants: Neume[] = [
  {
    id: 'ps',
    kind: 'pes-subpunctis',
    notes: [
      note('ps0', 2, { episema: true }),
      note('ps1', 6),
      note('ps2', 5, { verticalEpisema: true }),
      note('ps3', 4),
      note('ps4', 2, { mora: 1 }),
    ],
  },
  {
    id: 'sc5',
    kind: 'scandicus',
    notes: [
      note('s0', 0),
      note('s1', 1),
      note('s2', 2),
      note('s3', 4),
      note('s4', 5),
    ],
  },
  {
    id: 'tr',
    kind: 'torculus-resupinus',
    notes: [
      note('t0', 2),
      note('t1', 5),
      note('t2', 4),
      note('t3', 6, { mora: 1 }),
    ],
  },
  {
    id: 'qp',
    kind: 'podatus',
    notes: [note('q0', 2, { form: 'quilisma' }), note('q1', 4)],
  },
  punctum('vg', 6, { form: 'virga', episema: true }),
  {
    id: 'tri',
    kind: 'tristropha',
    notes: [note('r0', 5), note('r1', 5), note('r2', 5)],
  },
];

describe('copying a musical passage', () => {
  it('captures a detached, ID-free snapshot in canonical order for either range direction', () => {
    const source = doc([...variants]);
    const forward = copy(source, range('ps', 'tri'));
    const backward = copy(source, range('tri', 'ps'));
    expect(backward).toEqual(forward);
    expect(forward.neumeCount).toBe(6);
    expect(forward.noteCount).toBe(20);
    const json = JSON.stringify(forward);
    for (const neume of variants)
      for (const id of [neume.id, ...neume.notes.map((n) => n.id)])
        expect(json).not.toContain(`"${id}"`);
    // Later source edits or replacement cannot reach the snapshot.
    const before = JSON.stringify(forward);
    source.neumes.length = 0;
    expect(JSON.stringify(forward)).toBe(before);
  });

  it('copies one whole neume, rejects partial, empty, stale and non-musical selections', () => {
    const source = doc([punctum('a', 4), punctum('b', 5)]);
    expect(copy(source, whole('b')).neumeCount).toBe(1);
    for (const selection of [
      none,
      { kind: 'note', noteId: 'a.0' },
      { kind: 'clef' },
      { kind: 'division', divisionId: 'x' },
      { kind: 'syllable', syllableId: 'x' },
      whole('stale'),
      range('a', 'stale'),
    ] as EditorSelection[])
      expect(copyMusicalPassage(source, selection).rejection).toBe(
        'invalid-target',
      );
  });

  it('keeps only divisions strictly inside the interval, in exact order, and omits clefs', () => {
    const source = doc(
      [punctum('a', 4), punctum('b', 5), punctum('c', 6), punctum('d', 4)],
      {
        divisions: [
          { id: 'lead', kind: 'finalis', beforeNeumeId: 'a' },
          { id: 'm1', kind: 'minima', beforeNeumeId: 'c' },
          { id: 'm2', kind: 'maior', beforeNeumeId: 'c' },
          { id: 'trail', kind: 'minor', beforeNeumeId: 'd' },
        ],
        clefChanges: [
          {
            id: 'cc',
            clef: { type: 'f', staffLine: 3 },
            beforeNeumeId: 'c',
            beforeDivisionId: 'm2',
          },
        ],
      },
    );
    const clip = copy(source, range('a', 'c'));
    expect(clip.events.map((e) => (e.type === 'neume' ? 'N' : e.kind))).toEqual(
      ['N', 'N', 'minima', 'maior', 'N'],
    );
    expect(clip.divisionCount).toBe(2);
    expect(copy(source, whole('c')).events).toHaveLength(1);
    // The source clef change still governs captured degrees (F3: offset -1).
    const c = clip.events[4];
    expect(c.type === 'neume' && c.neume.pitches[0].degree).toBe(5);
  });

  it('copies signs by owner, retaining internal anchors and defaulting external ones', () => {
    const source = doc(
      [punctum('x', 4), punctum('a', 3), punctum('b', 5), punctum('c', 3)],
      {
        accidentals: [
          // Owner inside, anchored outside: default placement on paste.
          {
            id: 'f1',
            kind: 'flat',
            ownerNoteId: 'a.0',
            placement: { kind: 'above-note', noteId: 'x.0' },
          },
          // Natural owned inside with an internal anchor.
          {
            id: 'n1',
            kind: 'natural',
            ownerNoteId: 'c.0',
            placement: { kind: 'above-note', noteId: 'b.0' },
          },
        ],
      },
    );
    const clip = copy(source, range('a', 'c'));
    expect(clip.accidentals).toEqual([
      { kind: 'flat', owner: { neume: 0, note: 0 } },
      {
        kind: 'natural',
        owner: { neume: 2, note: 0 },
        placement: { neume: 1, note: 0 },
      },
    ]);
    expect(clip.restoredPlacementCount).toBe(1);
    const outside = doc([punctum('a', 3), punctum('b', 5), punctum('c', 3)], {
      accidentals: [
        {
          id: 'f',
          kind: 'flat',
          ownerNoteId: 'c.0',
          placement: { kind: 'above-note', noteId: 'b.0' },
        },
      ],
    });
    // Owner outside the copied neume b, even though its anchor is inside.
    expect(copy(outside, range('a', 'b')).accidentals).toEqual([]);
    const result = paste(doc([]), none, clip);
    const [first, , third] = result.pastedNeumeIds;
    const pastedNote = (id: string) =>
      result.document.neumes.find((n) => n.id === id)?.notes[0].id;
    const b = result.pastedNeumeIds[1];
    expect(result.document.accidentals).toEqual([
      expect.objectContaining({ kind: 'flat', ownerNoteId: pastedNote(first) }),
      expect.objectContaining({
        kind: 'natural',
        ownerNoteId: pastedNote(third),
        placement: { kind: 'above-note', noteId: pastedNote(b) },
      }),
    ]);
    expect(result.document.accidentals[0]).not.toHaveProperty('placement');
  });
});

describe('pasting a musical passage', () => {
  it('reproduces every neume variant, cardinality, form and modifier with fresh IDs', () => {
    const source = doc(variants);
    const clip = copy(source, range('ps', 'tri'));
    const first = paste(source, none, clip);
    const second = paste(first.document, none, clip);
    expect(first.document.neumes.slice(6).map(stripIds)).toEqual(
      variants.map(stripIds),
    );
    expect(second.document.neumes.slice(12).map(stripIds)).toEqual(
      variants.map(stripIds),
    );
    const ids = [
      ...second.document.neumes.flatMap((n) => [
        n.id,
        ...n.notes.map((x) => x.id),
      ]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(() =>
      validateDocument(JSON.parse(encodeDocument(second.document)).document),
    ).not.toThrow();
  });

  it('inserts after the selected neume before following divisions and clefs', () => {
    const dest = doc([punctum('a', 4), punctum('b', 5)], {
      divisions: [{ id: 'bar', kind: 'minor', beforeNeumeId: 'b' }],
      clefChanges: [
        {
          id: 'cc',
          clef: { type: 'c', staffLine: 4 },
          beforeNeumeId: 'b',
          beforeDivisionId: null,
        },
      ],
    });
    const clip = copy(doc([punctum('p', 6)]), whole('p'));
    for (const selection of [
      whole('a'),
      { kind: 'note', noteId: 'a.0' },
    ] as EditorSelection[]) {
      const result = paste(dest, selection, clip);
      const rename = new Map([[result.pastedNeumeIds[0], 'P']]);
      expect(orderTokens(result.document, rename)).toEqual([
        'a',
        'P',
        '|minor',
        'c4',
        'b',
      ]);
      // Governed by the initial clef strictly before the boundary.
      expect(positions(result.document, result.pastedNeumeIds)).toEqual([[6]]);
    }
  });

  it('appends after every trailing event under the last clef, including empty music', () => {
    const dest = doc([punctum('a', 4)], {
      divisions: [{ id: 'fin', kind: 'finalis', beforeNeumeId: null }],
      clefChanges: [
        {
          id: 'cc',
          clef: { type: 'f', staffLine: 3 },
          beforeNeumeId: null,
          beforeDivisionId: null,
        },
      ],
    });
    const clip = copy(doc([punctum('p', 4)]), whole('p'));
    const result = paste(dest, none, clip);
    expect(
      orderTokens(result.document, new Map([[result.pastedNeumeIds[0], 'P']])),
    ).toEqual(['a', '|finalis', 'f3', 'P']);
    // Degree 0 (do) under F3 (offset -1) is position 1.
    expect(positions(result.document, result.pastedNeumeIds)).toEqual([[1]]);
    const empty = paste(doc([]), none, clip);
    expect(empty.document.neumes).toHaveLength(1);
  });

  it('pastes after the last canonical neume of a backward range, with internal divisions', () => {
    const source = doc([punctum('p', 4), punctum('q', 5)], {
      divisions: [
        { id: 'd1', kind: 'minima', beforeNeumeId: 'q' },
        { id: 'd2', kind: 'minor', beforeNeumeId: 'q' },
      ],
    });
    const clip = copy(source, range('q', 'p'));
    const dest = doc([punctum('a', 4), punctum('b', 4), punctum('c', 4)]);
    const result = paste(dest, range('b', 'a'), clip);
    const [P, Q] = result.pastedNeumeIds;
    expect(
      orderTokens(
        result.document,
        new Map([
          [P, 'P'],
          [Q, 'Q'],
        ]),
      ),
    ).toEqual(['a', 'b', 'P', '|minima', '|minor', 'Q', 'c']);
    const divisionIds = result.document.divisions.map((d) => d.id);
    expect(divisionIds.every((id) => id.startsWith('fresh-'))).toBe(true);
    expect(result.document.divisions.map((d) => d.beforeNeumeId)).toEqual([
      Q,
      Q,
    ]);
  });

  it('preserves relative degree across mixed source clefs under the destination clef', () => {
    const source = doc([punctum('a', 4), punctum('b', 4)], {
      clefChanges: [
        {
          id: 'cc',
          clef: { type: 'f', staffLine: 3 },
          beforeNeumeId: 'b',
          beforeDivisionId: null,
        },
      ],
    });
    const clip = copy(source, range('a', 'b'));
    // Degrees: a = 0 (do), b = 3 (fa). C4 destination offset is -6.
    const dest = doc([], { clef: { type: 'c', staffLine: 4 } });
    const result = paste(dest, none, clip);
    expect(positions(result.document, result.pastedNeumeIds)).toEqual([
      [6],
      [9],
    ]);
    expect(result.document.clefChanges).toEqual([]);
  });

  it('rejects empty clipboards, invalid or stale targets, and bad ID allocations', () => {
    const dest = doc([punctum('a', 4)], {
      divisions: [{ id: 'd', kind: 'minima', beforeNeumeId: 'a' }],
      syllables: [
        { id: 's', text: 'A', startsAtNeumeId: 'a', boundaryBefore: 'word' },
      ],
    });
    const clip = copy(doc([punctum('p', 4)]), whole('p'));
    expect(rejection(dest, none, null)?.kind).toBe('empty-clipboard');
    for (const selection of [
      { kind: 'clef' },
      { kind: 'division', divisionId: 'd' },
      { kind: 'syllable', syllableId: 's' },
      { kind: 'accidental', accidentalId: 'x' },
      { kind: 'clef-change', clefChangeId: 'x' },
      whole('stale'),
      { kind: 'note', noteId: 'stale' },
      range('a', 'stale'),
    ] as EditorSelection[])
      expect(rejection(dest, selection, clip)?.kind).toBe('invalid-target');
    for (const ids of [
      [],
      ['x'],
      ['x', 'y', 'z'],
      ['', 'y'],
      ['x', 'x'],
      ['a', 'y'],
      ['d', 'y'],
      ['s', 'y'],
    ])
      expect(rejection(dest, none, clip, ids)?.kind).toBe('invalid-ids');
  });

  it('keeps existing lyric anchors and text exactly; pasted music joins ordinary syllables', () => {
    const dest = doc([punctum('a', 4), punctum('b', 5)], {
      syllables: [
        {
          id: 's1',
          text: 'Ky',
          startsAtNeumeId: 'a',
          boundaryBefore: 'word',
          alignment: { start: 1, end: 2 },
        },
        {
          id: 's2',
          text: 'ri',
          startsAtNeumeId: 'b',
          boundaryBefore: 'continuation',
        },
      ],
    });
    const source = doc([punctum('p', 6)], {
      syllables: [
        { id: 'sx', text: 'e', startsAtNeumeId: 'p', boundaryBefore: 'word' },
      ],
    });
    const result = paste(dest, whole('a'), copy(source, whole('p')));
    expect(result.document.syllables).toBe(dest.syllables);
    const encoded = JSON.parse(encodeDocument(result.document)).document;
    expect(encoded.syllables).toEqual(
      JSON.parse(encodeDocument(dest)).document.syllables,
    );
    expect(encodeDocument(result.document)).not.toContain('"e"');
    expect(
      result.document.neumes.map((n) => n.id).indexOf(result.pastedNeumeIds[0]),
    ).toBe(1);
  });

  it('accepts a compatible inherited flat and rejects a copied pitch that would change', () => {
    // Source: the flat on a governs b inside the same scope; only b is copied.
    const source = doc([punctum('a', 3), punctum('b', 3)], {
      accidentals: [{ id: 'f', kind: 'flat', ownerNoteId: 'a.0' }],
    });
    const clip = copy(source, whole('b'));
    expect(clip.accidentals).toEqual([]);
    const flatDest = doc([punctum('x', 3), punctum('y', 4)], {
      accidentals: [{ id: 'g', kind: 'flat', ownerNoteId: 'x.0' }],
    });
    const ok = paste(flatDest, whole('x'), clip);
    expect(
      resolveEffectivePitches(ok.document)?.get(
        ok.document.neumes[1].notes[0].id,
      )?.alteration,
    ).toBe(-1);
    const naturalDest = doc([punctum('x', 3)]);
    const r = pasteMusicalPassage(naturalDest, none, clip, freshIds(clip));
    expect(r.rejection?.kind).toBe('copied-pitch-conflict');
    expect(r.rejection && pasteRejectionMessage(r.rejection)).toBe(
      'Cannot paste: copied note 1, a B-flat, would become B-natural here.',
    );
    // The reverse: a copied natural B pasted where a flat is still active.
    const natural = copy(doc([punctum('n', 3)]), whole('n'));
    expect(rejection(flatDest, whole('x'), natural)?.kind).toBe(
      'copied-pitch-conflict',
    );
    // A division at the destination boundary resets the flat: compatible.
    const barred = doc([punctum('x', 3), punctum('y', 4)], {
      accidentals: [{ id: 'g', kind: 'flat', ownerNoteId: 'x.0' }],
      divisions: [{ id: 'd', kind: 'minima', beforeNeumeId: null }],
    });
    expect(rejection(barred, none, natural)).toBeNull();
  });

  it('distinguishes register-specific B degrees', () => {
    // Positions 3 and 10 are both B under C3, a seventh apart.
    const source = doc([punctum('a', 3), punctum('b', 10)], {
      accidentals: [{ id: 'f', kind: 'flat', ownerNoteId: 'a.0' }],
    });
    const clip = copy(source, whole('b'));
    expect(
      clip.events[0].type === 'neume' && clip.events[0].neume.pitches,
    ).toEqual([{ degree: 6, alteration: 0 }]);
    const dest = doc([punctum('x', 3)], {
      accidentals: [{ id: 'g', kind: 'flat', ownerNoteId: 'x.0' }],
    });
    expect(rejection(dest, none, clip)).toBeNull();
  });

  it('rejects when an omitted source word reset would change a copied pitch', () => {
    const source = doc([punctum('a', 3), punctum('b', 3)], {
      accidentals: [{ id: 'f', kind: 'flat', ownerNoteId: 'a.0' }],
      syllables: [
        { id: 's1', text: 'a', startsAtNeumeId: 'a', boundaryBefore: 'word' },
        { id: 's2', text: 'b', startsAtNeumeId: 'b', boundaryBefore: 'word' },
      ],
    });
    const clip = copy(source, range('a', 'b'));
    const r = pasteMusicalPassage(doc([]), none, clip, freshIds(clip));
    expect(r.rejection).toEqual({
      kind: 'copied-pitch-conflict',
      conflict: { ordinal: 2, degree: -1, expected: 0, actual: -1 },
    });
  });

  it('rejects a copied sign that would change existing music after the insertion point', () => {
    const clip = copy(
      doc([punctum('p', 3)], {
        accidentals: [{ id: 'f', kind: 'flat', ownerNoteId: 'p.0' }],
      }),
      whole('p'),
    );
    const dest = doc([punctum('a', 4), punctum('b', 3)]);
    const before = encodeDocument(dest);
    const r = pasteMusicalPassage(dest, whole('a'), clip, freshIds(clip));
    expect(r.rejection).toEqual({
      kind: 'existing-pitch-conflict',
      conflict: { ordinal: 1, degree: -1, expected: 0, actual: -1 },
    });
    expect(r.rejection && pasteRejectionMessage(r.rejection)).toContain(
      'change existing note 1 after the insertion point from B-natural to B-flat',
    );
    expect(encodeDocument(dest)).toBe(before);
    // Pasting before a division keeps the existing B natural.
    const barred = doc([punctum('a', 4), punctum('b', 3)], {
      divisions: [{ id: 'd', kind: 'minima', beforeNeumeId: 'b' }],
    });
    expect(rejection(barred, whole('a'), clip)).toBeNull();
  });

  it('rejects rather than relocating an existing anchor that the insertion invalidates', () => {
    // Existing flat on b is written above a; pitches agree after inserting
    // a flat-bearing B between them, but the existing anchor would no longer
    // be first among matching Bs.
    const dest = doc([punctum('a', 4), punctum('b', 3)], {
      accidentals: [
        {
          id: 'g',
          kind: 'flat',
          ownerNoteId: 'b.0',
          placement: { kind: 'above-note', noteId: 'a.0' },
        },
      ],
    });
    const clip = copy(
      doc([punctum('p', 3)], {
        accidentals: [{ id: 'f', kind: 'flat', ownerNoteId: 'p.0' }],
      }),
      whole('p'),
    );
    const r = pasteMusicalPassage(dest, whole('a'), clip, freshIds(clip));
    expect(r.rejection?.kind).toBe('invalid-placement');
  });

  it('rejects unrepresentable positions', () => {
    const clip = copy(doc([punctum('p', 4)]), whole('p'));
    const huge: MusicalClipboard = {
      ...clip,
      events: [
        {
          type: 'neume',
          neume: {
            template: { id: '', kind: 'punctum', notes: [note('', 0)] },
            pitches: [{ degree: Number.MAX_SAFE_INTEGER, alteration: 0 }],
          },
        },
      ],
    };
    expect(rejection(doc([]), none, huge)?.kind).toBe('unsafe-pitch');
  });

  it('round-trips every bundled example passage without lyrics or clef context', () => {
    for (const example of bundledExamples) {
      const source = { ...loadBundledExample(example.id), syllables: [] };
      const ids = source.neumes.map((n) => n.id);
      const clip = copy(source, range(ids[0], ids.at(-1) ?? ''));
      // Pasting at the start of the same score, before the first neume, is
      // under the initial clef; compare degrees by resolving the result.
      const result = paste(
        {
          ...source,
          neumes: [],
          divisions: [],
          clefChanges: [],
          accidentals: [],
        },
        none,
        clip,
      );
      const after = resolveEffectivePitches(result.document);
      const original = resolveEffectivePitches(source);
      const sourceNotes = source.neumes.flatMap((n) =>
        n.notes.map((x) => x.id),
      );
      const pastedNotes = result.document.neumes.flatMap((n) =>
        n.notes.map((x) => x.id),
      );
      expect(
        pastedNotes.map((id) => [
          after?.get(id)?.degree,
          after?.get(id)?.alteration,
        ]),
      ).toEqual(
        sourceNotes.map((id) => [
          original?.get(id)?.degree,
          original?.get(id)?.alteration,
        ]),
      );
      expect(result.document.accidentals).toHaveLength(
        source.accidentals.length,
      );
    }
  });
});
