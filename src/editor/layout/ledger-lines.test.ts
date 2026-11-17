import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type NoteAppearance,
} from '../domain/chant-document';
import { lyricGraphemes } from '../domain/lyric-alignment';
import extremeRibbonContinuation from '../../../docs/verification/neume-ledger-lines/extreme-ribbon-continuation.chant.json?raw';
import { insertEditorNeume } from '../interaction/insert-editor-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import {
  createNeumeEntryPitches,
  entryGeometryKind,
  type GraphicalNeumeKind,
} from '../neume-entry-pitches';
import { buildCustosGeometry } from './custos-geometry';
import {
  ledgerCount,
  ledgerRunBounds,
  ledgerSpacing,
  ledgerStrokesNear,
  mergeLedgerRuns,
  ledgerStrokesInBand,
  pitchColumn,
  visibleLedgerRun,
  type LedgerRun,
} from './ledger-lines';
import {
  layoutChant,
  layoutGraphicalPlacementPreview,
  measureNeumeWidth,
  wrapNeumes,
  type NeumeLayout,
} from './layout-chant';
import { lyricRowTop, offStaffCanvasMargin } from './system-vertical-layout';
import { verticalLayoutViolations } from './vertical-clearance.test-cases';
import type { MeasureLyricText } from './lyric-text-metrics';
import { decodeDocument } from '../persistence/native-document';
import {
  buildNeumeBodyGeometry,
  buildNeumeGeometry,
  getInkBounds,
  type GeometryKind,
  type NeumeGeometry,
} from './neume-geometry';

const bottom = 124;
const positions = (pitches: readonly number[]) => pitches.map(staffPosition);

/** Test-only expansion (small counts): one stroke per level. */
function strokes(runs: readonly LedgerRun[] = []) {
  return runs
    .flatMap((run) =>
      Array.from({ length: run.count }, (_, i) => ({
        y: run.topY + i * ledgerSpacing,
        x1: run.x1,
        x2: run.x2,
      })),
    )
    .sort((a, b) => a.y - b.y || a.x1 - b.x1);
}

/** Independent brute force: per required level, union of overhung columns. */
function expectedStrokes(
  pitches: readonly number[],
  geometry: NeumeGeometry,
  bottomStaffY = bottom,
) {
  const levels = new Map<number, { x1: number; x2: number }[]>();
  pitches.forEach((pitch, index) => {
    const ys: number[] = [];
    if (pitch <= -2)
      for (let p = -2; p >= pitch; p -= 2) ys.push(bottomStaffY - p * 12);
    if (pitch >= 8)
      for (let p = 8; p <= pitch; p += 2) ys.push(bottomStaffY - p * 12);
    const { left, right } = pitchColumn(geometry.notes[index]);
    for (const y of ys)
      levels.set(y, [
        ...(levels.get(y) ?? []),
        { x1: left - 3, x2: right + 3 },
      ]);
  });
  return [...levels.entries()]
    .flatMap(([y, intervals]) => {
      const merged: { y: number; x1: number; x2: number }[] = [];
      for (const i of intervals.sort((a, b) => a.x1 - b.x1)) {
        const last = merged.at(-1);
        if (last && i.x1 <= last.x2) last.x2 = Math.max(last.x2, i.x2);
        else merged.push({ y, ...i });
      }
      return merged;
    })
    .sort((a, b) => a.y - b.y || a.x1 - b.x1);
}

function translated<T extends { x: number }>(value: T, dx: number): T {
  return { ...value, x: value.x + dx };
}

/** Staffed geometry is the unchanged body, rigidly translated, plus ledgers. */
function expectBodyPreserved(
  kind: GeometryKind,
  pitches: readonly number[],
  appearance: readonly NoteAppearance[] = [],
  leftX = 100,
) {
  const g = buildNeumeGeometry(
    kind,
    positions(pitches),
    leftX,
    bottom,
    appearance,
  );
  const body = buildNeumeBodyGeometry(
    kind,
    positions(pitches),
    leftX,
    bottom,
    appearance,
  );
  const required = pitches.some((p) => p <= -2 || p >= 8);
  if (!required) {
    // Byte-identical ordinary geometry; no ledger field at all.
    expect(g).toEqual(body);
    expect(g).not.toHaveProperty('ledgers');
    return g;
  }
  const dx = g.notes[0].anchorX - body.notes[0].anchorX;
  expect([0, 3]).toContain(dx);
  expect(g.bounds.x).toBe(leftX);
  expect(g.lyricAnchorX).toBe(body.lyricAnchorX + dx);
  expect(g.ink.map((s) => s.bounds)).toEqual(
    body.ink.map((s) => translated(s.bounds, dx)),
  );
  g.notes.forEach((note, i) => {
    const b = body.notes[i];
    expect([note.anchorX, note.anchorY]).toEqual([b.anchorX + dx, b.anchorY]);
    expect(note.head.bounds).toEqual(translated(b.head.bounds, dx));
    expect(note.hitBounds).toEqual(translated(b.hitBounds, dx));
  });
  expect(strokes(g.ledgers)).toEqual(expectedStrokes(pitches, g));
  // Bounded representation: never one run per ledger level.
  expect(g.ledgers?.length ?? 0).toBeLessThanOrEqual(2 * pitches.length);
  // Complete bounds and advance include every run.
  const complete = getInkBounds([
    ...g.ink,
    ...(g.ledgers ?? []).map((run) => ({
      kind: 'rect' as const,
      bounds: ledgerRunBounds(run),
      radius: 0,
    })),
  ]);
  expect(g.bounds).toEqual(complete);
  expect(g.advanceX).toBe(g.bounds.width + 33);
  return g;
}

