import { describe, expect, it } from 'vitest';
import { staffPosition, type ChantDocument } from '../domain/chant-document';
import { deriveScoreOrder } from '../domain/divisions';
import {
  insertDivision,
  deleteDivision,
  updateDivisionKind,
} from '../commands/edit-division';
import {
  insertEditorNeume,
  resolveEditorToolbarInsertion,
} from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { resolveScoreSlot } from '../interaction/resolve-score-slot';
import {
  createEditorSession,
  reduceEditorSession,
} from '../state/editor-session';
import { layoutChant, staffEndX, staffLineSpacing } from './layout-chant';
import type { MeasureLyricText } from './lyric-text-metrics';
const measure: MeasureLyricText = (text) => ({
  width: text.length * 10,
  boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 10),
});
const ids = { neumeId: 'X', noteIds: ['x0', 'x1', 'x2'] as const };
function fixture(count = 2): ChantDocument {
  return {
    accidentals: [],
    title: 'Divisions',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: staffPosition(2) }],
    })),
    syllables: [],
    clefChanges: [],
    divisions: [],
  };
}
function order(d: ChantDocument) {
  return deriveScoreOrder(d)?.map((i) => i.entity.id);
}
function divided(count = 2) {
  const d = fixture(count);
  return insertDivision(
    d,
    { id: 'D', kind: 'minima', beforeNeumeId: 'n1' },
    { beforeNeumeId: 'n1', beforeDivisionId: null },
  );
}

