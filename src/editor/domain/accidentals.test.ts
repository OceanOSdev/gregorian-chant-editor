import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type StaffLine,
} from './chant-document';
import {
  bRegister,
  hasValidAccidentals,
  pitchContexts,
  reconcileAccidentals,
  resolveEffectivePitches,
} from './accidentals';
import { clefOffset } from './clef';
import {
  blankDocument,
  decodeDocument,
  encodeDocument,
} from '../persistence/native-document';
import {
  deleteAccidental,
  placeAccidental,
  updateAccidental,
} from '../commands/update-accidental';
import { deleteNote } from '../commands/delete-note';
import { moveNoteVertically } from '../commands/move-note';
import { moveNeumeVertically } from '../commands/move-neume';
import { deleteNeume } from '../commands/delete-neume';
import { insertDivision } from '../commands/edit-division';
import { updateClef } from '../commands/update-clef';
import {
  preserveClefMelody,
  insertClefChange,
  deleteClefChange,
} from '../commands/edit-clef-change';
import {
  createDocumentHistory,
  applyDocumentEdit,
  undoDocumentEdit,
  redoDocumentEdit,
} from '../state/document-history';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { layoutChant } from '../layout/layout-chant';
const referenceSources = import.meta.glob<string>(
  '../../../docs/verification/b-accidentals/*.chant.json',
  { query: '?raw', import: 'default', eager: true },
);

function note(id: string, position: number) {
  return { id, staffPosition: staffPosition(position) };
}
function punctum(id: string, position: number): Neume {
  return { id, kind: 'punctum', notes: [note(id + 'n', position)] };
}
function specimen(): ChantDocument {
  return {
    ...blankDocument(),
    clef: { type: 'c', staffLine: 4 },
    neumes: [
      punctum('f', 2),
      { id: 'ga', kind: 'podatus', notes: [note('g', 3), note('a', 4)] },
      punctum('b', 5),
      punctum('next', 5),
      punctum('low', -2),
    ],
    syllables: [
      { id: 'word', text: 'o', startsAtNeumeId: 'f', boundaryBefore: 'word' },
    ],
  };
}
const flat = (d = specimen()) => updateAccidental(d, 'bn', 'flat', 'flat');
const anchored = () => placeAccidental(flat(), 'flat', 'fn');
const pitches = (d: ChantDocument) =>
  [...(resolveEffectivePitches(d)?.values() ?? [])].map((p) => [
    p.degree,
    p.alteration,
  ]);