describe('shared ledger mathematics', () => {
  it.each([
    [-5, 2],
    [-4, 2],
    [-3, 1],
    [-2, 1],
    [-1, 0],
    [0, 0],
    [3, 0],
    [6, 0],
    [7, 0],
    [8, 1],
    [9, 1],
    [10, 2],
  ])('position %i needs %i ledger lines', (position, count) => {
    expect(ledgerCount(position)).toBe(count);
    const runs = mergeLedgerRuns([{ position, left: 0, right: 12 }], bottom);
    expect(runs.length).toBe(count ? 1 : 0);
    if (!count) return;
    const [run] = runs;
    expect(run).toMatchObject({ x1: -3, x2: 15, count });
    // Lines at -2, -4, ... or 8, 10, ...; the innermost is next to the staff.
    if (position < 0) {
      expect(run.topY).toBe(bottom + 24);
      expect(run.bottomY).toBe(bottom + 24 * count);
    } else {
      expect(run.bottomY).toBe(bottom - 96);
      expect(run.topY).toBe(bottom - 96 - 24 * (count - 1));
    }
  });

  it('keeps distant pitches compact, finite and bounded', () => {
    for (const position of [-1_000_001, -1_000_000, 1_000_006, 1_000_007]) {
      const runs = mergeLedgerRuns([{ position, left: 0, right: 12 }], 0);
      expect(runs).toHaveLength(1);
      expect(runs[0].count).toBe(500_000);
      for (const value of Object.values(runs[0]))
        expect(Number.isFinite(value)).toBe(true);
      expect(runs[0].bottomY - runs[0].topY).toBe(499_999 * ledgerSpacing);
    }
    // Two distant constituents: still two runs, not one per level.
    const mixed = mergeLedgerRuns(
      [
        { position: -2, left: 0, right: 12 },
        { position: -2_000_000, left: 0, right: 12 },
      ],
      0,
    );
    expect(mixed).toHaveLength(1);
    expect(mixed[0].count).toBe(1_000_000);
    const g = buildNeumeGeometry(
      'clivis',
      positions([-999_999, -1_000_000]),
      0,
      0,
    );
    expect(g.ledgers?.length).toBeLessThanOrEqual(4);
    for (const value of Object.values(g.bounds))
      expect(Number.isFinite(value)).toBe(true);
  });

  it('limits a painted run to a window exactly on the staff grid', () => {
    const max = Number.MAX_SAFE_INTEGER;
    // Window as the renderer uses it: canvas ±1,200 plus one ledger space.
    const top = -1224;
    const bottomEdge = 220 + 1224;
    for (const position of [-max, -max + 8, max, max - 2, -400, 400]) {
      const [run] = mergeLedgerRuns([{ position, left: 0, right: 12 }], bottom);
      const painted = visibleLedgerRun(run, top, bottomEdge);
      if (!painted) throw new Error('Expected visible strokes');
      // Every painted stroke sits on the staff's 24-unit grid, nearest
      // stroke next to the staff, and only strokes inside the window.
      expect(Math.abs((painted.topY - bottom) % 24)).toBe(0);
      expect(painted.bottomY - painted.topY).toBe(
        (painted.count - 1) * ledgerSpacing,
      );
      expect(painted.topY - 0.75).toBeGreaterThan(top - 24);
      expect(painted.bottomY + 0.75).toBeLessThan(bottomEdge + 24);
      if (position < 0) {
        expect(painted.topY).toBe(bottom + 24);
        expect(painted.count).toBe(
          Math.min(run.count, Math.floor((bottomEdge - bottom - 24) / 24) + 1),
        );
      } else {
        expect(painted.bottomY).toBe(bottom - 96);
        expect(painted.count).toBe(
          Math.min(run.count, Math.floor((bottom - 96 - top) / 24) + 1),
        );
      }
      // Collision queries use the same exact anchoring near the staff.
      expect(
        ledgerStrokesInBand([run], painted.topY - 1, painted.topY + 1),
      ).toEqual([
        ledgerRunBounds({ ...painted, bottomY: painted.topY, count: 1 }),
      ]);
    }
    // Ordinary runs inside the window are painted unchanged, and a run
    // entirely outside it is not painted.
    const [ordinary] = mergeLedgerRuns(
      [{ position: -5, left: 0, right: 12 }],
      bottom,
    );
    expect(visibleLedgerRun(ordinary, top, bottomEdge)).toEqual(ordinary);
    expect(visibleLedgerRun(ordinary, 0, 100)).toBeNull();
  });

  it('answers collision queries analytically without expanding a run', () => {
    const [run] = mergeLedgerRuns(
      [{ position: -1_000_000, left: 0, right: 12 }],
      0,
    );
    // A box between two lines is clear; a box over one stroke hits only it.
    expect(
      ledgerStrokesNear([run], { x: 0, y: 30, width: 4, height: 4 }, 2),
    ).toEqual([]);
    expect(
      ledgerStrokesNear([run], { x: 0, y: 46, width: 4, height: 4 }, 2),
    ).toEqual([{ x: -3, y: 47.25, width: 18, height: 1.5 }]);
    // A horizontally separate box never hits.
    expect(
      ledgerStrokesNear([run], { x: 40, y: 46, width: 4, height: 4 }, 2),
    ).toEqual([]);
  });

  it('merges overlapping or touching intervals only, partitioned by depth', () => {
    const runs = mergeLedgerRuns(
      [
        { position: -2, left: 0, right: 12 },
        // Touches the first at x=15 after overhang.
        { position: -5, left: 18, right: 30 },
        // A positive 1-unit gap: stays separate.
        { position: -2, left: 37, right: 49 },
      ],
      0,
    );
    expect(strokes(runs)).toEqual([
      { y: 24, x1: -3, x2: 33 },
      { y: 24, x1: 34, x2: 52 },
      { y: 48, x1: 15, x2: 33 },
    ]);
    // Coalesced: the deeper column's single interval is one 1-level run.
    expect(runs).toHaveLength(3);
  });

  it('keeps custos ledger output unchanged', () => {
    expect(buildCustosGeometry(-4, 300, 124, 0, false).ledgerLines).toEqual({
      x1: 300,
      x2: 316,
      topY: 148,
      bottomY: 172,
      count: 2,
    });
    expect(buildCustosGeometry(9, 300, 124, 0, false).ledgerLines).toEqual({
      x1: 300,
      x2: 316,
      topY: 28,
      bottomY: 28,
      count: 1,
    });
    expect(buildCustosGeometry(3, 300, 124, 0, false).ledgerLines).toBeNull();
  });
});

