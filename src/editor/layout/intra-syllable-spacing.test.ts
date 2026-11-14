import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ChantNote,
  type Neume,
  type NoteAppearance,
} from '../domain/chant-document';
import { findSyllableForNeume } from '../domain/lyrics';
import {
  hasValidAccidentals,
  resolveEffectivePitches,
} from '../domain/accidentals';
import { isValidNeume } from '../domain/neume';
import {
  layoutChant,
  firstSystemBottomStaffY,
  systemVerticalAdvance,
  staffEndX,
  type NeumeLayout,
} from './layout-chant';
import { buildNeumeGeometry, getInkBounds } from './neume-geometry';
import type { MeasureLyricText } from './lyric-text-metrics';

const measure: MeasureLyricText = (text) => ({
  width: text.length * 10,
  boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 10),
});
const note = (
  id: string,
  p: number,
  marks: NoteAppearance = {},
): ChantNote => ({
  id,
  staffPosition: staffPosition(p),
  ...marks,
});
const punctum = (id: string, p = 3, marks: NoteAppearance = {}): Neume => ({
  id,
  kind: 'punctum',
  notes: [note(`${id}-note`, p, marks)],
});
function fixture(count = 4, anchors = [0]): ChantDocument {
  return {
    title: 'Intra-syllable spacing',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 4 },
    divisions: [],
    clefChanges: [],
    accidentals: [],
    neumes: Array.from({ length: count }, (_, i) => punctum(`n${i}`)),
    syllables: anchors.map((at) => ({
      id: `s${count - at}`,
      text: 'a',
      boundaryBefore: 'word',
      startsAtNeumeId: `n${at}`,
    })),
  };
}
const gap = (a: NeumeLayout, b: NeumeLayout) =>
  b.bounds.x - a.bounds.x - a.bounds.width;

it('matches an independent interval oracle for all anchor subsets, including lyricless prefixes and document-end spans', () => {
  for (let mask = 0; mask < 64; mask++) {
    const anchors = Array.from({ length: 6 }, (_, i) => i).filter(
      (i) => mask & (1 << i),
    );
    const d = fixture(6, anchors);
    // Fill half-open intervals; do not use the production membership lookup
    // or spacing classifier to predict ownership/eligibility.
    const owners: (string | null)[] = Array.from({ length: 6 }, () => null);
    anchors.forEach((start, i) => {
      owners.fill(d.syllables[i].id, start, anchors[i + 1] ?? 6);
    });
    expect(
      d.neumes.map((n) => findSyllableForNeume(d, n.id)?.id ?? null),
    ).toEqual(owners);
    const snapshot = JSON.stringify(d);
    const s = layoutChant(d, measure).systems[0];
    for (let i = 1; i < 6; i++) {
      const expected =
        owners[i] !== null && owners[i] === owners[i - 1] ? 6 : 33;
      expect(
        gap(s.neumes[i - 1], s.neumes[i]),
        `mask ${mask}, boundary ${i}`,
      ).toBe(expected);
    }
    expect(JSON.stringify(d)).toBe(snapshot);
  }
});