describe('derived division layout and explicit insertion', () => {
  it.each(['minima', 'minor', 'maior', 'finalis'] as const)(
    'measures %s from staff lines and pads disjoint targets',
    (kind) => {
      const d = divided();
      d.divisions = [{ ...d.divisions[0], kind }];
      const s = layoutChant(d).systems[0],
        bar = s.divisions[0];
      const top = Math.min(...s.staffLines.map((l) => l.y)),
        bottom = Math.max(...s.staffLines.map((l) => l.y));
      expect(bar.lines).toHaveLength(kind === 'finalis' ? 2 : 1);
      expect(bar.bounds.height).toBe(
        kind === 'minima'
          ? staffLineSpacing
          : kind === 'minor'
            ? 2 * staffLineSpacing
            : bottom - top,
      );
      expect(bar.bounds.y).toBe(
        kind === 'minima'
          ? top - staffLineSpacing / 2
          : kind === 'minor'
            ? top + staffLineSpacing / 2
            : top,
      );
      expect(bar.hitBounds.x).toBeGreaterThan(
        s.neumes[0].notes[0].hitBounds.x + s.neumes[0].notes[0].hitBounds.width,
      );
      expect(bar.hitBounds.x + bar.hitBounds.width).toBeLessThan(
        s.neumes[1].notes[0].hitBounds.x,
      );
    },
  );
  it.each(['left', 'right'] as const)(
    'pointer caret and commit agree on the %s side; anchors survive',
    (side) => {
      const d = divided();
      d.syllables = [
        { id: 's', text: 'Al', boundaryBefore: 'word', startsAtNeumeId: 'n1' },
      ];
      const l = layoutChant(d, measure),
        s = l.systems[0],
        bar = s.divisions[0];
      const slot = s.slots[side === 'left' ? 1 : 2];
      const result = resolveGraphicalNeumePlacement(l, 'punctum', {
        x: slot.x,
        y: 100,
      });
      expect(result?.preview.caret.x).toBe(slot.x);
      expect(
        side === 'left'
          ? slot.x < bar.bounds.x
          : slot.x > bar.bounds.x + bar.bounds.width,
      ).toBe(true);
      expect(result).not.toBeNull();
      if (!result) return;
      const next = insertEditorNeume(d, result, ids);
      expect(order(next)).toEqual(
        side === 'left' ? ['n0', 'X', 'D', 'n1'] : ['n0', 'D', 'X', 'n1'],
      );
      expect(next.syllables).toBe(d.syllables);
      expect(next.neumes.find((n) => n.id === 'n1')).toBe(d.neumes[1]);
    },
  );
  it('exposes every leading, adjacent and trailing slot, including division-only scores', () => {
    for (const count of [0, 1, 2]) {
      const d = fixture(count);
      const anchor = d.neumes[0]?.id ?? null;
      d.divisions = [
        { id: 'a', kind: 'minima', beforeNeumeId: anchor },
        { id: 'b', kind: 'minor', beforeNeumeId: anchor },
        { id: 'z', kind: 'finalis', beforeNeumeId: null },
      ];
      const s = layoutChant(d).systems[0];
      expect(s.slots).toHaveLength(count + 4);
      const boundaries = new Set();
      for (const slot of s.slots) {
        const resolved = resolveScoreSlot(layoutChant(d), {
          x: slot.x,
          y: 100,
        });
        expect(resolved?.slot.boundary).toEqual(slot.boundary);
        const next = insertEditorNeume(
          d,
          {
            kind: 'punctum',
            staffPositions: [staffPosition(2)],
            insertionIndex: slot.insertionIndex,
            boundary: slot.boundary,
          },
          ids,
        );
        expect(next.neumes).toHaveLength(count + 1);
        boundaries.add(JSON.stringify(slot.boundary));
      }
      expect(boundaries.size).toBe(count + 4);
      for (let i = 1; i < s.divisions.length; i++)
        expect(s.divisions[i].hitBounds.x).toBeGreaterThan(
          s.divisions[i - 1].hitBounds.x + s.divisions[i - 1].hitBounds.width,
        );
    }
  });
  it('wraps the previous neume with its trailing bar before it would orphan the bar', () => {
    for (let count = 2; count < 32; count++) {
      const d = fixture(count);
      d.divisions = [{ id: 'D', kind: 'finalis', beforeNeumeId: null }];
      const l = layoutChant(d),
        last = l.systems.at(-1);
      expect(last?.neumes.at(-1)?.neumeId).toBe(`n${count - 1}`);
      expect(last?.divisions[0].divisionId).toBe('D');
      expect(
        l.systems.every((s) => s.neumes.length + s.divisions.length > 0),
      ).toBe(true);
      for (const s of l.systems)
        for (const bar of s.divisions)
          expect(bar.bounds.x + bar.bounds.width).toBeLessThanOrEqual(
            staffEndX,
          );
    }
  });
  it('makes bounded progress for unbounded punctuation runs without losing items or making empty systems', () => {
    const d = fixture(1);
    d.divisions = Array.from({ length: 120 }, (_, i) => ({
      id: `d${i}`,
      kind: 'finalis',
      beforeNeumeId: null,
    }));
    const l = layoutChant(d);
    expect(
      l.systems.flatMap((s) => s.divisions).map((b) => b.divisionId),
    ).toEqual(d.divisions.map((b) => b.id));
    expect(
      l.systems.every((s) => s.neumes.length + s.divisions.length > 0),
    ).toBe(true);
    expect(l.systems.length).toBeLessThan(15);
  });
  it('blocks compaction without changing semantic lyrics and keeps measured hyphens after bars', () => {
    const d = divided();
    d.syllables = [
      { id: 's0', text: 'Al', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
      {
        id: 's1',
        text: 'le',
        startsAtNeumeId: 'n1',
        boundaryBefore: 'continuation',
      },
    ];
    const original = JSON.stringify(d),
      s = layoutChant(d, measure).systems[0];
    expect(
      s.neumes[1].bounds.x - s.neumes[0].bounds.x - s.neumes[0].bounds.width,
    ).toBeGreaterThan(33);
    expect(s.hyphens).toHaveLength(1);
    expect(s.hyphens[0].x - 5).toBeGreaterThan(
      s.divisions[0].bounds.x + s.divisions[0].bounds.width,
    );
    expect(s.hyphens[0].x + 5).toBeLessThan(Number(s.lyrics[1].left));
    expect(JSON.stringify(d)).toBe(original);
    for (const edited of [
      deleteDivision(d, 'D'),
      updateDivisionKind(d, 'D', 'maior'),
    ])
      expect(edited.syllables).toBe(d.syllables);
  });
  it('never forces a hyphen within one syllable or between words', () => {
    const d = divided(25);
    d.syllables = [
      { id: 's0', text: 'Al', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    ];
    expect(
      layoutChant(d, measure).systems.flatMap((s) => s.hyphens),
    ).toHaveLength(0);
    d.syllables.push({
      id: 's1',
      text: 'le',
      startsAtNeumeId: 'n1',
      boundaryBefore: 'word',
    });
    expect(
      layoutChant(d, measure).systems.flatMap((s) => s.hyphens),
    ).toHaveLength(0);
  });
  it('preserves outgoing continuation after a phrase-ending division across reflow', () => {
    const d = divided(40);
    d.divisions[0] = { id: 'D', kind: 'finalis', beforeNeumeId: 'n10' };
    d.syllables = [
      { id: 's0', text: 'Al', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
      {
        id: 's1',
        text: 'le',
        startsAtNeumeId: 'n39',
        boundaryBefore: 'continuation',
      },
    ];
    const l = layoutChant(d, measure);
    expect(l.systems[0].hyphens[0]?.outgoing).toBe(true);
    expect(l.systems[0].hyphens[0].x + 5).toBeLessThanOrEqual(staffEndX);
  });
  it('resolves contextual I before punctuation and requires an explicit choice for a selected division', () => {
    const d = divided();
    const insertion = resolveEditorToolbarInsertion(
      d,
      { kind: 'neume', neumeId: 'n0' },
      'punctum',
    );
    expect(insertion?.boundary).toEqual({
      beforeClefId: null,
      beforeNeumeId: 'n1',
      beforeDivisionId: 'D',
    });
    expect(
      resolveEditorToolbarInsertion(
        d,
        { kind: 'division', divisionId: 'D' },
        'punctum',
      ),
    ).toBeNull();
  });
  it('places persistently on current reducer geometry, replaces kind atomically and reconciles deletion/history', () => {
    const d = fixture();
    let state = createEditorSession(d);
    state = reduceEditorSession(state, {
      type: 'arm',
      tool: { kind: 'place-division', divisionKind: 'minor' },
    });
    expect(state.rememberedKind).toBe('punctum');
    const slot = layoutChant(d).systems[0].slots[1];
    for (const id of ['D', 'E'])
      state = reduceEditorSession(state, {
        type: 'place-division',
        point: { x: slot.x, y: 100 },
        kind: 'minor',
        id,
      });
    expect(state.history.present.divisions).toHaveLength(2);
    expect(state.activeTool.kind).toBe('place-division');
    expect(state.history.past).toHaveLength(2);
    state = reduceEditorSession(state, { type: 'select-tool' });
    state = reduceEditorSession(state, {
      type: 'change-division',
      id: 'E',
      kind: 'finalis',
    });
    expect(
      state.history.present.divisions.find((d) => d.id === 'E')?.kind,
    ).toBe('finalis');
    state = reduceEditorSession(state, { type: 'delete-division', id: 'E' });
    expect(state.selection.kind).toBe('none');
    state = reduceEditorSession(state, {
      type: 'history',
      direction: 'undo',
      focusedNoteId: null,
    });
    expect(
      state.history.present.divisions.find((d) => d.id === 'E')?.kind,
    ).toBe('finalis');
  });
});

it('keeps a finalis with an isolated oversized syllable and exposes its complete ink', () => {
  const d = fixture(2);
  d.divisions = [{ id: 'D', kind: 'finalis', beforeNeumeId: 'n1' }];
  d.syllables = [
    {
      id: 's0',
      text: 'a'.repeat(150),
      startsAtNeumeId: 'n0',
      boundaryBefore: 'word',
    },
  ];
  const l = layoutChant(d, measure),
    s = l.systems[0];
  expect(s.neumes.map((n) => n.neumeId)).toEqual(['n0']);
  expect(s.divisions.map((d) => d.divisionId)).toEqual(['D']);
  expect(l.x + l.width).toBeGreaterThan(
    s.divisions[0].bounds.x + s.divisions[0].bounds.width,
  );
  expect(l.systems[1].neumes[0].neumeId).toBe('n1');
});

it('preserves dirty lyric drafts through division editing and blocks unresolved mode changes/history', () => {
  const d = divided();
  let state = createEditorSession(d);
  state = reduceEditorSession(state, {
    type: 'lyrics',
    action: { type: 'start', neumeId: 'n0' },
    newId: 's',
  });
  state = reduceEditorSession(state, {
    type: 'lyrics',
    action: { type: 'text', text: 'Al' },
    newId: 's',
  });
  const draft = state.lyrics;
  state = reduceEditorSession(state, {
    type: 'change-division',
    id: 'D',
    kind: 'minor',
  });
  expect(state.lyrics).toBe(draft);
  state = reduceEditorSession(state, {
    type: 'history',
    direction: 'undo',
    focusedNoteId: null,
    focusedDivisionId: 'D',
  });
  expect(state.pendingHistory?.focusedDivisionId).toBe('D');
  expect(state.lyrics).toBe(draft);
  const blocked = reduceEditorSession(state, {
    type: 'arm',
    tool: { kind: 'place-division', divisionKind: 'minima' },
    lyricCommitId: 's',
  });
  expect(blocked).toBe(state);
  state = reduceEditorSession(state, {
    type: 'resolve-history',
    choice: 'cancel',
    newId: 's',
  });
  state = reduceEditorSession(state, {
    type: 'lyrics',
    action: { type: 'text', text: 'invalid text' },
    newId: 's',
  });
  const invalid = state.lyrics;
  state = reduceEditorSession(state, {
    type: 'arm',
    tool: { kind: 'place-division', divisionKind: 'minima' },
    lyricCommitId: 's',
  });
  expect(state.activeTool.kind).toBe('select');
  expect(state.lyrics).toEqual(invalid);
});

it('resolves repeated toolbar after-division intent from its stable ID after reanchoring', () => {
  let state = createEditorSession(divided());
  state = reduceEditorSession(state, {
    type: 'select',
    selection: { kind: 'division', divisionId: 'D' },
  });
  state = reduceEditorSession(state, {
    type: 'insert',
    ids,
    divisionSide: { divisionId: 'D', side: 'after' },
  });
  state = reduceEditorSession(state, {
    type: 'insert',
    ids: { neumeId: 'Y', noteIds: ['y0', 'y1', 'y2'] },
    divisionSide: { divisionId: 'D', side: 'after' },
  });
  expect(order(state.history.present)).toEqual(['n0', 'D', 'Y', 'X', 'n1']);
  expect(state.history.past).toHaveLength(2);
});

it('uses measured separation after a division for continuing syllables, without changing semantics', () => {
  const d = divided();
  d.syllables = [
    { id: 's0', text: 'a', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    {
      id: 's1',
      text: 'a'.repeat(20),
      startsAtNeumeId: 'n1',
      boundaryBefore: 'continuation',
    },
  ];
  const snapshot = JSON.stringify(d);
  const s = layoutChant(d, measure).systems[0];
  expect(s.hyphens).toHaveLength(1);
  expect(Number(s.lyrics[1].left)).toBeGreaterThan(
    s.divisions[0].bounds.x + s.divisions[0].bounds.width,
  );
  expect(JSON.stringify(d)).toBe(snapshot);
  // Without valid measurements there is no guessed or division-forced mark.
  expect(layoutChant(d).systems.flatMap((s) => s.hyphens)).toHaveLength(0);
});

it.each(['word', 'continuation'] as const)(
  'clears long preceding and following %s syllables and wraps their combined phrase units',
  (boundaryBefore) => {
    for (const [before, after] of [
      [18, 2],
      [2, 18],
      [25, 25],
      [45, 45],
      [150, 180],
    ]) {
      const d = divided(3);
      d.syllables = [
        {
          id: 's0',
          text: 'a'.repeat(before),
          startsAtNeumeId: 'n0',
          boundaryBefore: 'word',
        },
        {
          id: 's1',
          text: 'a'.repeat(after),
          startsAtNeumeId: 'n1',
          boundaryBefore,
        },
      ];
      const snapshot = JSON.stringify(d),
        l = layoutChant(d, measure);
      const source = l.systems.find((s) =>
        s.lyrics.some((l) => l.syllableId === 's0'),
      );
      const barSystem = l.systems.find((s) => s.divisions.length);
      expect(source).toBe(barSystem);
      for (const system of l.systems) {
        for (const bar of system.divisions) {
          const left = system.lyrics.find((l) => l.syllableId === 's0');
          const right = system.lyrics.find((l) => l.syllableId === 's1');
          if (left)
            expect(bar.bounds.x - Number(left.right)).toBeGreaterThanOrEqual(
              16,
            );
          if (right)
            expect(
              Number(right.left) - bar.bounds.x - bar.bounds.width,
            ).toBeGreaterThanOrEqual(16);
          expect(system.staffLines[0].x2).toBeGreaterThan(
            bar.bounds.x + bar.bounds.width,
          );
          expect(
            resolveScoreSlot(l, {
              x: bar.bounds.x - 1,
              y: system.staffLines[1].y,
            })?.slot.boundary,
          ).toEqual({
            beforeNeumeId: 'n1',
            beforeDivisionId: 'D',
            beforeClefId: null,
          });
          expect(
            resolveScoreSlot(l, {
              x: bar.bounds.x + bar.bounds.width + 1,
              y: system.staffLines[1].y,
            })?.slot.boundary,
          ).toEqual({
            beforeNeumeId: 'n1',
            beforeDivisionId: null,
            beforeClefId: null,
          });
          for (const slot of system.slots) {
            const intent = resolveGraphicalNeumePlacement(l, 'punctum', {
              x: slot.x,
              y: system.staffLines[1].y,
            });
            expect(intent?.boundary).toEqual(slot.boundary);
            expect(intent?.preview.caret.x).toBe(slot.x);
          }
        }
      }
      expect(l.systems.flatMap((s) => s.neumes).map((n) => n.neumeId)).toEqual([
        'n0',
        'n1',
        'n2',
      ]);
      expect(
        l.systems.every((s) => s.neumes.length + s.divisions.length > 0),
      ).toBe(true);
      expect(JSON.stringify(d)).toBe(snapshot);
      if (before === 150) {
        expect(l.systems[0].divisions[0].bounds.x).toBeGreaterThan(staffEndX);
        expect(l.x + l.width).toBeGreaterThan(l.systems[0].staffLines[0].x2);
        expect(l.systems[1].neumes[0].neumeId).toBe('n1');
        expect(l.systems[1].staffLines[0].x2).toBeGreaterThanOrEqual(staffEndX);
        for (const guide of l.systems[1].custodes)
          expect(l.systems[1].staffLines[0].x2).toBeGreaterThan(
            guide.bounds.x + guide.bounds.width,
          );
      }
    }
  },
);

it('clears a still-active syllable at a division within its melisma', () => {
  const d = fixture(4);
  d.divisions = [{ id: 'D', kind: 'maior', beforeNeumeId: 'n2' }];
  d.syllables = [
    {
      id: 's',
      text: 'a'.repeat(25),
      startsAtNeumeId: 'n0',
      boundaryBefore: 'word',
    },
  ];
  const s = layoutChant(d, measure).systems[0];
  expect(s.neumes.some((n) => n.neumeId === 'n1')).toBe(true);
  expect(
    s.divisions[0].bounds.x - Number(s.lyrics[0].right),
  ).toBeGreaterThanOrEqual(16);
  expect(s.hyphens).toHaveLength(0);
});