const entryKinds: GraphicalNeumeKind[] = [
  'punctum',
  'bistropha',
  'tristropha',
  'podatus',
  'clivis',
  'scandicus',
  'scandicus-4',
  'scandicus-5',
  'torculus',
  'climacus',
  'climacus-4',
  'climacus-5',
  'porrectus',
  'torculus-resupinus',
  'porrectus-flexus',
  'scandicus-flexus',
  'climacus-resupinus',
  'pes-subbipunctis',
  'pes-subtripunctis',
  'epiphonus',
  'cephalicus',
  'augmentative-pes',
];

describe('derived neume ledger geometry', () => {
  it.each(entryKinds)(
    '%s keeps its body and derives exact ledgers in, below, above and across the staff',
    (kind) => {
      for (let first = -9; first <= 14; first++) {
        const pitches = createNeumeEntryPitches(
          kind,
          staffPosition(first),
        ).staffPositions;
        expectBodyPreserved(entryGeometryKind(kind), pitches);
      }
    },
  );

  it('derives ledgers for authored forms with their own footprints', () => {
    for (const first of [-6, -3, -2, -1, 3, 7, 8, 9, 12]) {
      expectBodyPreserved('punctum', [first], [{ form: 'virga' }]);
      const inclinatum = expectBodyPreserved(
        'punctum',
        [first],
        [{ form: 'inclinatum' }],
      );
      if (first <= -2 || first >= 8)
        // The 14-unit diamond, not a square cell.
        expect(inclinatum.ledgers?.[0].x2).toBe(
          (inclinatum.ledgers?.[0].x1 ?? 0) + 20,
        );
      expectBodyPreserved(
        'podatus',
        [first, first + 2],
        [{ form: 'quilisma' }, {}],
      );
      expectBodyPreserved(
        'scandicus',
        [first, first + 1, first + 3],
        [{}, { form: 'quilisma' }, {}],
      );
    }
  });

  it('shares a stacked column, separates disconnected components, and uses ribbon endpoint cells', () => {
    // Podatus heads share a column: one two-level run at -2/-4.
    const pes = expectBodyPreserved('podatus', [-4, -2]);
    expect(pes.ledgers).toHaveLength(1);
    expect(pes.ledgers?.[0].count).toBe(2);
    // Porrectus: the ribbon's first pitch uses its 12-unit endpoint cell, not
    // the whole ribbon, so a wide ribbon leaves a visible gap at -2.
    const porrectus = expectBodyPreserved('porrectus', [-2, -5, -2]);
    const minus2 = strokes(porrectus.ledgers).filter(
      (s) => s.y === bottom + 24,
    );
    expect(minus2).toHaveLength(2);
    expect(minus2[0]).toEqual({
      y: bottom + 24,
      x1: porrectus.notes[0].anchorX - 9,
      x2: porrectus.notes[0].anchorX + 9,
    });
    // Repeated notes: touching overhangs merge into one continuous stroke.
    const tristropha = expectBodyPreserved('tristropha', [-3, -3, -3]);
    expect(tristropha.ledgers).toEqual([
      expect.objectContaining({
        count: 1,
        x2: (tristropha.ledgers?.[0].x1 ?? 0) + 54,
      }),
    ]);
  });

  it('keeps in-staff and staffless icon geometry unchanged', () => {
    for (const kind of entryKinds) {
      const pitches = createNeumeEntryPitches(
        kind,
        staffPosition(0),
      ).staffPositions;
      const icon = buildNeumeBodyGeometry(
        entryGeometryKind(kind),
        pitches,
        0,
        0,
      );
      expect(icon).not.toHaveProperty('ledgers');
    }
    expect(
      buildNeumeBodyGeometry('climacus', positions([0, -1, -2]), 0, 0),
    ).not.toHaveProperty('ledgers');
  });
});

