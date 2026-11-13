import { expect, it } from 'vitest';
import {
  alignLyricText,
  lyricFontSize,
  lyricTextExtents,
  type MeasureLyricText,
} from './lyric-text-metrics';
import {
  staffPosition,
  type Neume,
  type ChantNote,
} from '../domain/chant-document';
import { buildNeumeGeometry } from './neume-geometry';
import { accidentalPrefixAdvance } from './accidental-geometry';
import { blankDocument } from '../persistence/native-document';
import { layoutChant, lyricJoinThreshold } from './layout-chant';
import {
  placeAccidental,
  updateAccidental,
} from '../commands/update-accidental';

const measure: MeasureLyricText = (text) => ({
  width: text.length * 20,
  boundaries: Array.from({ length: text.length + 1 }, (_, i) => i * 20),
});
const hyphenExtents = lyricTextExtents(
  alignLyricText(
    { id: 'h', text: '-', startsAtNeumeId: '', boundaryBefore: 'word' },
    'und',
    measure,
  ),
);
/** The rendered hyphen's measured ink interval around its anchor. */
function hyphenInk(hyphen: { x: number }): [number, number] {
  if (!hyphenExtents) throw Error('Expected measured hyphen');
  return [hyphen.x + hyphenExtents.left, hyphen.x + hyphenExtents.right];
}
const hyphenClearance = lyricFontSize / 10;
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

it.each([
  [0, 1],
  [5, 1],
  [12, 2],
])(
  'clears a later centered lyric against earlier low accidental ink with %s fillers on %s systems',
  (fillers, systems) => {
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
    expect(layout.systems).toHaveLength(systems);
    const system = layout.systems.find((s) => s.lyrics.length);
    if (!system) throw Error('Expected lyric');
    // The signed group and its later lyric share the checked (final) system.
    expect(system).toBe(layout.systems.at(-1));
    expect(system.neumes.map((n) => n.neumeId)).toEqual(
      expect.arrayContaining(['low', 'text']),
    );
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
  expect(layout.systems).toHaveLength(1);
  const [system] = layout.systems;
  const [before, after] = system.lyrics;
  const glyph = system.neumes[1].accidentals?.[0]?.ink.bounds;
  if (!glyph || before.right === null || after.left === null)
    throw Error('Expected measured lyrics and sign');
  // The natural genuinely intervenes between the two syllables.
  expect(glyph.x + glyph.width).toBeGreaterThan(before.right);
  expect(glyph.x).toBeLessThan(after.left);
  expect(system.hyphens).toHaveLength(1);
  const [left, right] = hyphenInk(system.hyphens[0]);
  expect(right - left).toBe(20);
  expect(left).toBeGreaterThanOrEqual(before.right + hyphenClearance);
  expect(
    right <= glyph.x - hyphenClearance ||
      left >= glyph.x + glyph.width + hyphenClearance,
    JSON.stringify({ hyphen: [left, right], glyph }),
  ).toBe(true);
  expect(right).toBeLessThanOrEqual(after.left - hyphenClearance);
});

it.each([
  ['A', 'men'],
  ['Al', 'le'],
])(
  'keeps the compact %s-%s join when an earlier low flat cannot obstruct a hyphen',
  (first, second) => {
    const d = blankDocument();
    d.clef = { type: 'c', staffLine: 3 };
    d.lyricLanguage = 'und';
    d.neumes = [-4, 4].map((p, i) => ({
      id: `g${i}`,
      kind: 'punctum',
      notes: [{ id: `n${i}`, staffPosition: staffPosition(p) }],
    }));
    d.syllables = [
      { id: 'a', text: first, startsAtNeumeId: 'g0', boundaryBefore: 'word' },
      {
        id: 'b',
        text: second,
        startsAtNeumeId: 'g1',
        boundaryBefore: 'continuation',
      },
    ];
    const signed = updateAccidental(d, 'n0', 'flat', 'flat');
    const unsigned = layoutChant(d, measure).systems[0];
    const layout = layoutChant(signed, measure);
    const system = layout.systems[0];
    expect(layout.systems).toHaveLength(1);
    const [before, after] = system.lyrics;
    const sign = system.neumes[0].accidentals?.[0]?.ink.bounds;
    if (!sign || before.right === null || after.left === null)
      throw Error('Expected measured lyrics and sign');
    // The default flat sits wholly before its own lyric, so no hyphen interval
    // between the syllables can intersect it.
    expect(sign.x + sign.width + 4).toBeLessThanOrEqual(before.left ?? 0);
    expect(system.hyphens).toEqual([]);
    expect(unsigned.hyphens).toEqual([]);
    expect(after.left - before.right).toBe(
      (unsigned.lyrics[1].left ?? 0) - (unsigned.lyrics[0].right ?? 0),
    );
    expect(after.left - before.right).toBeLessThanOrEqual(lyricJoinThreshold);
    for (const lyric of system.lyrics)
      expect(lyric.anchorX).toBe(
        system.neumes.find(
          (n) =>
            n.neumeId ===
            signed.syllables.find((s) => s.id === lyric.syllableId)
              ?.startsAtNeumeId,
        )?.lyricAnchorX,
      );
  },
);

