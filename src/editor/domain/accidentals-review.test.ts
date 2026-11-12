import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Clef,
  type StaffLine,
} from './chant-document';
import { blankDocument } from '../persistence/native-document';
import {
  hasValidAccidentals,
  reconcileAccidentals,
  reconcileAccidentalsResult,
  resolveEffectivePitches,
} from './accidentals';
import {
  updateAccidental,
  placeAccidental,
} from '../commands/update-accidental';
import { moveNoteVerticallyResult } from '../commands/move-note';
import { deleteNote } from '../commands/delete-note';
import {
  insertClefChangeCandidate,
  updateClefChangeCandidate,
  updateClefChange,
  preserveClefMelody,
  preserveClefMelodyResult,
} from '../commands/edit-clef-change';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { layoutChant } from '../layout/layout-chant';

function fixture(): ChantDocument {
  const d = blankDocument();
  d.clef = { type: 'c', staffLine: 4 };
  d.neumes = [2, 3, 5, -2].map((p, i) => ({
    id: `g${i}`,
    kind: 'punctum',
    notes: [{ id: `n${i}`, staffPosition: staffPosition(p) }],
  }));
  return d;
}
function anchored() {
  return placeAccidental(
    updateAccidental(fixture(), 'n2', 'flat', 'flat'),
    'flat',
    'n0',
  );
}
function pitches(d: ChantDocument) {
  return [...(resolveEffectivePitches(d)?.values() ?? [])].map((p) => [
    p.note.id,
    p.degree,
    p.alteration,
  ]);
}

it('restores the intrinsically invalid overlapping span first, preserving the other anchor after a seven-degree clef reinterpretation', () => {
  let d = anchored();
  d = placeAccidental(
    updateAccidental(d, 'n3', 'natural', 'natural'),
    'natural',
    'n1',
  );
  d.clefChanges = [
    {
      id: 'clef',
      clef: { type: 'c', staffLine: 4 },
      beforeNeumeId: 'g3',
      beforeDivisionId: null,
    },
  ];
  expect(hasValidAccidentals(d)).toBe(true);
  const candidate = updateClefChangeCandidate(d, 'clef', {
    type: 'f',
    staffLine: 2,
  });
  const repaired = reconcileAccidentals(d, candidate);
  expect(repaired?.accidentals).toEqual([
    d.accidentals[0],
    { id: 'natural', kind: 'natural', ownerNoteId: 'n3' },
  ]);
  expect(hasValidAccidentals(repaired ?? d)).toBe(true);
  const reversed = reconcileAccidentals(d, {
    ...candidate,
    accidentals: [...candidate.accidentals].reverse(),
  });
  expect(reversed?.accidentals.find((a) => a.id === 'flat')).toEqual(
    d.accidentals[0],
  );
  expect(updateClefChange(d, 'clef', { type: 'f', staffLine: 2 })).toEqual(
    repaired,
  );
  let session = createEditorSession(d);
  session = reduceEditorSession(session, {
    type: 'clef-insertion-policy',
    preserve: 'noteheads',
  });
  session = reduceEditorSession(session, {
    type: 'start-clef-change',
    id: 'clef',
  });
  session = reduceEditorSession(session, {
    type: 'draft-clef-change',
    clef: { type: 'f', staffLine: 2 },
  });
  session = reduceEditorSession(session, { type: 'apply-clef-change' });
  expect(session.history.present).toEqual(repaired);
  expect(session.history.past).toEqual([d]);
  const undo = reduceEditorSession(session, {
    type: 'history',
    direction: 'undo',
    focusedNoteId: null,
  });
  expect(undo.history.present).toBe(d);
  expect(
    reduceEditorSession(undo, {
      type: 'history',
      direction: 'redo',
      focusedNoteId: null,
    }).history.present,
  ).toEqual(repaired);
});

it('preserves exact placement and chromatic pitches through an actual clef transaction between anchor and owner', () => {
  const d = anchored();
  d.clefChanges = [
    {
      id: 'clef',
      clef: { type: 'c', staffLine: 4 },
      beforeNeumeId: 'g2',
      beforeDivisionId: null,
    },
  ];
  let s = createEditorSession(d);
  s = reduceEditorSession(s, { type: 'start-clef-change', id: 'clef' });
  s = reduceEditorSession(s, {
    type: 'draft-clef-change',
    clef: { type: 'c', staffLine: 3 },
  });
  s = reduceEditorSession(s, { type: 'apply-clef-change' });
  const after = s.history.present;
  expect(after).not.toBe(d);
  expect(pitches(after)).toEqual(pitches(d));
  expect(after.accidentals).toEqual(d.accidentals);
  expect(s.history.past).toEqual([d]);
  const glyph = (score: ChantDocument) =>
    layoutChant(score)
      .systems.flatMap((x) => x.neumes)
      .flatMap((n) => n.accidentals ?? [])[0];
  expect(glyph(after).ink.bounds.y).toBe(glyph(d).ink.bounds.y);
});