describe('ledger-aware signs', () => {
  it('moves a horizontal episema off a ledger stroke and keeps it distinct', () => {
    const g = buildNeumeGeometry('punctum', positions([-3]), 100, bottom, [
      { episema: true },
    ]);
    const sign = g.notes[0].modifierBounds;
    if (!sign) throw new Error('Expected episema');
    // The nominal 16-unit position above would touch the -2 ledger at
    // y=148; the existing above-then-below order at each distance picks the
    // clear 16-unit position below (y + 16 - 2).
    expect(sign.y).toBe(g.notes[0].anchorY + 14);
    expect(ledgerStrokesNear(g.ledgers ?? [], sign, 2)).toEqual([]);
  });

  it('moves a vertical episema off a ledger stroke', () => {
    const g = buildNeumeGeometry('punctum', positions([9]), 100, bottom, [
      { verticalEpisema: true },
    ]);
    const sign = g.notes[0].modifierBounds;
    if (!sign) throw new Error('Expected tick');
    expect(sign.y).toBe(g.notes[0].anchorY + 18);
    expect(ledgerStrokesNear(g.ledgers ?? [], sign, 2)).toEqual([]);
  });

  it('places every mark combination clear of ledger strokes', () => {
    for (const pitches of [[-2], [-3], [-4], [8], [9], [10], [-2, -4], [9, 8]])
      for (let mask = 0; mask < 8; mask++) {
        const kind =
          pitches.length === 1
            ? 'punctum'
            : pitches[0] < pitches[1]
              ? 'podatus'
              : 'clivis';
        const marks = pitches.map((): NoteAppearance => ({
          ...(mask & 1 ? { mora: 1 as const } : {}),
          ...(mask & 2 ? { episema: true as const } : {}),
          ...(mask & 4 ? { verticalEpisema: true as const } : {}),
        }));
        const g = buildNeumeGeometry(
          kind,
          positions(pitches),
          100,
          bottom,
          marks,
        );
        const body = buildNeumeGeometry(kind, positions(pitches), 100, bottom);
        const signs = g.ink.slice(body.ink.length);
        expect(signs).toHaveLength(
          pitches.length * ((mask & 2 ? 1 : 0) + (mask & 4 ? 1 : 0)) +
            (mask & 1 ? (pitches.length === 2 ? 2 : 1) : 0),
        );
        for (const sign of signs)
          expect(ledgerStrokesNear(g.ledgers ?? [], sign.bounds, 0)).toEqual(
            [],
          );
      }
  });

  it('clears a written accidental from the ledger and keeps the left edge contract', () => {
    for (const pitch of [-4, -3, -2, 8, 9, 10]) {
      const attached = buildNeumeGeometry(
        'punctum',
        positions([pitch]),
        100,
        bottom,
        [],
        [{ kind: 'flat', staffPosition: pitch, noteIndex: 0 }],
      );
      const [run] = attached.ledgers ?? [];
      const glyph = attached.accidentals?.[0]?.ink.bounds;
      if (!run || !glyph) throw new Error('Expected ledger and accidental');
      expect(glyph.x + glyph.width).toBeLessThanOrEqual(run.x1 - 4);
      expect(attached.bounds.x).toBe(100);
      const prefix = buildNeumeGeometry(
        'punctum',
        positions([pitch]),
        100,
        bottom,
        [],
        [{ kind: 'natural', staffPosition: pitch, noteIndex: null }],
      );
      // A prefix keeps its ordinary 20-unit advance to the ledger edge.
      expect(prefix.bounds.x).toBe(100);
      expect(prefix.ledgers?.[0].x1).toBe(120);
      expect(prefix.notes[0].anchorX).toBe(129);
    }
  });
});