describe('independent boundary eligibility', () => {
  it.each(['minima', 'minor', 'maior', 'finalis'] as const)(
    'blocks only the boundary containing a %s division, without splitting the syllable',
    (kind) => {
      const d = fixture();
      d.divisions = [{ id: 'bar', kind, beforeNeumeId: 'n2' }];
      const s = layoutChant(d, measure).systems[0];
      expect(gap(s.neumes[0], s.neumes[1])).toBe(6);
      expect(gap(s.neumes[1], s.neumes[2])).toBeGreaterThan(33);
      expect(gap(s.neumes[2], s.neumes[3])).toBe(6);
      expect(s.lyrics).toHaveLength(1);
      expect(s.hyphens).toEqual([]);
      expect(
        s.slots
          .filter((slot) => slot.boundary.beforeNeumeId === 'n2')
          .map((slot) => slot.boundary.beforeDivisionId),
      ).toEqual(['bar', null]);
    },
  );
  it.each(['c', 'f'] as const)(
    'blocks an explicit %s clef even within one span',
    (type) => {
      const d = fixture();
      d.clefChanges = [
        {
          id: 'clef',
          clef: { type, staffLine: 4 },
          beforeNeumeId: 'n2',
          beforeDivisionId: null,
        },
      ];
      const s = layoutChant(d, measure).systems[0];
      expect(gap(s.neumes[0], s.neumes[1])).toBe(6);
      expect(gap(s.neumes[1], s.neumes[2])).toBeGreaterThan(33);
      expect(gap(s.neumes[2], s.neumes[3])).toBe(6);
      expect(s.lyrics).toHaveLength(1);
      expect(s.hyphens).toEqual([]);
    },
  );
  it.each(['flat', 'natural'] as const)(
    'blocks both sides of a written %s prefix, but not carried alteration',
    (kind) => {
      const d = fixture(5);
      d.neumes = d.neumes.map((n) => punctum(n.id, 5));
      d.accidentals = [{ id: 'sign', kind, ownerNoteId: 'n1-note' }];
      expect(hasValidAccidentals(d)).toBe(true);
      const s = layoutChant(d, measure).systems[0];
      expect(gap(s.neumes[0], s.neumes[1])).toBeGreaterThanOrEqual(33);
      expect(gap(s.neumes[1], s.neumes[2])).toBe(33);
      expect(gap(s.neumes[2], s.neumes[3])).toBe(6);
      expect(gap(s.neumes[3], s.neumes[4])).toBe(6);
      expect(
        resolveEffectivePitches(d)?.get('n4-note')?.sourceAccidentalId,
      ).toBe('sign');
    },
  );
  it('uses the earlier written location, leaving the later B owner eligible when it has no ink', () => {
    const d = fixture(5);
    d.neumes[3] = punctum('n3', 5);
    d.neumes[4] = punctum('n4', 5);
    d.accidentals = [
      {
        id: 'flat',
        kind: 'flat',
        ownerNoteId: 'n3-note',
        placement: { kind: 'above-note', noteId: 'n1-note' },
      },
    ];
    expect(hasValidAccidentals(d)).toBe(true);
    const s = layoutChant(d, measure).systems[0];
    expect(s.neumes.map((n) => n.accidentals?.length ?? 0)).toEqual([
      0, 1, 0, 0, 0,
    ]);
    expect(gap(s.neumes[0], s.neumes[1])).toBeGreaterThanOrEqual(33);
    expect(gap(s.neumes[1], s.neumes[2])).toBe(33);
    expect(gap(s.neumes[2], s.neumes[3])).toBe(6);
    expect(gap(s.neumes[3], s.neumes[4])).toBe(6);
    expect(resolveEffectivePitches(d)?.get('n4-note')?.alteration).toBe(-1);
  });
});

it('measures complete signed/form ink and reuses independent midpoint hit clipping', () => {
  for (const form of [undefined, 'virga', 'inclinatum'] as const) {
    for (let mask = 0; mask < 8; mask++) {
      const d = fixture(3);
      const marks: NoteAppearance = {
        ...(form ? { form } : {}),
        ...(mask & 1 ? { mora: 1 } : {}),
        ...(mask & 2 ? { episema: true } : {}),
        ...(mask & 4 ? { verticalEpisema: true } : {}),
      };
      d.neumes = [
        punctum('n0', 2, marks),
        punctum('n1', 5, marks),
        punctum('n2', 3, marks),
      ];
      const s = layoutChant(d, measure).systems[0];
      for (let i = 0; i < 3; i++) {
        const n = s.neumes[i];
        expect(getInkBounds(n.ink)).toEqual(n.bounds);
        const original = buildNeumeGeometry(
          'punctum',
          d.neumes[i].notes.map((q) => q.staffPosition),
          n.bounds.x,
          firstSystemBottomStaffY,
          d.neumes[i].notes,
        );
        expect(n.ink).toEqual(original.ink);
        expect(n.lyricAnchorX).toBe(original.lyricAnchorX);
        if (i === 0) continue;
        const a = s.neumes[i - 1];
        expect(gap(a, n)).toBe(6);
        expect(a.hitClip?.right).toBe(n.hitClip?.left);
        expect(a.hitClip?.right).toBe(a.bounds.x + a.bounds.width + 3);
      }
    }
  }
});

it('includes ADR 0025 left-edge modifier normalization in both incoming and outgoing gaps', () => {
  const d = fixture(3);
  d.neumes[1] = {
    id: 'n1',
    kind: 'scandicus-flexus',
    notes: [
      note('q0', 0, { episema: true }),
      note('q1', 1, { episema: true, verticalEpisema: true }),
      note('q2', 2, { episema: true }),
      note('q3', 1, { episema: true }),
    ],
  };
  const s = layoutChant(d, measure).systems[0];
  const n = s.neumes[1];
  expect(n.bounds.x).toBeLessThan(n.notes[0].head.bounds.x);
  expect(getInkBounds(n.ink)).toEqual(n.bounds);
  expect(gap(s.neumes[0], n)).toBe(6);
  expect(gap(n, s.neumes[2])).toBe(6);
});

