import { expect, it } from 'vitest';
import type { MeasureLyricText } from './lyric-text-metrics';
import {
  staffPosition,
  type Neume,
  type ChantNote,
} from '../domain/chant-document';
import { buildNeumeGeometry } from './neume-geometry';
import { accidentalPrefixAdvance } from './accidental-geometry';
import { blankDocument } from '../persistence/native-document';
import { layoutChant } from './layout-chant';
import {
  placeAccidental,
  updateAccidental,
} from '../commands/update-accidental';

const measure: MeasureLyricText = (text) => ({
  width: text.length * 20,
  boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 20),
});
it('reserves measured clearance for a low natural beside its own lyric without moving staff coordinates', () => {
  const d = blankDocument();
  d.clef = { type: 'c', staffLine: 4 };
  d.lyricLanguage = 'und';
  d.neumes = [
    {
      id: 'b',
      kind: 'punctum',
      notes: [{ id: 'note', staffPosition: staffPosition(-2) }],
    },
  ];
  d.syllables = [
    {
      id: 'text',
      text: 'Sanctus',
      startsAtNeumeId: 'b',
      boundaryBefore: 'word',
    },
  ];
  const signed = updateAccidental(d, 'note', 'natural', 'natural'),
    system = layoutChant(signed, measure).systems[0];
  const glyph = system.neumes[0].accidentals?.[0],
    lyric = system.lyrics[0];
  if (!glyph || lyric.left === null) throw Error('Expected measured geometry');
  expect(glyph.ink.bounds.x + glyph.ink.bounds.width + 4).toBeLessThanOrEqual(
    lyric.left,
  );
  expect(lyric.anchorX).toBe(system.neumes[0].lyricAnchorX);
  expect(system.neumes[0].notes[0].anchorY).toBe(148);
});
it.each(['Sanctus', 'Benedictus', 'Sanctissimus'])(
  'keeps a later low sign clear of the preceding %s lyric or wraps the complete group',
  (text) => {
    const d = blankDocument();
    d.clef = { type: 'c', staffLine: 4 };
    d.lyricLanguage = 'und';
    d.neumes = [
      {
        id: 'a',
        kind: 'punctum',
        notes: [{ id: 'a-note', staffPosition: staffPosition(4) }],
      },
      {
        id: 'b',
        kind: 'punctum',
        notes: [{ id: 'b-note', staffPosition: staffPosition(-2) }],
      },
    ];
    d.syllables = [
      { id: 'text', text, startsAtNeumeId: 'a', boundaryBefore: 'word' },
    ];
    const signed = updateAccidental(d, 'b-note', 'natural', 'sign'),
      layout = layoutChant(signed, measure);
    const system = layout.systems.find((s) =>
      s.neumes.some((n) => n.neumeId === 'b'),
    );
    const glyph = system?.neumes.find((n) => n.neumeId === 'b')
      ?.accidentals?.[0];
    if (!system || !glyph) throw Error('Expected glyph');
    if (system.index === 0) {
      const right = system.lyrics[0].right;
      if (right === null) throw Error('Expected lyric metrics');
      expect(glyph.ink.bounds.x).toBeGreaterThanOrEqual(right + 4);
    }
    expect(layout.systems.flatMap((s) => s.neumes)).toHaveLength(2);
  },
);

const cases: [Neume['kind'], number[]][] = [
  ['punctum', [5]],
  ['podatus', [4, 5]],
  ['clivis', [6, 5]],
  ['scandicus', [3, 4, 5]],
  ['torculus', [5, 6, 5]],
  ['climacus', [6, 5, 4]],
  ['porrectus', [5, 4, 5]],
];
for (const [kind, positions] of cases)
  for (const transpose of [-7, 0, 7])
    for (const accidentalKind of ['flat', 'natural'] as const) {
      it(`${kind} ${accidentalKind} prefix at displacement ${transpose} has measured bounds, unaltered note ink and anchor`, () => {
        const notes = positions.map((p) => staffPosition(p + transpose));
        const signed = buildNeumeGeometry(
          kind,
          notes,
          100,
          120,
          [],
          [
            {
              kind: accidentalKind,
              staffPosition: 5 + transpose,
              noteIndex: null,
            },
          ],
        );
        const plain = buildNeumeGeometry(
          kind,
          notes,
          100 + accidentalPrefixAdvance,
          120,
        );
        expect(signed.notes).toEqual(plain.notes);
        expect(signed.lyricAnchorX).toBe(plain.lyricAnchorX);
        expect(signed.bounds.x).toBe(100);
        expect(signed.advanceX).toBe(signed.bounds.width + 33);
        for (const shape of signed.ink) {
          const b = shape.bounds;
          expect(b.x).toBeGreaterThanOrEqual(signed.bounds.x);
          expect(b.y).toBeGreaterThanOrEqual(signed.bounds.y);
          expect(b.x + b.width).toBeLessThanOrEqual(
            signed.bounds.x + signed.bounds.width,
          );
          expect(b.y + b.height).toBeLessThanOrEqual(
            signed.bounds.y + signed.bounds.height,
          );
        }
        expect(signed.accidentals).toHaveLength(1);
        const a = signed.accidentals?.[0];
        expect(a?.hitBounds.width).toBeGreaterThan(a?.ink.bounds.width ?? 0);
      });
    }