const measure: MeasureLyricText = (text) => {
  const count = lyricGraphemes(text).length;
  return {
    width: count * 10,
    boundaries: Array.from({ length: count + 1 }, (_, i) => i * 10),
  };
};

function punctaDocument(pitch: number, count: number): ChantDocument {
  return {
    accidentals: [],
    clefChanges: [],
    divisions: [],
    lyricLanguage: 'la',
    title: 'Ledgers',
    clef: { type: 'c', staffLine: 3 },
    syllables: [],
    neumes: Array.from({ length: count }, (_, i): Neume => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `p${i}`, staffPosition: staffPosition(pitch) }],
    })),
  };
}

/** C4 Et(d) Je(a)sum(cd): GregoBase #4577, Completorium O.P. (1949). */
function etJesum(): ChantDocument {
  return {
    accidentals: [],
    clefChanges: [],
    divisions: [],
    lyricLanguage: 'la',
    title: 'Et Jesum ledger acceptance',
    clef: { type: 'c', staffLine: 4 },
    neumes: [
      {
        id: 'et',
        kind: 'punctum',
        notes: [{ id: 'et-d', staffPosition: staffPosition(0) }],
      },
      {
        id: 'je',
        kind: 'punctum',
        notes: [{ id: 'je-a', staffPosition: staffPosition(-3) }],
      },
      {
        id: 'sum',
        kind: 'podatus',
        notes: [
          { id: 'sum-c', staffPosition: staffPosition(-1) },
          { id: 'sum-d', staffPosition: staffPosition(0) },
        ],
      },
    ],
    syllables: [
      { id: 's-et', text: 'Et', startsAtNeumeId: 'et', boundaryBefore: 'word' },
      { id: 's-je', text: 'Je', startsAtNeumeId: 'je', boundaryBefore: 'word' },
      {
        id: 's-sum',
        text: 'sum',
        startsAtNeumeId: 'sum',
        boundaryBefore: 'continuation',
      },
    ],
  };
}

/** The B under C3 at or just inside `pitch`, keeping its degree safe. */
function nearestB(pitch: number) {
  const below = pitch - ((((pitch - 3) % 7) + 7) % 7);
  return Number.isSafeInteger(below - 4) ? below : below + 7;
}

/** One distant note as plain, marked, authored-form, flat and custos ink. */
function extremeVariants(pitch: number) {
  const at = staffPosition(pitch);
  const with_ = (neume: Neume, accidental = false) => {
    const document = punctaDocument(3, 1);
    document.neumes = [neume];
    if (accidental)
      document.accidentals = [
        { id: 'flat', kind: 'flat', ownerNoteId: 'far-0' },
      ];
    return document;
  };
  const punctum = (appearance: NoteAppearance = {}): Neume => ({
    id: 'far',
    kind: 'punctum',
    notes: [{ id: 'far-0', staffPosition: at, ...appearance }],
  });
  // The far note starts the second system, so the first ends in its custos.
  const custos = punctaDocument(3, 60);
  custos.neumes.push(punctum());
  const wrapped = layoutChant(custos).systems[0].neumes.length;
  custos.neumes.splice(wrapped, 0, ...custos.neumes.splice(-1));
  return [
    { name: 'plain', document: with_(punctum()) },
    {
      name: 'marked',
      document: with_(
        punctum({ mora: 1, episema: true, verticalEpisema: true }),
      ),
    },
    {
      name: 'virga',
      document: with_(
        punctum({ form: 'virga', episema: true, verticalEpisema: true }),
      ),
    },
    { name: 'inclinatum', document: with_(punctum({ form: 'inclinatum' })) },
    {
      name: 'quilisma pes',
      document: with_({
        id: 'far',
        kind: 'podatus',
        notes: [
          { id: 'far-0', staffPosition: at, form: 'quilisma', mora: 1 },
          {
            id: 'far-1',
            staffPosition: staffPosition(pitch + 2),
            verticalEpisema: true,
          },
        ],
      }),
    },
    {
      name: 'epiphonus',
      document: with_({
        id: 'far',
        kind: 'podatus',
        liquescence: 'diminutive',
        notes: [
          { id: 'far-0', staffPosition: at, episema: true },
          { id: 'far-1', staffPosition: staffPosition(pitch + 1) },
        ],
      }),
    },
    {
      // A written flat needs a B (C3: position ≡ 3 mod 7) with a safe degree.
      name: 'flat',
      document: with_(
        {
          id: 'far',
          kind: 'punctum',
          notes: [
            { id: 'far-0', staffPosition: staffPosition(nearestB(pitch)) },
          ],
        },
        true,
      ),
    },
    { name: 'custos', document: custos },
  ];
}

/**
 * A word split across systems: "Do" on the first neume, "mi" 30 neumes
 * later, so the melisma always ends the first syllable's system with an
 * outgoing hyphen. With `ribbon`, the first neume is a Porrectus reaching
 * MAX_SAFE_INTEGER, whose interval-proportional ribbon is ~10^17 wide.
 */
