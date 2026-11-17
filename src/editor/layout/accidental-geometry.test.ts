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
import {
  firstSystemBottomStaffY,
  intraSyllableInkGap,
  layoutChant,
  lyricJoinThreshold,
  type ChantSystemLayout,
} from './layout-chant';
import {
  canonicalLyricBaselineY,
  lyricAscent,
  musicToLyricClearance,
} from './system-vertical-layout';
import {
  systemViolations,
  verticalLayoutViolations,
} from './vertical-clearance.test-cases';
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
/**
 * Stage 11B (ADR 0028): the shared lyric row clears every sign vertically
 * (neume bounds include their signs) and all text shares its baseline.
 */
function expectLyricRowClearsSigns(system: ChantSystemLayout) {
  expect(systemViolations(system)).toEqual([]);
}
// ADR 0028 changed these expectations: a low sign formerly moved away from,
// or reserved horizontal room against, a lyric at the fixed baseline. Signs
// now clear musical ink only and the shared lyric row moves below them.
it('clears a low natural beside its own lyric vertically, keeping its music-only x and staff', () => {
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
    layout = layoutChant(signed, measure),
    system = layout.systems[0];
  const musicOnly = layoutChant({ ...signed, syllables: [] }, measure)
    .systems[0].neumes[0];
  const glyph = system.neumes[0].accidentals?.[0],
    lyric = system.lyrics[0];
  if (!glyph || lyric.left === null) throw Error('Expected measured geometry');
  expect(system.neumes[0].bounds).toEqual(musicOnly.bounds);
  expect(glyph.ink).toEqual(musicOnly.accidentals?.[0]?.ink);
  // The natural now overlaps its lyric's columns; the baseline moves instead.
  expect(glyph.ink.bounds.x + glyph.ink.bounds.width).toBeGreaterThan(
    lyric.left,
  );
  expect(lyric.y).toBe(
    glyph.ink.bounds.y +
      glyph.ink.bounds.height +
      musicToLyricClearance +
      lyricAscent,
  );
  expect(lyric.y).toBeGreaterThan(canonicalLyricBaselineY);
  expectLyricRowClearsSigns(system);
  expect(verticalLayoutViolations(layout)).toEqual([]);
  expect(lyric.anchorX).toBe(system.neumes[0].lyricAnchorX);
  expect(system.neumes[0].notes[0].anchorY).toBe(148);
});
it.each(['Sanctus', 'Benedictus', 'Sanctissimus'])(
  'places a later low sign by music alone after the preceding %s lyric; the lyric row clears it',
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
    const [a, b] = system?.neumes ?? [];
    const glyph = b?.accidentals?.[0];
    if (!system || !glyph) throw Error('Expected glyph');
    // Formerly shifted (or wrapped) past the lyric; now only the compact
    // melisma minimum separates the groups, and the default prefix starts b.
    expect(layout.systems).toHaveLength(1);
    expect(b.bounds.x).toBe(a.bounds.x + a.bounds.width + intraSyllableInkGap);
    expect(glyph.ink.bounds.x).toBe(b.bounds.x);
    expectLyricRowClearsSigns(system);
    expect(verticalLayoutViolations(layout)).toEqual([]);
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
  'adds room above a high %s with default and explicit placement, moving the staff and canvas together',
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
      // Stage 11B: the system grows above the staff instead of the canvas
      // origin becoming negative; the staff, sign and canvas move together.
      const [system] = layout.systems;
      expect(layout.y).toBe(0);
      expect(system.bottomStaffY).toBeGreaterThan(firstSystemBottomStaffY);
      expect(system.staffLines[0].y).toBe(system.bottomStaffY);
      expect(sign.ink.bounds.y).toBeGreaterThanOrEqual(system.y + 12);
      expect(sign.ink.bounds.y + sign.ink.bounds.height).toBeLessThanOrEqual(
        layout.y + layout.height,
      );
      expect(verticalLayoutViolations(layout)).toEqual([]);
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
  'clears a later centered lyric below earlier low accidental ink with %s fillers on %s systems',
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
    // Formerly the lyric was pushed right of the sign; it now keeps its
    // music/lyric-derived x and passes beneath the sign.
    const glyph = system.neumes.find((n) => n.neumeId === 'low')
      ?.accidentals?.[0]?.ink.bounds;
    if (!glyph || lyric.left === null) throw Error('Expected measured sign');
    expect(lyric.left).toBeLessThan(glyph.x + glyph.width + 4);
    expectLyricRowClearsSigns(system);
    expect(verticalLayoutViolations(layout)).toEqual([]);
    expect(lyric.anchorX).toBe(
      system.neumes.find((n) => n.neumeId === 'text')?.lyricAnchorX,
    );
    expect(layout.systems.flatMap((s) => s.neumes)).toHaveLength(fillers + 2);
  },
);