it('bounded clef comparison finds no accidental-only preservation rejection for valid normal-range anchored scores', () => {
  const clefs: Clef[] = ['c', 'f'].flatMap((type) =>
    [1, 2, 3, 4].map((staffLine) => ({
      type: type as Clef['type'],
      staffLine: staffLine as StaffLine,
    })),
  );
  let checked = 0;
  let preserved = 0;
  for (const clef of clefs)
    for (const boundary of ['g0', 'g1', 'g2', 'g3']) {
      const d = anchored();
      const c = insertClefChangeCandidate(
        d,
        { id: 'c', clef, beforeNeumeId: boundary, beforeDivisionId: null },
        { beforeNeumeId: boundary, beforeDivisionId: null, beforeClefId: null },
      );
      const bare = { ...d, accidentals: [] };
      const plain = preserveClefMelody(bare, { ...c, accidentals: [] });
      const signed = preserveClefMelody(d, c);
      expect(signed === null).toBe(plain === null);
      if (signed) {
        expect(pitches(signed)).toEqual(pitches(d));
        expect(signed.accidentals).toEqual(d.accidentals);
        preserved++;
      }
      checked++;
    }
  expect(checked).toBe(32);
  // Every valid normal-range candidate, including clefs between the earlier
  // anchor (g0) and owner (g2), reaches the success-path assertions.
  expect(preserved).toBe(32);
});

it('reports ownership conflict explicitly and leaves unrelated no-ops and contour rejections silent with two signs', () => {
  let d = fixture();
  d = updateAccidental(
    updateAccidental(d, 'n2', 'flat', 'flat'),
    'n3',
    'natural',
    'natural',
  );
  const collision: ChantDocument = {
    ...d,
    neumes: [
      {
        id: 'tor',
        kind: 'torculus' as const,
        notes: [
          { id: 'n2', staffPosition: staffPosition(5) },
          { id: 'middle', staffPosition: staffPosition(6) },
          { id: 'n3', staffPosition: staffPosition(5) },
        ],
      },
    ],
  };
  const result = reconcileAccidentalsResult(d, collision);
  expect(result.rejection).toBe('ownership-conflict');
  const s = createEditorSession(d);
  const rejected = reduceEditorSession(s, { type: 'edit', edit: () => result });
  expect(rejected.history).toBe(s.history);
  expect(rejected.announcement.text).toMatch(/conflicting accidental/);
  expect(reduceEditorSession(s, { type: 'edit', edit: (doc) => doc })).toBe(s);
  expect(
    reduceEditorSession(s, {
      type: 'edit',
      edit: (doc) => moveNoteVerticallyResult(doc, 'missing', 1),
    }),
  ).toBe(s);
  expect(deleteNote(d, 'missing')).toBe(d);
  const contour: ChantDocument = {
    ...d,
    neumes: [
      ...d.neumes,
      {
        id: 'pes',
        kind: 'podatus',
        notes: [
          { id: 'lower', staffPosition: staffPosition(2) },
          { id: 'upper', staffPosition: staffPosition(3) },
        ],
      },
    ],
  };
  const contourSession = createEditorSession(contour);
  expect(
    reduceEditorSession(contourSession, {
      type: 'edit',
      edit: (doc) => moveNoteVerticallyResult(doc, 'lower', 1),
    }),
  ).toBe(contourSession);
  const limit: ChantDocument = {
    ...d,
    neumes: [
      ...d.neumes,
      {
        id: 'limit',
        kind: 'punctum',
        notes: [
          {
            id: 'limit-note',
            staffPosition: staffPosition(Number.MAX_SAFE_INTEGER),
          },
        ],
      },
    ],
  };
  const limitSession = createEditorSession(limit);
  expect(
    reduceEditorSession(limitSession, {
      type: 'edit',
      edit: (doc) => moveNoteVerticallyResult(doc, 'limit-note', 1),
    }),
  ).toBe(limitSession);
});