function wordAcrossSystems(ribbon: boolean, first = 'Do'): ChantDocument {
  const document = punctaDocument(3, 34);
  if (ribbon)
    document.neumes[0] = {
      id: 'n0',
      kind: 'porrectus',
      notes: [
        { id: 'far-0', staffPosition: staffPosition(Number.MAX_SAFE_INTEGER) },
        { id: 'far-1', staffPosition: staffPosition(2) },
        { id: 'far-2', staffPosition: staffPosition(3) },
      ],
    };
  document.syllables = [
    { id: 's-do', text: first, startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    {
      id: 's-mi',
      text: 'mi',
      startsAtNeumeId: 'n30',
      boundaryBefore: 'continuation',
    },
  ];
  return document;
}

describe('ledgers in layout', () => {
  it('draws exactly one ledger at -2 under Je and none for Et or sum', () => {
    for (const layout of [
      layoutChant(etJesum()),
      layoutChant(etJesum(), measure),
    ]) {
      const neumes = layout.systems[0].neumes;
      const byId = (id: string) => neumes.find((n) => n.neumeId === id);
      expect(byId('et')).not.toHaveProperty('ledgers');
      expect(byId('sum')).not.toHaveProperty('ledgers');
      const je = byId('je');
      if (!je) throw new Error('Missing Je');
      expect(je.ledgers).toEqual([
        {
          x1: je.notes[0].anchorX - 9,
          x2: je.notes[0].anchorX + 9,
          topY: bottom + 24,
          bottomY: bottom + 24,
          count: 1,
        },
      ]);
      // Stage 11B: the shared lyric row drops below the low A and its
      // system grows by the same amount; the staff does not move.
      const [system] = layout.systems;
      const rowTop = lyricRowTop(system.lyricBaselineY);
      expect(system.bottomStaffY).toBe(bottom);
      expect(je.bounds.y + je.bounds.height).toBe(rowTop);
      expect(system.lyricBaselineY).toBeGreaterThan(180);
      expect(system.height).toBe(220 + system.lyricBaselineY - 180);
      for (const lyric of system.lyrics)
        expect(lyric.y).toBe(system.lyricBaselineY);
      expect(verticalLayoutViolations(layout)).toEqual([]);
    }
  });

  it('spaces, compacts and wraps by complete ledger ink', () => {
    const low = layoutChant(punctaDocument(-3, 2)).systems[0].neumes;
    const gap = (n: readonly NeumeLayout[]) =>
      n[1].bounds.x - (n[0].bounds.x + n[0].bounds.width);
    expect(gap(low)).toBe(33);
    expect(low[1].notes[0].anchorX - low[0].notes[0].anchorX).toBe(18 + 33);
    const plain = layoutChant(punctaDocument(3, 2)).systems[0].neumes;
    expect(plain[1].notes[0].anchorX - plain[0].notes[0].anchorX).toBe(12 + 33);
    expect(measureNeumeWidth(punctaDocument(-3, 1).neumes[0])).toBe(18);
    // A melisma's 6-unit compact gap keeps separate, unbridged ledgers.
    const melisma = punctaDocument(-3, 2);
    melisma.syllables = [
      { id: 's', text: 'A', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    ];
    const compact = layoutChant(melisma, measure).systems[0].neumes;
    expect(gap(compact)).toBe(6);
    expect(compact[1].ledgers?.[0].x1).toBeGreaterThan(
      compact[0].ledgers?.[0].x2 ?? Infinity,
    );
    const fitLow = wrapNeumes(punctaDocument(-3, 40).neumes)[0].neumes.length;
    const fitPlain = wrapNeumes(punctaDocument(3, 40).neumes)[0].neumes.length;
    expect(fitLow).toBeLessThan(fitPlain);
  });

  it('includes off-staff ledger ink in the outer canvas and keeps ordinary canvases', () => {
    const ordinary = layoutChant(punctaDocument(3, 3));
    expect([ordinary.x, ordinary.y, ordinary.height]).toEqual([0, 0, 220]);
    const deep = layoutChant(punctaDocument(-16, 3));
    const run = deep.systems[0].neumes[0].ledgers?.[0];
    if (!run) throw new Error('Expected ledgers');
    expect(run.count).toBe(8);
    expect(deep.y + deep.height).toBeGreaterThanOrEqual(run.bottomY + 0.75);
    const high = layoutChant(punctaDocument(16, 3));
    const top = high.systems[0].neumes[0].ledgers?.[0];
    if (!top) throw new Error('Expected ledgers');
    expect(high.y).toBeLessThanOrEqual(top.topY - 0.75);
    expect(high.systems[0].y).toBe(0);
  });

  it('bounds canvas growth for absurd but valid pitches of all musical ink', () => {
    // A rendering safeguard, not a pitch restriction: every kind of musical
    // ink (plain, marked, authored forms, accidentals, custodes) grows the
    // canvas by at most offStaffCanvasMargin beyond its system, on both sides.
    const extremes = [
      Number.MAX_SAFE_INTEGER,
      -Number.MAX_SAFE_INTEGER,
      400,
      -400,
    ];
    for (const pitch of extremes)
      for (const variant of extremeVariants(pitch)) {
        const layout = layoutChant(variant.document);
        const label = `${variant.name} at ${pitch}`;
        const last = layout.systems.at(-1);
        if (!last) throw new Error('Expected systems');
        expect(layout.y, label).toBeGreaterThanOrEqual(-offStaffCanvasMargin);
        expect(layout.y + layout.height, label).toBeLessThanOrEqual(
          last.y + last.height + offStaffCanvasMargin,
        );
        // The ink reaches the clipped edge, and its pitch stays semantic.
        expect(layout.height, label).toBeGreaterThanOrEqual(
          offStaffCanvasMargin,
        );
        // Stage 11B: systems reserve their band-limited ink, so the canvas
        // starts at the first system and no system exceeds the bounded band.
        expect(layout.y, label).toBe(0);
        for (const system of layout.systems)
          expect(system.height, label).toBeLessThanOrEqual(
            220 + 2 * offStaffCanvasMargin + 80,
          );
        expect(verticalLayoutViolations(layout), label).toEqual([]);
        const neumes = layout.systems.flatMap((system) => system.neumes);
        for (const neume of neumes) {
          expect(Number.isFinite(neume.bounds.y), label).toBe(true);
          for (const run of neume.ledgers ?? [])
            expect(Number.isFinite(run.count), label).toBe(true);
        }
        expect(
          neumes.find((neume) => neume.neumeId === 'far')?.notes[0],
          label,
        ).toBeDefined();
        if (variant.name === 'flat')
          expect(layout.systems[0].neumes[0].accidentals?.length, label).toBe(
            1,
          );
        if (variant.name === 'custos') {
          const guide = layout.systems[0].custodes[0];
          expect(guide, label).toBeDefined();
          expect(Number.isFinite(guide.bounds.y), label).toBe(true);
          expect(guide.ledgerLines?.count, label).toBeGreaterThan(40);
        }
      }
  });

  it('bounds horizontal growth from an interval-proportional ribbon', () => {
    // A Porrectus ribbon's width follows its interval (approved engraving),
    // so one reaching a safe-integer pitch is ~10^17 units wide. Its custos,
    // clef or division may also extend the staff that far.
    const max = Number.MAX_SAFE_INTEGER;
    const ribbon: Neume = {
      id: 'far',
      kind: 'porrectus',
      notes: [
        { id: 'far-0', staffPosition: staffPosition(max) },
        { id: 'far-1', staffPosition: staffPosition(3) },
        { id: 'far-2', staffPosition: staffPosition(4) },
      ],
    };
    const followed = punctaDocument(3, 2);
    followed.neumes.splice(1, 0, ribbon);
    const alone = punctaDocument(3, 0);
    alone.neumes = [ribbon];
    for (const document of [alone, followed]) {
      const layout = layoutChant(document);
      const ribbonLayout = layout.systems
        .flatMap((system) => system.neumes)
        .find((neume) => neume.neumeId === 'far');
      expect(ribbonLayout?.bounds.width).toBeGreaterThan(1e16);
      expect(layout.x).toBeGreaterThanOrEqual(-offStaffCanvasMargin);
      expect(layout.x + layout.width).toBeLessThanOrEqual(
        720 + offStaffCanvasMargin,
      );
      expect(layout.y).toBeGreaterThanOrEqual(-offStaffCanvasMargin);
    }
  });

  it('keeps an outgoing hyphen after an extreme ribbon within the canvas safeguard', () => {
    // Do- on an interval-proportional ribbon reaching a distant pitch, -mi on
    // the next system: the outgoing hyphen follows the ribbon's ~10^17-unit
    // right edge, but that musical displacement must not defeat the margin.
    // The committed native v10 fixture decodes to the same document.
    const native = decodeDocument(extremeRibbonContinuation);
    expect(native.neumes).toEqual(wordAcrossSystems(true).neumes);
    expect(native.syllables).toEqual(wordAcrossSystems(true).syllables);
    for (const document of [native, wordAcrossSystems(true)]) {
      const layout = layoutChant(document, measure);
      const hyphens = layout.systems.flatMap((system) => system.hyphens);
      const outgoing = hyphens.find((hyphen) => hyphen.outgoing);
      if (!outgoing) throw new Error('Expected an outgoing hyphen');
      // Its derived position is unchanged (beyond the canvas, so clipped).
      expect(outgoing.x).toBeGreaterThan(1e16);
      expect(layout.x).toBeGreaterThanOrEqual(-offStaffCanvasMargin);
      expect(layout.x + layout.width).toBeLessThanOrEqual(
        720 + offStaffCanvasMargin,
      );
    }
  });

  it('keeps ordinary outgoing hyphens and oversized lyric text unchanged', () => {
    // Ordinary continuation across systems: the canvas stays the baseline.
    const plain = layoutChant(wordAcrossSystems(false), measure);
    const hyphen = plain.systems
      .flatMap((system) => system.hyphens)
      .find((h) => h.outgoing);
    if (!hyphen) throw new Error('Expected an outgoing hyphen');
    expect(hyphen.x + 5).toBeLessThanOrEqual(656);
    expect([plain.x, plain.width]).toEqual([0, 720]);
    // Genuinely oversized text still widens the canvas without any cap, and
    // its outgoing hyphen remains inside it.
    const long = wordAcrossSystems(false, 'D' + 'o'.repeat(400));
    const wide = layoutChant(long, measure);
    const longHyphen = wide.systems
      .flatMap((system) => system.hyphens)
      .find((h) => h.outgoing);
    if (!longHyphen) throw new Error('Expected an outgoing hyphen');
    expect(wide.x + wide.width).toBeGreaterThan(720 + offStaffCanvasMargin);
    // Musical ink and hyphens displaced by text overflow stay inside: the
    // horizontal limit is relative to the text-derived extent.
    expect(wide.x + wide.width).toBeGreaterThanOrEqual(longHyphen.x + 5);
    // Also without a continuation: a long word ending a system, followed by
    // its custos (no hyphen to widen the canvas past it).
    const ending = punctaDocument(3, 40);
    ending.syllables = (
      [
        ['a', 0],
        ['D' + 'o'.repeat(300), 20],
        ['b', 21],
      ] as const
    ).map(([text, at], i) => ({
      id: `s${i}`,
      text,
      startsAtNeumeId: `n${at}`,
      boundaryBefore: 'word' as const,
    }));
    for (const layout of [wide, layoutChant(ending, measure)]) {
      const right = layout.x + layout.width;
      for (const system of layout.systems) {
        for (const ink of [...system.neumes, ...system.custodes])
          expect(right).toBeGreaterThanOrEqual(ink.bounds.x + ink.bounds.width);
        expect(right).toBeGreaterThanOrEqual(system.staffLines[0].x2);
      }
    }
  });

  it('contains distant ink within the margin completely', () => {
    // 60 positions below the staff: 720 units, inside the 1,200-unit margin.
    for (const variant of extremeVariants(-60)) {
      const layout = layoutChant(variant.document);
      const ink = [
        ...layout.systems.flatMap((system) => system.neumes),
        ...layout.systems.flatMap((system) => system.custodes),
      ].map((item) => item.bounds);
      for (const bounds of ink)
        expect(layout.y + layout.height, variant.name).toBeGreaterThanOrEqual(
          bounds.y + bounds.height,
        );
    }
    for (const variant of extremeVariants(70)) {
      const layout = layoutChant(variant.document);
      for (const neume of layout.systems.flatMap((system) => system.neumes))
        expect(layout.y, variant.name).toBeLessThanOrEqual(neume.bounds.y);
    }
  });

  it('shows the same ledgers in a placement ghost and its committed neume', () => {
    const document = punctaDocument(3, 4);
    const layout = layoutChant(document);
    // A Climacus-5 from the bottom line descends to -4 (two ledger levels).
    const intent = resolveGraphicalNeumePlacement(layout, 'climacus-5', {
      x: 400,
      y: bottom,
    });
    if (!intent) throw new Error('Expected placement');
    expect(intent.staffPositions).toEqual([0, -1, -2, -3, -4]);
    const ghost = intent.preview;
    // The first head follows the pointer despite the ledger overhang.
    expect(ghost.notes[0].anchorX).toBe(400);
    expect(ghost.ledgers?.length).toBeGreaterThan(0);
    const committed = layoutChant(
      insertEditorNeume(document, intent, {
        neumeId: 'new',
        noteIds: ['a', 'b', 'c', 'd', 'e'],
      }),
    )
      .systems.flatMap((s) => s.neumes)
      .find((n) => n.neumeId === 'new');
    if (!committed) throw new Error('Expected committed neume');
    const relative = (g: NeumeGeometry) =>
      (g.ledgers ?? []).map((run) => ({
        ...run,
        x1: run.x1 - g.notes[0].anchorX,
        x2: run.x2 - g.notes[0].anchorX,
      }));
    expect(relative(committed)).toEqual(relative(ghost));
    // Pointer entry starts at -1..7, but other callers may preview any
    // contour: a first-column ledger keeps the first head on the pointer.
    const low = layoutGraphicalPlacementPreview(
      layout,
      {
        kind: 'punctum',
        staffPositions: [staffPosition(-3)],
        insertionIndex: 0,
      },
      { x: 400, y: bottom },
    );
    expect(low?.notes[0].anchorX).toBe(400);
    expect(low?.bounds.x).toBe(391);
    // Ledger-free ghosts keep the head half-width offset.
    const plain = resolveGraphicalNeumePlacement(layout, 'punctum', {
      x: 400,
      y: bottom - 36,
    });
    expect(plain?.preview.notes[0].anchorX).toBe(400);
    expect(plain?.preview).not.toHaveProperty('ledgers');
  });
});