it('preserves ordinary music-only placement for missing, partial, invalid or missing-hyphen measurements', () => {
  const d = fixture(40, [2, 30]);
  d.syllables[1].text = 'la';
  for (const metrics of [
    undefined,
    (t: string) => (t === 'la' ? null : measure(t)),
    (t: string) => (t === '-' ? null : measure(t)),
    () => ({ width: NaN, boundaries: [0, NaN] }),
  ]) {
    const layout = layoutChant(d, metrics);
    expect(layout.systems.flatMap((s) => s.neumes)).toEqual(
      layoutChant(d).systems.flatMap((s) => s.neumes),
    );
    expect(layout.systems.flatMap((s) => s.hyphens)).toEqual([]);
  }
  const lyricless = fixture(40, []);
  expect(layoutChant(lyricless, measure)).toEqual(layoutChant(lyricless));
});

it('wraps a long melisma as whole neumes with custodes and one unchanged lyric anchor, without internal marks', () => {
  const d = fixture(100);
  const layout = layoutChant(d, measure);
  expect(layout.systems.length).toBeGreaterThan(3);
  expect(layout.systems.flatMap((s) => s.neumes.map((n) => n.neumeId))).toEqual(
    d.neumes.map((n) => n.id),
  );
  expect(layout.systems.flatMap((s) => s.lyrics)).toHaveLength(1);
  expect(layout.systems.flatMap((s) => s.hyphens)).toEqual([]);
  const first = layout.systems[0];
  expect(first.lyrics[0].anchorX).toBe(first.neumes[0].notes[0].anchorX);
  expect(first.lyrics[0].text).toBe('a');
  for (const [i, system] of layout.systems.entries()) {
    expect(system.neumes[0].bounds.x).toBe(first.neumes[0].bounds.x);
    if (i < layout.systems.length - 1) expect(system.custodes).toHaveLength(1);
    expect(system.neumes.at(-1)?.bounds.x).toBeLessThan(staffEndX);
    for (let j = 1; j < system.neumes.length; j++)
      expect(gap(system.neumes[j - 1], system.neumes[j])).toBe(6);
  }
});

it('keeps the transition to a distinct continuing syllable ordinary, then resumes existing anchor-to-anchor compaction', () => {
  const d = fixture(4, [0, 2, 3]);
  d.syllables = d.syllables.map((s, i) => ({
    ...s,
    boundaryBefore: i ? 'continuation' : 'word',
  }));
  const s = layoutChant(d, measure).systems[0];
  expect(gap(s.neumes[0], s.neumes[1])).toBe(6);
  expect(gap(s.neumes[1], s.neumes[2])).toBe(33);
  const adjacent = fixture(2, [0, 1]);
  adjacent.syllables[1].boundaryBefore = 'continuation';
  const pair = layoutChant(adjacent, measure).systems[0].neumes;
  expect(gap(s.neumes[2], s.neumes[3])).toBe(gap(pair[0], pair[1]));
  expect(gap(pair[0], pair[1])).toBeLessThan(33);
  expect(s.hyphens).toHaveLength(2);
  expect(s.hyphens.every((h) => !h.outgoing)).toBe(true);
  expect(s.lyrics.map((l) => l.anchorX)).toEqual([
    s.neumes[0].lyricAnchorX,
    s.neumes[2].lyricAnchorX,
    s.neumes[3].lyricAnchorX,
  ]);
  // A real next syllable on a later system keeps the existing outgoing mark
  // on the source lyric's system, without marks on intermediate melisma lines.
  const long = fixture(101, [0, 100]);
  long.syllables[1].boundaryBefore = 'continuation';
  const layout = layoutChant(long, measure);
  expect(layout.systems[0].hyphens).toHaveLength(1);
  expect(layout.systems[0].hyphens[0].outgoing).toBe(true);
  expect(layout.systems.slice(1).flatMap((system) => system.hyphens)).toEqual(
    [],
  );
});