describe('register-specific written accidentals', () => {
  it.each([-8, -1, 6, 13])('normalizes B degree %i', (d) =>
    expect(bRegister(d)).toBe(d),
  );
  it.each(['c', 'f'] as const)('identifies B on every %s clef line', (type) => {
    for (const staffLine of [1, 2, 3, 4] as StaffLine[])
      for (const degree of [-1, 6]) {
        const d = blankDocument();
        d.clef = { type, staffLine };
        d.neumes = [punctum('b', degree - clefOffset(d.clef))];
        expect(updateAccidental(d, 'bn', 'flat', 's').accidentals).toHaveLength(
          1,
        );
      }
  });
  it('applies at the written location without altering F/G/A or another register', () => {
    const d = anchored();
    expect(hasValidAccidentals(d)).toBe(true);
    expect(pitches(d)).toEqual([
      [-4, 0],
      [-3, 0],
      [-2, 0],
      [-1, -1],
      [-1, -1],
      [-8, 0],
    ]);
    expect(resolveEffectivePitches(d)?.get('fn')?.sourceAccidentalId).toBe(
      null,
    );
    expect(resolveEffectivePitches(d)?.get('nextn')?.sourceAccidentalId).toBe(
      'flat',
    );
  });
  it('keeps redundant signs and natural cancels only its register', () => {
    let d = updateAccidental(anchored(), 'lown', 'flat', 'low-flat');
    d = updateAccidental(d, 'nextn', 'natural', 'natural');
    expect(d.accidentals.map((a) => a.kind)).toEqual([
      'flat',
      'flat',
      'natural',
    ]);
    expect(resolveEffectivePitches(d)?.get('nextn')?.alteration).toBe(0);
    expect(resolveEffectivePitches(d)?.get('lown')?.alteration).toBe(-1);
    expect(updateAccidental(d, 'nextn', 'natural', 'unused')).toBe(d);
    expect(
      updateAccidental(d, 'nextn', 'flat', 'unused').accidentals.at(-1)?.id,
    ).toBe('natural');
  });
  it.each(['minima', 'minor', 'maior', 'finalis'] as const)(
    '%s resets every register within a word',
    (kind) => {
      const d = flat();
      d.divisions = [{ id: 'bar', kind, beforeNeumeId: 'next' }];
      expect(resolveEffectivePitches(d)?.get('nextn')?.alteration).toBe(0);
      expect(d.accidentals).toHaveLength(1);
    },
  );
  it('resets at words, preserves continuation and additional neumes, and applies new-word prefix after reset', () => {
    const d = flat();
    d.syllables.push({
      id: 'two',
      text: 'mnis',
      startsAtNeumeId: 'next',
      boundaryBefore: 'continuation',
    });
    expect(resolveEffectivePitches(d)?.get('nextn')?.alteration).toBe(-1);
    d.syllables[1].boundaryBefore = 'word';
    expect(resolveEffectivePitches(d)?.get('nextn')?.alteration).toBe(0);
    expect(
      resolveEffectivePitches(updateAccidental(d, 'nextn', 'flat', 'new'))?.get(
        'nextn',
      )?.alteration,
    ).toBe(-1);
    d.syllables = [];
    expect(resolveEffectivePitches(d)?.get('nextn')?.alteration).toBe(-1);
  });
  it.each(['torculus', 'porrectus'] as const)(
    '%s shares canonical owner and deletion respects original owner',
    (kind) => {
      const d = specimen();
      d.syllables = [];
      d.neumes = [
        {
          id: 'repeat',
          kind,
          notes: [
            note('first', 5),
            note('middle', kind === 'torculus' ? 6 : 4),
            note('last', 5),
          ],
        },
      ];
      const signed = updateAccidental(d, 'last', 'flat', 's');
      expect(signed.accidentals[0].ownerNoteId).toBe('first');
      expect(pitches(signed).map((p) => p[1])).toEqual([-1, 0, -1]);
      expect(updateAccidental(signed, 'first', 'flat', 'unused')).toBe(signed);
      expect(deleteNote(signed, 'last').accidentals).toEqual(
        signed.accidentals,
      );
      expect(deleteNote(signed, 'first').accidentals).toEqual([]);
    },
  );
  it('allows two registers per wide neume and rejects ambiguous convergence', () => {
    const d = specimen();
    d.syllables = [];
    d.neumes = [
      {
        id: 'wide',
        kind: 'torculus',
        notes: [note('first', -2), note('middle', 6), note('last', 5)],
      },
    ];
    const signed = updateAccidental(
      updateAccidental(d, 'first', 'flat', 's1'),
      'last',
      'natural',
      's2',
    );
    expect(signed.accidentals).toHaveLength(2);
    const collision = {
      ...signed,
      neumes: [
        {
          ...signed.neumes[0],
          notes: [note('first', 5), note('middle', 6), note('last', 5)],
        } as Neume,
      ],
    };
    expect(reconcileAccidentals(signed, collision)).toBe(null);
    const h = createDocumentHistory(signed);
    expect(applyDocumentEdit(h, () => collision)).toBe(h);
  });
  it('None and glyph deletion remove only the written entity, preserving inherited effects', () => {
    const d = updateAccidental(flat(), 'nextn', 'natural', 'cancel');
    const next = updateAccidental(d, 'nextn', undefined, 'unused');
    expect(resolveEffectivePitches(next)?.get('nextn')?.alteration).toBe(-1);
    expect(deleteAccidental(d, 'cancel')).toEqual(next);
    expect(next.neumes).toBe(d.neumes);
  });
});