it('keeps two-register prefix order independent of collection order', () => {
  const d = blankDocument();
  d.clef = { type: 'c', staffLine: 4 };
  d.neumes = [
    {
      id: 'wide',
      kind: 'podatus',
      notes: [
        { id: 'lo', staffPosition: staffPosition(-2) },
        { id: 'hi', staffPosition: staffPosition(5) },
      ],
    },
  ];
  const signed = updateAccidental(
    updateAccidental(d, 'hi', 'natural', 'hi-sign'),
    'lo',
    'flat',
    'lo-sign',
  );
  const layout = layoutChant(signed),
    n = layout.systems[0].neumes[0];
  expect(n.accidentals?.map((a) => a.accidentalId)).toEqual([
    'lo-sign',
    'hi-sign',
  ]);
  expect(n.accidentals?.map((a) => a.ink.bounds.x)).toEqual([
    n.bounds.x,
    n.bounds.x + 20,
  ]);
  expect(
    layoutChant({ ...signed, accidentals: [...signed.accidentals].reverse() }),
  ).toEqual(layout);
});

it('places the Beata gens flat over F under its written clef, without changing F/G/A', () => {
  const d = blankDocument();
  d.clef = { type: 'c', staffLine: 4 };
  d.neumes = [
    {
      id: 'f',
      kind: 'punctum',
      notes: [
        { id: 'f-note', staffPosition: staffPosition(2), form: 'inclinatum' },
      ],
    },
    {
      id: 'ga',
      kind: 'podatus',
      notes: [
        { id: 'g', staffPosition: staffPosition(3), form: 'quilisma' },
        { id: 'a', staffPosition: staffPosition(4) },
      ],
    },
    {
      id: 'b',
      kind: 'punctum',
      notes: [{ id: 'b-note', staffPosition: staffPosition(5) }],
    },
  ];
  const signed = placeAccidental(
    updateAccidental(d, 'b-note', 'flat', 'sign'),
    'sign',
    'f-note',
  );
  const baseline = layoutChant(d),
    layout = layoutChant(signed),
    anchor = layout.systems[0].neumes[0];
  expect(signed.neumes).toBe(d.neumes);
  expect(anchor.notes[0].anchorY).toBe(
    baseline.systems[0].neumes[0].notes[0].anchorY,
  );
  const sign = anchor.accidentals?.[0];
  if (!sign) throw Error('Missing sign');
  expect(sign.ink.bounds.y + 18).toBe(anchor.notes[0].anchorY - 36);
  expect(sign.ink.bounds.x + 5).toBe(anchor.notes[0].anchorX);
  // A clef between writing and owner changes only the derived written height.
  const transposedOwner = {
    ...signed,
    clefChanges: [
      {
        id: 'clef',
        clef: { type: 'c' as const, staffLine: 3 as const },
        beforeNeumeId: 'b',
        beforeDivisionId: null,
      },
    ],
    neumes: signed.neumes.map((n) =>
      n.id === 'b'
        ? ({
            ...n,
            notes: [{ id: 'b-note', staffPosition: staffPosition(3) }],
          } as Neume)
        : n,
    ),
  };
  expect(layoutChant(transposedOwner).systems[0].neumes[0].accidentals).toEqual(
    anchor.accidentals,
  );
});

it('bounds signed oversized groups and retains every group once after wrapping', () => {
  const d = blankDocument();
  d.clef = { type: 'c', staffLine: 4 };
  d.neumes = Array.from({ length: 25 }, (_, i) => ({
    id: 'n' + i,
    kind: 'porrectus',
    notes: [
      { id: 'a' + i, staffPosition: staffPosition(5) },
      { id: 'b' + i, staffPosition: staffPosition(-30) },
      { id: 'c' + i, staffPosition: staffPosition(5) },
    ],
  }));
  let signed = d;
  for (const n of d.neumes)
    signed = updateAccidental(signed, n.notes[0].id, 'flat', 'sign' + n.id);
  const layout = layoutChant(signed);
  expect(layout.systems.length).toBeLessThanOrEqual(d.neumes.length);
  expect(layout.systems.flatMap((s) => s.neumes).map((n) => n.neumeId)).toEqual(
    d.neumes.map((n) => n.id),
  );
  expect(
    layout.systems
      .flatMap((s) => s.neumes)
      .flatMap((n) => n.accidentals?.map((a) => a.accidentalId) ?? []),
  ).toHaveLength(25);
});