it.each(['Christe', 'last Kyrie'] as const)(
  'renders supported %s fragments without changing internal contours, note IDs or kind-specific lyric anchors',
  (fragment) => {
    const d = fixture(0);
    const pes = (
      id: string,
      p: [number, number, number, number, number],
    ): Neume => ({
      id,
      kind: 'pes-subpunctis',
      notes: [
        note(`${id}0`, p[0]),
        note(`${id}1`, p[1]),
        note(`${id}2`, p[2]),
        note(`${id}3`, p[3], { verticalEpisema: true }),
        note(`${id}4`, p[4]),
      ],
    });
    d.neumes =
      fragment === 'Christe'
        ? [
            { id: 'chri', kind: 'clivis', notes: [note('h', 4), note('g', 3)] },
            punctum('start', 7, { form: 'virga', mora: 1 }),
            pes('pes', [6, 7, 6, 4, 3]),
            punctum('end', 4, { mora: 1 }),
          ]
        : [
            {
              id: 'ky',
              kind: 'torculus',
              notes: [note('d0', 0), note('f', 2), note('d1', 0)],
            },
            {
              id: 'ri',
              kind: 'podatus',
              notes: [note('c', -1), note('d2', 0)],
            },
            punctum('start', 0, { mora: 1 }),
            punctum('virga', 3, { form: 'virga', mora: 1 }),
            pes('pes', [2, 3, 2, 0, -1]),
            punctum('end', 0, { mora: 1 }),
          ];
    d.syllables =
      fragment === 'Christe'
        ? [
            {
              id: 'chri-text',
              text: 'Chri',
              startsAtNeumeId: 'chri',
              boundaryBefore: 'word',
            },
            {
              id: 'ste',
              text: 'ste',
              startsAtNeumeId: 'start',
              boundaryBefore: 'continuation',
            },
          ]
        : [
            {
              id: 'ky-text',
              text: 'Ký',
              startsAtNeumeId: 'ky',
              boundaryBefore: 'word',
            },
            {
              id: 'ri-text',
              text: 'ri',
              startsAtNeumeId: 'ri',
              boundaryBefore: 'continuation',
            },
            {
              id: 'e',
              text: 'e',
              startsAtNeumeId: 'start',
              boundaryBefore: 'continuation',
            },
          ];
    expect(d.neumes.every(isValidNeume)).toBe(true);
    const snapshot = JSON.stringify(d);
    const layout = layoutChant(d, measure);
    const neumes = layout.systems.flatMap((s) => s.neumes);
    const at = neumes.findIndex((n) => n.neumeId === 'start');
    for (let i = at + 1; i < neumes.length; i++)
      expect(gap(neumes[i - 1], neumes[i])).toBe(6);
    for (const system of layout.systems)
      for (const n of system.neumes) {
        const semantic = d.neumes.find((v) => v.id === n.neumeId);
        if (!semantic) throw Error('Missing semantic neume');
        const original = buildNeumeGeometry(
          semantic.kind,
          semantic.notes.map((q) => q.staffPosition),
          n.bounds.x,
          firstSystemBottomStaffY + system.index * systemVerticalAdvance,
          semantic.notes,
        );
        expect(n.ink).toEqual(original.ink);
        expect(n.lyricAnchorX).toBe(original.lyricAnchorX);
        expect(n.notes.map((q) => q.noteId)).toEqual(
          semantic.notes.map((q) => q.id),
        );
      }
    const lyric = layout.systems.flatMap((s) => s.lyrics).at(-1);
    expect(lyric?.anchorX).toBe(neumes[at].notes[0].anchorX);
    expect(JSON.stringify(d)).toBe(snapshot);
  },
);