describe('earlier-note placement and mutation', () => {
  it.each([
    'laetatus-torculus',
    'ecce-porrectus',
    'benedicta-mater',
    'beata-natural',
    'beata-editor',
  ])('validates and round trips the dedicated %s reference fixture', (name) => {
    const source =
      referenceSources[
        `../../../docs/verification/b-accidentals/${name}.chant.json`
      ];
    const d = decodeDocument(source);
    expect(hasValidAccidentals(d)).toBe(true);
    expect(decodeDocument(encodeDocument(d))).toEqual(d);
    expect(layoutChant(d).systems.length).toBeGreaterThan(0);
  });
  it('canonicalizes a surviving owner only after evaluating owner loss', () => {
    const d = specimen();
    d.syllables = [];
    d.neumes = [
      {
        id: 'tor',
        kind: 'torculus',
        notes: [note('first', 4), note('middle', 6), note('last', 5)],
      },
    ];
    const signed = updateAccidental(d, 'last', 'flat', 's');
    expect(moveNoteVertically(signed, 'first', 1).accidentals).toEqual([
      { id: 's', kind: 'flat', ownerNoteId: 'first' },
    ]);
    expect(deleteNote(signed, 'last').accidentals).toEqual([]);
  });
  it('round trips default and explicit signs with all note fields, divisions and clefs', () => {
    const d = anchored();
    d.divisions = [{ id: 'bar', kind: 'minima', beforeNeumeId: 'f' }];
    d.clefChanges = [
      {
        id: 'clef',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'b',
        beforeDivisionId: null,
      },
    ];
    d.neumes[0].notes[0] = {
      ...d.neumes[0].notes[0],
      form: 'inclinatum',
      mora: 1,
      episema: true,
      verticalEpisema: true,
    };
    const mixed = updateAccidental(d, 'nextn', 'natural', 'cancel');
    expect(decodeDocument(encodeDocument(mixed))).toEqual(mixed);
    for (const id of ['fn', 'f', 'word', 'bar', 'clef']) {
      const payload = JSON.parse(encodeDocument(mixed));
      payload.document.accidentals[0].id = id;
      expect(() => decodeDocument(JSON.stringify(payload))).toThrow();
    }
  });
  it('rejects later, missing, same-neume, interrupted and intervening-B anchors without repair', () => {
    const d = flat();
    for (const id of ['bn', 'nextn', 'missing'])
      expect(placeAccidental(d, 'flat', id)).toBe(d);
    for (const reset of ['word', 'division', 'b', 'sign']) {
      const candidate = structuredClone(d);
      if (reset === 'word')
        candidate.syllables.push({
          id: 'new-word',
          text: 'new',
          startsAtNeumeId: 'b',
          boundaryBefore: 'word',
        });
      if (reset === 'division')
        candidate.divisions.push({
          id: 'bar',
          kind: 'minima',
          beforeNeumeId: 'b',
        });
      if (reset === 'b') candidate.neumes[1] = punctum('intervening', 5);
      if (reset === 'sign') {
        candidate.neumes[1] = punctum('intervening', 5);
        candidate.accidentals.push({
          id: 'other',
          kind: 'flat',
          ownerNoteId: 'interveningn',
        });
      }
      expect(placeAccidental(candidate, 'flat', 'fn')).toBe(candidate);
    }
  });
  it('preserves owner, ID and kind on restore; same placements are no-ops', () => {
    const d = anchored();
    expect(placeAccidental(d, 'flat', 'fn')).toBe(d);
    expect(placeAccidental(d, 'flat', null)).toEqual(flat());
    const defaultPlacement = flat();
    expect(placeAccidental(defaultPlacement, 'flat', null)).toBe(
      defaultPlacement,
    );
  });
  it('deleting the anchor restores default; deleting the owner removes its sign', () => {
    const d = anchored();
    expect(deleteNote(d, 'fn').accidentals).toEqual(flat().accidentals);
    expect(deleteNeume(d, 'f').accidentals).toEqual(flat().accidentals);
    expect(deleteNote(d, 'bn').accidentals).toEqual([]);
    expect(deleteNote(d, 'nextn').accidentals).toEqual(d.accidentals);
    expect(moveNoteVertically(d, 'fn', 1).accidentals).toEqual(d.accidentals);
    expect(moveNoteVertically(d, 'bn', 1).accidentals).toEqual([]);
    expect(moveNeumeVertically(d, 'b', 7).accidentals[0]?.ownerNoteId).toBe(
      'bn',
    );
  });
  it('repairs resets atomically and undo/redo restores exact authored placement', () => {
    const d = anchored(),
      h = createDocumentHistory(d);
    const next = applyDocumentEdit(h, (doc) =>
      insertDivision(
        doc,
        { id: 'bar', kind: 'minima', beforeNeumeId: 'b' },
        { beforeNeumeId: 'b', beforeDivisionId: null, beforeClefId: null },
      ),
    );
    expect(next.present.accidentals).toEqual(flat().accidentals);
    expect(next.past).toHaveLength(1);
    expect(undoDocumentEdit(next).present).toBe(d);
    expect(redoDocumentEdit(undoDocumentEdit(next)).present).toBe(next.present);
  });
  it('supports default and anchored strict v5 round trips', () => {
    for (const d of [flat(), anchored()]) {
      expect(JSON.parse(encodeDocument(d)).version).toBe(5);
      expect(decodeDocument(encodeDocument(d))).toEqual(d);
    }
  });
  it.each([
    null,
    {},
    [],
    { kind: 'unknown', noteId: 'fn' },
    { kind: 'above-note', noteId: 'missing' },
    { kind: 'above-note', noteId: 'bn' },
    { kind: 'above-note', noteId: 'fn', x: 1 },
  ])('rejects malformed placement %j', (placement) => {
    const p = JSON.parse(encodeDocument(flat()));
    p.document.accidentals[0].placement = placement;
    expect(() => decodeDocument(JSON.stringify(p))).toThrow();
  });
  it.each([
    null,
    {},
    [{}],
    [{ id: 'bad', kind: 'sharp', ownerNoteId: 'bn' }],
    [{ id: 'fn', kind: 'flat', ownerNoteId: 'bn' }],
    [{ id: 'bad', kind: 'flat', ownerNoteId: 'fn' }],
  ])('rejects malformed collection %j', (accidentals) => {
    const p = JSON.parse(encodeDocument(flat()));
    p.document.accidentals = accidentals;
    expect(() => decodeDocument(JSON.stringify(p))).toThrow();
  });
  it.each([1, 2, 3, 4])(
    'keeps v%i exact and migrates only in memory',
    (version) => {
      const p = JSON.parse(encodeDocument(specimen()));
      p.version = version;
      expect(() => decodeDocument(JSON.stringify(p))).toThrow();
      delete p.document.accidentals;
      expect(decodeDocument(JSON.stringify(p)).accidentals).toEqual([]);
    },
  );
});