it.each(['earlier-anchor', 'default-prefix'] as const)(
  'reserves an unobstructed continuation hyphen before the current %s group',
  (placement) => {
    const d = blankDocument();
    d.clef = { type: 'c', staffLine: 3 };
    d.lyricLanguage = 'und';
    d.neumes = [4, 4, -4].map((p, i) => ({
      id: `g${i}`,
      kind: 'punctum',
      notes: [{ id: `n${i}`, staffPosition: staffPosition(p) }],
    }));
    d.syllables = [
      { id: 'a', text: 'A', startsAtNeumeId: 'g0', boundaryBefore: 'word' },
      {
        id: 'men',
        text: 'men',
        startsAtNeumeId: placement === 'earlier-anchor' ? 'g1' : 'g2',
        boundaryBefore: 'continuation',
      },
    ];
    let signed = updateAccidental(d, 'n2', 'natural', 'natural');
    if (placement === 'earlier-anchor')
      signed = placeAccidental(signed, 'natural', 'n1');
    const layout = layoutChant(signed, measure);
    const system = layout.systems[0];
    expect(layout.systems).toHaveLength(1);
    expect(system.hyphens).toHaveLength(1);
    const sign = system.neumes.flatMap((n) => n.accidentals ?? [])[0].ink
      .bounds;
    const hyphen = system.hyphens[0];
    const before = system.lyrics[0],
      after = system.lyrics[1];
    const metrics = {
      before: [before.left, before.right],
      natural: [sign.x, sign.x + sign.width],
      after: [after.left, after.right],
      hyphen: hyphenInk(hyphen),
    };
    expect(metrics).toEqual(
      placement === 'earlier-anchor'
        ? {
            before: [140, 160],
            natural: [184, 192],
            after: [196, 256],
            hyphen: [162, 182],
          }
        : {
            before: [140, 160],
            natural: [234, 242],
            after: [246, 306],
            hyphen: [187, 207],
          },
    );
    const [hyphenLeft, hyphenRight] = hyphenInk(hyphen);
    expect(hyphenLeft, JSON.stringify(metrics)).toBeGreaterThanOrEqual(
      (before.right ?? 0) + hyphenClearance,
    );
    expect(hyphenRight, JSON.stringify(metrics)).toBeLessThanOrEqual(
      sign.x - hyphenClearance,
    );
    expect(hyphenRight).toBeLessThanOrEqual(
      (after.left ?? 0) - hyphenClearance,
    );
    expect(after.anchorX).toBe(
      system.neumes.find(
        (n) => n.neumeId === (placement === 'earlier-anchor' ? 'g1' : 'g2'),
      )?.lyricAnchorX,
    );
    expect(signed.accidentals[0].ownerNoteId).toBe('n2');
    expect(system.neumes.map((n) => n.notes[0].anchorY)).toEqual([76, 76, 172]);
  },
);

it.each([
  [0, 'one system', [0, 0, 0, 0]],
  [8, 'a continuation split across systems', [0, 0, 1, 1]],
  [10, 'the whole sequence wrapped', [1, 1, 1, 1]],
  [12, 'the whole sequence wrapped', [1, 1, 1, 1]],
] as const)(
  'keeps hyphens clear of both preceding and current low signs with %s fillers (%s)',
  (fillers, _case, groupSystems) => {
    const d = blankDocument();
    d.clef = { type: 'c', staffLine: 3 };
    d.lyricLanguage = 'und';
    d.neumes = [
      ...Array.from({ length: fillers }, (_, i) => ({
        id: `fill${i}`,
        kind: 'punctum' as const,
        notes: [{ id: `f${i}`, staffPosition: staffPosition(4) }] as [
          ChantNote,
        ],
      })),
      ...[4, -4, 4, -4].map((p, i) => ({
        id: `g${i}`,
        kind: 'punctum' as const,
        notes: [{ id: `n${i}`, staffPosition: staffPosition(p) }] as [
          ChantNote,
        ],
      })),
    ];
    d.syllables = [
      { id: 'a', text: 'A', startsAtNeumeId: 'g0', boundaryBefore: 'word' },
      {
        id: 'men',
        text: 'men',
        startsAtNeumeId: 'g2',
        boundaryBefore: 'continuation',
      },
    ];
    let signed = updateAccidental(
      updateAccidental(d, 'n1', 'natural', 'prior'),
      'n3',
      'natural',
      'current',
    );
    signed = placeAccidental(signed, 'current', 'n2');
    const layout = layoutChant(signed, measure);
    expect(layout.systems.flatMap((s) => s.neumes)).toHaveLength(fillers + 4);
    expect(
      ['g0', 'g1', 'g2', 'g3'].map((id) =>
        layout.systems.findIndex((s) => s.neumes.some((n) => n.neumeId === id)),
      ),
    ).toEqual(groupSystems);
    const hyphens = layout.systems.flatMap((s) => s.hyphens);
    expect(hyphens).toHaveLength(1);
    expect(hyphens[0].outgoing).toBe(groupSystems[1] !== groupSystems[2]);
    for (const system of layout.systems) {
      for (const h of system.hyphens) {
        for (const a of system.neumes.flatMap((n) => n.accidentals ?? [])) {
          const b = a.ink.bounds;
          const [left, right] = hyphenInk(h);
          expect(
            right <= b.x - hyphenClearance ||
              left >= b.x + b.width + hyphenClearance,
          ).toBe(true);
        }
      }
      for (const lyric of system.lyrics) {
        const anchor = signed.syllables.find(
          (s) => s.id === lyric.syllableId,
        )?.startsAtNeumeId;
        expect(lyric.anchorX).toBe(
          system.neumes.find((n) => n.neumeId === anchor)?.lyricAnchorX,
        );
      }
    }
    expect(
      signed.accidentals.find((a) => a.id === 'current')?.placement,
    ).toEqual({ kind: 'above-note', noteId: 'n2' });
  },
);