it('keeps all fourteen existing kinds independent with unchanged geometry and lyric anchors', () => {
  const d = fixture(0);
  let nextId = 0;
  const q = (p: number) => note(`q${nextId++}`, p);
  d.neumes = [
    { id: 'punctum', kind: 'punctum', notes: [q(3)] },
    { id: 'bistropha', kind: 'bistropha', notes: [q(3), q(3)] },
    { id: 'tristropha', kind: 'tristropha', notes: [q(3), q(3), q(3)] },
    { id: 'podatus', kind: 'podatus', notes: [q(2), q(3)] },
    { id: 'clivis', kind: 'clivis', notes: [q(3), q(2)] },
    { id: 'scandicus', kind: 'scandicus', notes: [q(1), q(2), q(3)] },
    { id: 'torculus', kind: 'torculus', notes: [q(2), q(4), q(3)] },
    { id: 'climacus', kind: 'climacus', notes: [q(4), q(3), q(2)] },
    { id: 'porrectus', kind: 'porrectus', notes: [q(4), q(2), q(3)] },
    {
      id: 'pes-subpunctis',
      kind: 'pes-subpunctis',
      notes: [q(2), q(4), q(3), q(2)],
    },
    {
      id: 'torculus-resupinus',
      kind: 'torculus-resupinus',
      notes: [q(2), q(4), q(1), q(3)],
    },
    {
      id: 'porrectus-flexus',
      kind: 'porrectus-flexus',
      notes: [q(4), q(2), q(3), q(1)],
    },
    {
      id: 'scandicus-flexus',
      kind: 'scandicus-flexus',
      notes: [q(1), q(2), q(4), q(3)],
    },
    {
      id: 'climacus-resupinus',
      kind: 'climacus-resupinus',
      notes: [q(4), q(3), q(1), q(2)],
    },
  ];
  expect(d.neumes.every(isValidNeume)).toBe(true);
  for (const [anchor, neume] of d.neumes.entries()) {
    // Rotate the start to exercise each kind as the lyric-bearing first neume.
    const rotated = [...d.neumes.slice(anchor), ...d.neumes.slice(0, anchor)];
    const layout = layoutChant(
      {
        ...d,
        neumes: rotated,
        syllables: [
          {
            id: 's',
            text: 'a',
            startsAtNeumeId: neume.id,
            boundaryBefore: 'word',
          },
        ],
      },
      measure,
    );
    expect(layout.systems[0].lyrics[0].anchorX).toBe(
      layout.systems[0].neumes[0].lyricAnchorX,
    );
    expect(
      layout.systems.flatMap((s) => s.neumes.map((n) => n.neumeId)),
    ).toEqual(rotated.map((n) => n.id));
    for (const s of layout.systems)
      for (const [i, n] of s.neumes.entries()) {
        const semantic = rotated.find((v) => v.id === n.neumeId);
        if (!semantic) throw Error('Missing neume');
        const original = buildNeumeGeometry(
          semantic.kind,
          semantic.notes.map((v) => v.staffPosition),
          n.bounds.x,
          firstSystemBottomStaffY + s.index * systemVerticalAdvance,
        );
        expect(n.ink).toEqual(original.ink);
        expect(n.lyricAnchorX).toBe(original.lyricAnchorX);
        expect(n.notes.map((v) => v.noteId)).toEqual(
          semantic.notes.map((v) => v.id),
        );
        if (i) expect(gap(s.neumes[i - 1], n)).toBe(6);
      }
  }
});

it('keeps the Kyrie XI nine-note eleison in existing kinds and places its flat at the earlier written location', () => {
  const d = fixture(0);
  // GABC ix fgh ! ivHG fvED, C4: a=-3; flat B is i=5.
  d.neumes = [
    {
      id: 'rising',
      kind: 'scandicus',
      notes: [note('f', 2), note('g', 3), note('h', 4)],
    },
    {
      id: 'upper-tail',
      kind: 'climacus',
      notes: [note('i', 5), note('h2', 4), note('g2', 3)],
    },
    {
      id: 'lower-tail',
      kind: 'climacus',
      notes: [note('f2', 2), note('e', 1), note('d', 0)],
    },
  ];
  d.syllables = [
    {
      id: 'e-text',
      text: 'e',
      startsAtNeumeId: 'rising',
      boundaryBefore: 'word',
    },
  ];
  d.accidentals = [
    {
      id: 'flat',
      kind: 'flat',
      ownerNoteId: 'i',
      placement: { kind: 'above-note', noteId: 'f' },
    },
  ];
  expect(d.neumes.every(isValidNeume)).toBe(true);
  expect(hasValidAccidentals(d)).toBe(true);
  const s = layoutChant(d, measure).systems[0];
  expect(s.neumes[0].accidentals?.[0].owner.noteId).toBe('i');
  expect(s.neumes[0].accidentals?.[0].placement?.noteId).toBe('f');
  expect(gap(s.neumes[0], s.neumes[1])).toBe(33);
  expect(gap(s.neumes[1], s.neumes[2])).toBe(6);
  expect(s.lyrics[0].anchorX).toBe(s.neumes[0].notes[0].anchorX);
  expect(s.hyphens).toEqual([]);
});