describe('clefs, layout and targeting', () => {
  it('retargeting the current anchor is a history no-op, and Cancel preserves a redo branch', () => {
    const d = anchored(),
      s = createEditorSession(d);
    const target = reduceEditorSession(s, {
      type: 'start-accidental-placement',
      id: 'flat',
    });
    const unchanged = reduceEditorSession(target, {
      type: 'commit-accidental-placement',
      noteId: 'fn',
    });
    expect(unchanged.history).toBe(s.history);
    expect(unchanged.accidentalTargetId).toBe(null);
    const edited = applyDocumentEdit(s.history, (doc) =>
      deleteAccidental(doc, 'flat'),
    );
    const undone = { ...s, history: undoDocumentEdit(edited) };
    const canceled = reduceEditorSession(
      reduceEditorSession(undone, {
        type: 'start-accidental-placement',
        id: 'flat',
      }),
      { type: 'cancel-accidental-placement' },
    );
    expect(canceled.history).toBe(undone.history);
    expect(canceled.history.future).toBe(undone.history.future);
  });
  it('preserves complete chromatic pitches, IDs and anchors across initial and explicit clefs', () => {
    const d = anchored();
    expect(pitches(updateClef(d, { type: 'f', staffLine: 2 }))).toEqual(
      pitches(d),
    );
    const c = insertClefChange(
      d,
      {
        id: 'clef',
        clef: { type: 'f', staffLine: 2 },
        beforeNeumeId: 'b',
        beforeDivisionId: null,
      },
      { beforeNeumeId: 'b', beforeDivisionId: null, beforeClefId: null },
    );
    const preserved = preserveClefMelody(d, c);
    expect(preserved).not.toBe(null);
    if (!preserved) throw Error('Expected preserved score');
    expect(pitches(preserved)).toEqual(pitches(d));
    expect(preserved.accidentals).toEqual(d.accidentals);
    const removed = preserveClefMelody(
      preserved,
      deleteClefChange(preserved, 'clef'),
    );
    expect(removed && pitches(removed)).toEqual(pitches(d));
  });
  it('warns only at clef commit, cancel preserves history, confirmation removes one sign atomically', () => {
    const d = flat();
    d.clefChanges = [
      {
        id: 'c',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: 'b',
        beforeDivisionId: null,
      },
    ];
    let s = createEditorSession(d);
    s = reduceEditorSession(s, {
      type: 'clef-insertion-policy',
      preserve: 'noteheads',
    });
    s = reduceEditorSession(s, { type: 'start-clef-change', id: 'c' });
    s = reduceEditorSession(s, {
      type: 'draft-clef-change',
      clef: { type: 'c', staffLine: 3 },
    });
    const history = s.history;
    const warning = reduceEditorSession(s, { type: 'apply-clef-change' });
    expect(warning.clefTransaction?.accidentalLossCount).toBe(1);
    expect(warning.history).toBe(history);
    expect(
      reduceEditorSession(warning, { type: 'cancel-clef-change' }).history,
    ).toBe(history);
    const confirmed = reduceEditorSession(warning, {
      type: 'confirm-clef-change',
      preserve: 'noteheads',
    });
    expect(confirmed.history.past).toHaveLength(1);
    expect(confirmed.history.present.accidentals).toEqual([]);
    expect(undoDocumentEdit(confirmed.history).present).toBe(history.present);
  });
  it('targeting guards competing edits and cancellation leaves exact history', () => {
    const s = createEditorSession(flat()),
      target = reduceEditorSession(s, {
        type: 'start-accidental-placement',
        id: 'flat',
      });
    expect(target.accidentalTargetId).toBe('flat');
    expect(
      reduceEditorSession(target, {
        type: 'edit',
        edit: deleteAccidental.bind(null, s.history.present, 'flat'),
      }),
    ).toBe(target);
    expect(
      reduceEditorSession(target, { type: 'cancel-accidental-placement' })
        .history,
    ).toBe(s.history);
    const placed = reduceEditorSession(target, {
      type: 'commit-accidental-placement',
      noteId: 'fn',
    });
    expect(placed.history.present).toEqual(anchored());
    expect(placed.history.past).toHaveLength(1);
  });
  it('wraps explicit signs with the anchor and keeps pitch state across systems', () => {
    const d = specimen();
    d.neumes.splice(
      1,
      0,
      ...Array.from({ length: 24 }, (_, i) => punctum('extra' + i, 3)),
    );
    const signed = placeAccidental(flat(d), 'flat', 'fn'),
      layout = layoutChant(signed);
    const anchor = layout.systems.find((s) =>
      s.neumes.some((n) => n.neumeId === 'f'),
    );
    const owner = layout.systems.find((s) =>
      s.neumes.some((n) => n.neumeId === 'b'),
    );
    expect(anchor?.index).toBeLessThan(owner?.index ?? 0);
    expect(anchor?.neumes[0].accidentals).toHaveLength(1);
    expect(
      owner?.neumes.find((n) => n.neumeId === 'b')?.accidentals,
    ).toBeUndefined();
    expect(resolveEffectivePitches(signed)?.get('bn')?.alteration).toBe(-1);
    expect(pitchContexts(signed)?.get('fn')?.degree).toBe(-4);
  });
});