it('keeps text positions and the join unchanged by an intervening low natural below which the lyric row passes', () => {
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
  const unsigned = layoutChant(d, measure).systems[0];
  const layout = layoutChant(
    updateAccidental(d, 'n1', 'natural', 'sign'),
    measure,
  );
  expect(layout.systems).toHaveLength(1);
  const [system] = layout.systems;
  const glyph = system.neumes[1].accidentals?.[0]?.ink.bounds;
  if (!glyph) throw Error('Expected sign');
  // Formerly the natural forced a separated, hyphenated continuation. It is
  // not a lyric-row obstacle (ADR 0028): Benedictus keeps the position and
  // compact join derived from the text and following music alone.
  const textEdges = (s: ChantSystemLayout) =>
    s.lyrics.map((l) => [l.left, l.right]);
  expect(textEdges(system)).toEqual(textEdges(unsigned));
  expect(system.neumes[2].bounds).toEqual(unsigned.neumes[2].bounds);
  expect(system.hyphens).toEqual([]);
  expect(glyph.x + glyph.width).toBeGreaterThan(system.lyrics[1].left ?? 0);
  expect(system.lyricBaselineY).toBeGreaterThan(unsigned.lyricBaselineY);
  expectLyricRowClearsSigns(system);
  expect(verticalLayoutViolations(layout)).toEqual([]);
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
    // The default flat keeps its music-only prefix position (formerly moved
    // left of its own lyric); the lyric row passes beneath it.
    expect(sign.x).toBe(system.neumes[0].bounds.x);
    expectLyricRowClearsSigns(system);
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
  'derives the continuation join or hyphen from text gaps alone before the current %s group',
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
    const sign = system.neumes.flatMap((n) => n.accidentals ?? [])[0].ink
      .bounds;
    const before = system.lyrics[0],
      after = system.lyrics[1];
    const metrics = {
      before: [before.left, before.right],
      natural: [sign.x, sign.x + sign.width],
      after: [after.left, after.right],
      hyphens: system.hyphens.map(hyphenInk),
    };
    // Before ADR 0028 the natural forced a hyphen at [162, 182] with men at
    // [196, 256] (earlier anchor), and pushed men to [219, 279] with a hyphen
    // at [173.5, 193.5] (default prefix). Now the earlier-anchor case keeps
    // the compact join and the default-prefix hyphen is centred in the text
    // gap; the natural is cleared vertically by the lyric row.
    expect(metrics).toEqual(
      placement === 'earlier-anchor'
        ? {
            before: [140, 160],
            natural: [186, 194],
            after: [161, 221],
            hyphens: [],
          }
        : {
            before: [140, 160],
            natural: [207, 215],
            after: [206, 266],
            hyphens: [[173, 193]],
          },
    );
    for (const [hyphenLeft, hyphenRight] of metrics.hyphens) {
      expect(hyphenLeft).toBeGreaterThanOrEqual(
        (before.right ?? 0) + hyphenClearance,
      );
      expect(hyphenRight).toBeLessThanOrEqual(
        (after.left ?? 0) - hyphenClearance,
      );
    }
    expectLyricRowClearsSigns(system);
    expect(verticalLayoutViolations(layout)).toEqual([]);
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
  // Signs no longer enlarge the lyric reservation (ADR 0028), so the split
  // continuation now first occurs with 9 fillers (formerly 8).
  [8, 'one system', [0, 0, 0, 0]],
  [9, 'a continuation split across systems', [0, 0, 1, 1]],
  [10, 'the whole sequence wrapped', [1, 1, 1, 1]],
  [12, 'the whole sequence wrapped', [1, 1, 1, 1]],
] as const)(
  'keeps the lyric row and hyphens below both preceding and current low signs with %s fillers (%s)',
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
    expect(verticalLayoutViolations(layout)).toEqual([]);
    for (const system of layout.systems) {
      expectLyricRowClearsSigns(system);
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