it.each(['flat', 'natural'] as const)(
  'expands SVG/print canvas for a high %s with default and explicit placement',
  (kind) => {
    for (const explicit of [false, true]) {
      const d = blankDocument();
      d.clef = { type: 'f', staffLine: 4 };
      d.neumes = [
        {
          id: 'anchor',
          kind: 'punctum',
          notes: [{ id: 'a', staffPosition: staffPosition(8) }],
        },
        {
          id: 'owner',
          kind: 'punctum',
          notes: [{ id: 'b', staffPosition: staffPosition(9) }],
        },
      ];
      let signed = updateAccidental(d, 'b', kind, 'sign');
      if (explicit) signed = placeAccidental(signed, 'sign', 'a');
      const layout = layoutChant(signed);
      const groups = layout.systems.flatMap((s) => s.neumes);
      const sign = groups.flatMap((g) => g.accidentals ?? [])[0];
      expect(layout.y).toBeLessThan(0);
      expect(sign.ink.bounds.y).toBeGreaterThanOrEqual(layout.y);
      expect(sign.ink.bounds.y + sign.ink.bounds.height).toBeLessThanOrEqual(
        layout.y + layout.height,
      );
      const group = groups.find((g) => g.accidentals?.length);
      expect(group?.ink).toContainEqual(sign.ink);
      expect(group?.bodyInk).not.toContainEqual(sign.ink);
      expect(sign.accidentalId).toBe('sign');
      expect(sign.owner.noteId).toBe('b');
      expect(sign.placement?.noteId ?? null).toBe(explicit ? 'a' : null);
    }
  },
);

it.each([0, 5, 12])(
  'clears a later centered lyric against earlier low accidental ink with %s fillers',
  (fillers) => {
    const d = blankDocument();
    d.clef = { type: 'c', staffLine: 4 };
    d.lyricLanguage = 'und';
    d.neumes = [
      ...Array.from({ length: fillers }, (_, i) => ({
        id: `fill${i}`,
        kind: 'punctum' as const,
        notes: [{ id: `f${i}`, staffPosition: staffPosition(4) }] as [
          ChantNote,
        ],
      })),
      {
        id: 'low',
        kind: 'punctum',
        notes: [{ id: 'b', staffPosition: staffPosition(-2) }],
      },
      {
        id: 'text',
        kind: 'punctum',
        notes: [{ id: 't', staffPosition: staffPosition(4) }],
      },
    ];
    d.syllables = [
      {
        id: 'lyric',
        text: 'Benedictus',
        startsAtNeumeId: 'text',
        boundaryBefore: 'word',
      },
    ];
    const layout = layoutChant(
      updateAccidental(d, 'b', 'natural', 'sign'),
      measure,
    );
    const system = layout.systems.find((s) => s.lyrics.length);
    if (!system) throw Error('Expected lyric');
    const lyric = system.lyrics[0];
    for (const glyph of system.neumes.flatMap((n) => n.accidentals ?? [])) {
      expect(lyric.left).toBeGreaterThanOrEqual(
        glyph.ink.bounds.x + glyph.ink.bounds.width + 4,
      );
    }
    expect(lyric.anchorX).toBe(
      system.neumes.find((n) => n.neumeId === 'text')?.lyricAnchorX,
    );
    expect(layout.systems.flatMap((s) => s.neumes)).toHaveLength(fillers + 2);
  },
);

it('keeps continuation hyphen ink clear of an intervening low natural', () => {
  const d = blankDocument();
  d.clef = { type: 'c', staffLine: 4 };
  d.lyricLanguage = 'und';
  d.neumes = [4, -2, 4].map((p, i) => ({
    id: `g${i}`,
    kind: 'punctum',
    notes: [{ id: `n${i}`, staffPosition: staffPosition(p) }],
  }));
  d.syllables = [
    { id: 'first', text: 'A', startsAtNeumeId: 'g0', boundaryBefore: 'word' },
    {
      id: 'last',
      text: 'Benedictus',
      startsAtNeumeId: 'g2',
      boundaryBefore: 'continuation',
    },
  ];
  const layout = layoutChant(
    updateAccidental(d, 'n1', 'natural', 'sign'),
    measure,
  );
  for (const s of layout.systems)
    for (const glyph of s.neumes.flatMap((n) => n.accidentals ?? [])) {
      for (const hyphen of s.hyphens)
        expect(hyphen.x).toBeGreaterThanOrEqual(
          glyph.ink.bounds.x + glyph.ink.bounds.width,
        );
    }
  expect(layout.systems.flatMap((s) => s.hyphens)).toHaveLength(1);
});