describe('placement session feedback and deletion focus', () => {
  it('announces start, invalid rejection, unchanged anchor and cancellation without history changes', () => {
    const s = createEditorSession(anchored());
    const target = reduceEditorSession(s, {
      type: 'start-accidental-placement',
      id: 'flat',
    });
    expect(target.announcement.text).toMatch(/Choose an eligible/);
    expect(
      reduceEditorSession(target, {
        type: 'start-accidental-placement',
        id: 'flat',
      }),
    ).toBe(target);
    expect(
      reduceEditorSession(target, { type: 'delete-accidental', id: 'flat' }),
    ).toBe(target);
    const invalid = reduceEditorSession(target, {
      type: 'commit-accidental-placement',
      noteId: 'n3',
    });
    expect(invalid.history).toBe(s.history);
    expect(invalid.announcement.text).toMatch(/not an eligible/);
    const unchanged = reduceEditorSession(target, {
      type: 'commit-accidental-placement',
      noteId: 'n0',
    });
    expect(unchanged.history).toBe(s.history);
    expect(unchanged.announcement.text).toMatch(/unchanged/);
    const canceled = reduceEditorSession(target, {
      type: 'cancel-accidental-placement',
    });
    expect(canceled.history).toBe(s.history);
    expect(canceled.announcement.text).toMatch(/canceled/);
    expect(canceled.focusRequest).toEqual({
      kind: 'accidental',
      accidentalId: 'flat',
    });
  });
  it.each([true, false])(
    'deletion returns focus to the owner with selected=%s',
    (selected) => {
      const s = createEditorSession(anchored());
      if (selected) s.selection = { kind: 'accidental', accidentalId: 'flat' };
      const next = reduceEditorSession(s, {
        type: 'delete-accidental',
        id: 'flat',
      });
      expect(next.history.present.accidentals).toEqual([]);
      expect(next.history.present.neumes).toBe(s.history.present.neumes);
      expect(next.history.past).toEqual([s.history.present]);
      expect(next.focusRequest).toEqual({ kind: 'note', noteId: 'n2' });
    },
  );
  it.each(['', 'men'])(
    'focused glyph deletion during a lyric entry with draft %j deletes once and preserves the draft',
    (draft) => {
      let s = createEditorSession(anchored());
      s = reduceEditorSession(s, {
        type: 'lyrics',
        action: { type: 'start', neumeId: 'g3' },
        newId: 'lyric',
      });
      if (draft)
        s = reduceEditorSession(s, {
          type: 'lyrics',
          action: { type: 'text', text: draft },
          newId: 'lyric',
        });
      expect(s.lyrics?.kind).toBe('draft');
      const lyrics = s.lyrics;
      const next = reduceEditorSession(s, {
        type: 'delete-accidental',
        id: 'flat',
      });
      expect(next.history.present.accidentals).toEqual([]);
      expect(next.history.present.neumes).toBe(s.history.present.neumes);
      expect(next.history.present.syllables).toBe(s.history.present.syllables);
      expect(next.history.past).toEqual([...s.history.past, s.history.present]);
      expect(next.lyrics).toBe(lyrics);
      expect(next.pendingHistory).toBeNull();
      expect(next.focusRequest).toEqual({ kind: 'note', noteId: 'n2' });
      expect(next.announcement.text).toBe('Accidental deleted.');
    },
  );
});

it('distinguishes intermediate clef candidates from finalized public edits', () => {
  const d = anchored();
  d.clefChanges = [
    {
      id: 'c',
      clef: { type: 'c', staffLine: 4 },
      beforeNeumeId: 'g2',
      beforeDivisionId: null,
    },
  ];
  const candidate = updateClefChangeCandidate(d, 'c', {
    type: 'c',
    staffLine: 3,
  });
  expect(hasValidAccidentals(candidate)).toBe(false);
  const finalized = updateClefChange(d, 'c', { type: 'c', staffLine: 3 });
  expect(hasValidAccidentals(finalized)).toBe(true);
  expect(finalized.accidentals).toEqual([]);
});

it('diagnoses non-overflow accidental preservation failures explicitly for invalid candidate ownership', () => {
  const d = anchored();
  const candidate = { ...d, neumes: d.neumes.filter((n) => n.id !== 'g2') };
  expect(
    preserveClefMelody(
      { ...d, accidentals: [] },
      { ...candidate, accidentals: [] },
    ),
  ).not.toBe(null);
  expect(preserveClefMelodyResult(d, candidate)).toEqual({
    document: null,
    reason: 'accidental-preservation',
  });
});
