import { describe, expect, it } from 'vitest';
import salveRegina from '../examples/Salve-Regina-Dominican.chant.json?raw';
import kyrieXi from '../examples/Kyrie-XI.chant.json?raw';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
} from '../domain/chant-document';
import { blankDocument, decodeDocument } from '../persistence/native-document';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { resolveScoreSlot } from '../interaction/resolve-score-slot';
import { moveNoteVertically } from '../commands/move-note';
import {
  firstSystemBottomStaffY,
  layoutChant,
  staffEndX,
  type ChantLayout,
  type ChantSystemLayout,
} from './layout-chant';
import type { AccidentalSpec } from './accidental-geometry';
import { ledgerThickness } from './ledger-lines';
import type { MeasureLyricText } from './lyric-text-metrics';
import {
  buildNeumeGeometry,
  geometryKindFor,
  type LayoutBounds,
  type NeumeGeometry,
} from './neume-geometry';
import {
  canonicalLyricBaselineY,
  canonicalMusicBand,
  lyricAscent,
  lyricBottomPadding,
  lyricDescent,
  lyricRowTop,
  measureSystemVertical,
  musicToLyricClearance,
  offStaffCanvasMargin,
  stackSystems,
  systemGap,
  systemHeight,
  systemMusicPadding,
} from './system-vertical-layout';
import { verticalLayoutViolations } from './vertical-clearance.test-cases';
import { writtenAccidentals } from '../domain/accidentals';
import { neumeSelectionBounds } from '../rendering/neume-selection-bounds';
import { rangeSelectionBounds } from '../rendering/range-selection-bounds';
import {
  clampToBand,
  moveCaptionBaseline,
  moveCaptionFontSize,
} from '../rendering/render-band';

const bundledSources = import.meta.glob<string>('../examples/*.chant.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * The x projection of a neume group, including its written signs: the
 * horizontal facts composition decided.
 */
const xProjection = (
  g: Pick<NeumeGeometry, 'bounds' | 'lyricAnchorX' | 'advanceX'> & {
    notes: readonly { anchorX: number }[];
    accidentals?: readonly { ink: { bounds: LayoutBounds } }[];
  },
) => [
  g.bounds.x,
  g.bounds.width,
  g.lyricAnchorX,
  g.advanceX,
  g.notes.map((n) => n.anchorX),
  (g.accidentals ?? []).map((a) => [a.ink.bounds.x, a.ink.bounds.width]),
];

const measure: MeasureLyricText = (text) => {
  const graphemes = [...text];
  return {
    width: graphemes.length * 10,
    boundaries: Array.from({ length: graphemes.length + 1 }, (_, i) => i * 10),
  };
};
const ink = (y: number, height: number) => ({ x: 0, y, width: 10, height });
const staff = ink(52, 72);

function punctaDocument(
  positions: readonly number[],
  lyrics: 'every' | 'none' = 'every',
): ChantDocument {
  const document = blankDocument();
  document.title = 'Vertical';
  document.lyricLanguage = 'la';
  document.neumes = positions.map((p, i) => ({
    id: `n${i}`,
    kind: 'punctum',
    notes: [{ id: `p${i}`, staffPosition: staffPosition(p) }],
  }));
  document.syllables =
    lyrics === 'every'
      ? positions.map((_, i) => ({
          id: `s${i}`,
          text: 'la',
          startsAtNeumeId: `n${i}`,
          boundaryBefore: 'word' as const,
        }))
      : [];
  return document;
}

/** Index of the system holding a neume. */
const systemOf = (layout: ChantLayout, neumeId: string) =>
  layout.systems.findIndex((s) => s.neumes.some((n) => n.neumeId === neumeId));

/** x-only projection: horizontal composition and membership. */
function horizontal(layout: ChantLayout) {
  return layout.systems.map((s) => ({
    start: s.startNeumeIndex,
    neumes: s.neumes.map((n) => [
      n.neumeId,
      n.bounds.x,
      n.bounds.width,
      n.lyricAnchorX,
      ...n.notes.map((note) => note.anchorX),
    ]),
    lyrics: s.lyrics.map((l) => [l.syllableId, l.x, l.left, l.right]),
    hyphens: s.hyphens.map((h) => [h.x, h.outgoing]),
    slots: s.slots.map((slot) => [slot.x, slot.hitRight]),
    custodes: s.custodes.map((c) => c.bounds.x),
    divisions: s.divisions.map((d) => d.bounds.x),
  }));
}

/** Every pitch-bearing coordinate agrees with the system's resolved origin. */
function expectConsistentOrigin(system: ChantSystemLayout, doc: ChantDocument) {
  expect(system.staffLines.map((l) => l.y)).toEqual([
    system.bottomStaffY,
    system.bottomStaffY - 24,
    system.bottomStaffY - 48,
    system.bottomStaffY - 72,
  ]);
  for (const neume of system.neumes) {
    const semantic = doc.neumes.find((n) => n.id === neume.neumeId);
    if (!semantic) throw Error('Missing neume');
    neume.notes.forEach((note, i) =>
      expect(note.anchorY).toBe(
        system.bottomStaffY - semantic.notes[i].staffPosition * 12,
      ),
    );
    if (neume.accidentals?.length) continue;
    // The shared builder at the resolved origin reproduces the committed
    // geometry (paths, bounds, ledgers, anchors and hit shapes).
    const rebuilt = buildNeumeGeometry(
      geometryKindFor(semantic),
      semantic.notes.map((n) => n.staffPosition),
      neume.bounds.x,
      system.bottomStaffY,
      semantic.notes,
    );
    expect(neume.ink).toEqual(rebuilt.ink);
    expect(neume.bounds).toEqual(rebuilt.bounds);
    expect(neume.ledgers).toEqual(rebuilt.ledgers);
    expect(neume.notes.map((n) => n.hitBounds)).toEqual(
      rebuilt.notes.map((n) => n.hitBounds),
    );
  }
}

describe('measureSystemVertical', () => {
  it('keeps ordinary staff, baseline and height when music clears the row', () => {
    expect(measureSystemVertical([staff, ink(40, 117)], true)).toEqual({
      music: { top: 40, bottom: 157 },
      topExpansion: 0,
      lyricBaselineY: canonicalLyricBaselineY,
      bottom: systemHeight,
    });
    expect(lyricBottomPadding).toBe(35);
    expect(lyricRowTop(canonicalLyricBaselineY)).toBe(157);
  });

  it('expands the baseline from the exact clearance boundary', () => {
    const at = (bottom: number) =>
      measureSystemVertical([staff, ink(100, bottom - 100)], true);
    expect(at(157).lyricBaselineY).toBe(180);
    expect(at(157.5).lyricBaselineY).toBe(180.5);
    expect(at(167)).toMatchObject({ lyricBaselineY: 190, bottom: 230 });
    const deep = at(400);
    expect(deep.lyricBaselineY).toBe(400 + 3 + 20);
    expect(deep.bottom).toBe(deep.lyricBaselineY + lyricDescent + 35);
  });

  it('adds top room only for ink inside the top padding', () => {
    expect(measureSystemVertical([staff, ink(12, 40)], true).topExpansion).toBe(
      0,
    );
    expect(measureSystemVertical([staff, ink(11, 40)], true).topExpansion).toBe(
      1,
    );
    expect(
      measureSystemVertical([staff, ink(-100, 40)], false).topExpansion,
    ).toBe(112);
  });

  it('reserves no lyric row on a lyricless system but keeps minimum height and padding', () => {
    expect(measureSystemVertical([staff], false).bottom).toBe(systemHeight);
    const low = measureSystemVertical([staff, ink(100, 150)], false);
    expect(low.bottom).toBe(250 + systemMusicPadding);
    expect(measureSystemVertical([staff, ink(100, 150)], true).bottom).toBe(
      250 + 3 + 20 + 5 + 35,
    );
  });

  it('bounds extreme ink at the canonical music band', () => {
    const max = Number.MAX_SAFE_INTEGER * 12;
    const both = measureSystemVertical([staff, ink(-max, 2 * max)], true);
    expect(both.music).toEqual(canonicalMusicBand);
    expect(both.topExpansion).toBe(offStaffCanvasMargin + systemMusicPadding);
    expect(both.topExpansion + both.bottom).toBeLessThan(2 * 1200 + 220 + 80);
  });
});

describe('stackSystems', () => {
  it('stacks by measured height and the ordinary gap and translates frames', () => {
    const frames = stackSystems([
      measureSystemVertical([staff], true),
      measureSystemVertical([staff, ink(-28, 40)], true),
      measureSystemVertical([staff, ink(100, 70)], true),
    ]);
    expect(frames.map((f) => [f.y, f.height, f.bottomStaffY])).toEqual([
      [0, 220, 124],
      [244, 260, 244 + 40 + 124],
      [528, 233, 528 + 124],
    ]);
    expect(frames[1].lyricBaselineY).toBe(244 + 40 + 180);
    expect(frames[2].lyricBaselineY).toBe(528 + 193);
    // Ordinary and moderately expanded systems: the resolved band is exactly
    // the system box, never the canonical 1,200-unit margin around it.
    for (const f of frames)
      expect(f.musicBand).toEqual({ top: f.y, bottom: f.y + f.height });
  });

  it('resolves extreme bands to the translated canonical band inside the box', () => {
    const max = Number.MAX_SAFE_INTEGER * 12;
    const frames = stackSystems([
      measureSystemVertical([staff, ink(140, max)], true),
      measureSystemVertical([staff, ink(-max, max)], true),
      measureSystemVertical([staff], true),
    ]);
    const [low, high, plain] = frames;
    // Low ink: the canonical band ends inside the system's bottom padding.
    expect(low.musicBand).toEqual({
      top: low.y,
      bottom: low.bottomStaffY - 124 + canonicalMusicBand.bottom,
    });
    expect(low.y + low.height - low.musicBand.bottom).toBe(
      lyricDescent + lyricBottomPadding + musicToLyricClearance + lyricAscent,
    );
    // High ink: the canonical band starts inside the system's top padding.
    expect(high.musicBand.top).toBe(high.y + systemMusicPadding);
    expect(high.musicBand.top).toBe(
      high.bottomStaffY - 124 - offStaffCanvasMargin,
    );
    // Adjacent resolved bands never meet: the inter-system gap separates them.
    for (const [a, b] of [
      [low, high],
      [high, plain],
    ])
      expect(b.musicBand.top - a.musicBand.bottom).toBeGreaterThanOrEqual(
        systemGap,
      );
    for (const f of frames) {
      expect(f.musicBand.top).toBeGreaterThanOrEqual(f.y);
      expect(f.musicBand.bottom).toBeLessThanOrEqual(f.y + f.height);
    }
  });
});

describe('layoutChant vertical positioning (Stage 11B)', () => {
  it('keeps ordinary multi-system geometry, baseline, height and gap', () => {
    const document = punctaDocument(Array.from({ length: 40 }, () => 2));
    const layout = layoutChant(document, measure);
    expect(layout.systems.length).toBeGreaterThan(2);
    layout.systems.forEach((system, i) => {
      expect(system.y).toBe(i * (systemHeight + systemGap));
      expect(system.height).toBe(systemHeight);
      expect(system.bottomStaffY).toBe(firstSystemBottomStaffY + system.y);
      expect(system.lyricBaselineY).toBe(180 + system.y);
    });
    expect([layout.x, layout.y]).toEqual([0, 0]);
    expect(layout.height).toBe(layout.systems.length * 244 - 24);
    expect(verticalLayoutViolations(layout)).toEqual([]);
  });

  it('keeps bundled Kyrie XI at the ordinary vertical layout', () => {
    const layout = layoutChant(decodeDocument(kyrieXi), measure);
    layout.systems.forEach((system, i) => {
      expect([system.y, system.height]).toEqual([i * 244, 220]);
      expect(system.lyricBaselineY - system.y).toBe(180);
    });
    expect(verticalLayoutViolations(layout)).toEqual([]);
  });

  it('expands only the system with low ink and moves later systems by that amount', () => {
    const positions = Array.from({ length: 40 }, () => 2);
    const plain = layoutChant(punctaDocument(positions), measure);
    const lowIndex = plain.systems[1].startNeumeIndex + 2;
    const lowDocument = punctaDocument(
      positions.map((p, i) => (i === lowIndex ? -6 : p)),
    );
    const low = layoutChant(lowDocument, measure);
    expect(horizontal(low).map((s) => s.start)).toEqual(
      horizontal(plain).map((s) => s.start),
    );
    const grow = low.systems[1].height - 220;
    expect(grow).toBeGreaterThan(0);
    expect(low.systems[0]).toEqual(plain.systems[0]);
    expect(low.systems[1].bottomStaffY).toBe(plain.systems[1].bottomStaffY);
    expect(low.systems[1].lyricBaselineY).toBe(
      plain.systems[1].lyricBaselineY + grow,
    );
    for (let i = 2; i < low.systems.length; i++) {
      expect(low.systems[i].y).toBe(plain.systems[i].y + grow);
      expect(low.systems[i].height).toBe(220);
    }
    expect(low.height).toBe(plain.height + grow);
    for (const system of low.systems)
      expectConsistentOrigin(system, lowDocument);
    expect(verticalLayoutViolations(low)).toEqual([]);
  });

  it('adds room above high ink, moving staff and lyrics together', () => {
    const document = punctaDocument([2, 16, 2]);
    const layout = layoutChant(document, measure);
    const [system] = layout.systems;
    const top = system.bottomStaffY - firstSystemBottomStaffY;
    expect(top).toBeGreaterThan(0);
    expect(system.lyricBaselineY).toBe(180 + top);
    expect(system.height).toBe(220 + top);
    expect(layout.y).toBe(0);
    const high = system.neumes[1].bounds;
    expect(high.y).toBe(system.y + systemMusicPadding);
    expectConsistentOrigin(system, document);
    expect(verticalLayoutViolations(layout)).toEqual([]);
  });

  it('keeps x geometry and membership when already-expanded systems expand further', () => {
    // Opposing high and low ink across systems, with lyrics, hyphens,
    // divisions and clef changes. Both layouts expand; moving the extreme
    // notes further from the staff (same ink widths, deeper baselines and
    // higher staff origins) must leave every x coordinate, slot and system
    // membership unchanged. (An unexpanded reference would differ in x:
    // ledger overhangs widen ledgered notes.)
    const build = (low: number, high: number) => {
      const built = punctaDocument(
        Array.from({ length: 50 }, (_, i) =>
          i % 7 === 3 ? low : i % 11 === 5 ? high : 2,
        ),
      );
      built.syllables = built.syllables.map((s, i) =>
        i % 3 ? { ...s, boundaryBefore: 'continuation' } : s,
      );
      return built;
    };
    const document = build(-8, 15);
    const further = build(-14, 21);
    document.divisions = [
      { id: 'd1', kind: 'minor', beforeNeumeId: 'n9' },
      { id: 'd2', kind: 'maior', beforeNeumeId: 'n30' },
    ];
    document.clefChanges = [
      {
        id: 'c1',
        clef: { type: 'f', staffLine: 3 },
        beforeNeumeId: 'n20',
        beforeDivisionId: null,
      },
    ];
    further.divisions = document.divisions;
    further.clefChanges = document.clefChanges;
    const once = layoutChant(document, measure);
    const twice = layoutChant(structuredClone(document), measure);
    expect(twice).toEqual(once);
    const moved = layoutChant(further, measure);
    expect(horizontal(moved)).toEqual(horizontal(once));
    expect(moved.systems.map((s) => s.lyricBaselineY)).not.toEqual(
      once.systems.map((s) => s.lyricBaselineY),
    );
    expect(verticalLayoutViolations(moved)).toEqual([]);
    expect(once.systems.length).toBeGreaterThan(2);
    expect(
      once.systems.some((s) => s.height > 220 && s.bottomStaffY - s.y > 124),
    ).toBe(true);
    expect(once.systems.some((s) => s.lyricBaselineY - s.y > 180)).toBe(true);
    for (const system of once.systems) {
      expectConsistentOrigin(system, document);
      const pitchOrigin = system.bottomStaffY;
      for (const division of system.divisions)
        expect(division.bounds.y).toBeGreaterThanOrEqual(pitchOrigin - 96);
      for (const clef of system.clefChanges)
        expect(clef.bounds.y).toBeGreaterThanOrEqual(pitchOrigin - 96);
    }
    expect(verticalLayoutViolations(once)).toEqual([]);
  });

  it('places custodes, clefs and divisions in their own system frame', () => {
    const document = punctaDocument(
      Array.from({ length: 30 }, (_, i) => (i === 14 ? 14 : i === 15 ? -7 : 2)),
    );
    document.clefChanges = [
      {
        id: 'c1',
        clef: { type: 'c', staffLine: 2 },
        beforeNeumeId: 'n22',
        beforeDivisionId: null,
      },
    ];
    document.divisions = [{ id: 'd1', kind: 'finalis', beforeNeumeId: null }];
    const layout = layoutChant(document, measure);
    for (const system of layout.systems) {
      expectConsistentOrigin(system, document);
      for (const guide of system.custodes) {
        expect(guide.bounds.y).toBeGreaterThanOrEqual(
          system.y + systemMusicPadding,
        );
        expect(guide.bounds.y + guide.bounds.height).toBeLessThanOrEqual(
          system.lyricBaselineY - 23,
        );
      }
    }
    expect(verticalLayoutViolations(layout)).toEqual([]);
  });

  it('keeps an empty document and lyricless systems at minimum height', () => {
    const empty = layoutChant(blankDocument(), measure);
    expect(empty.systems).toHaveLength(1);
    expect([empty.y, empty.height, empty.systems[0].height]).toEqual([
      0, 220, 220,
    ]);
    const lyricless = layoutChant(punctaDocument([2, -4, 2], 'none'), measure);
    expect(lyricless.systems[0].height).toBe(220);
    expect(lyricless.systems[0].lyrics).toEqual([]);
    const deep = layoutChant(punctaDocument([2, -12, 2], 'none'), measure);
    const note = deep.systems[0].neumes[1].bounds;
    expect(deep.systems[0].height).toBe(note.y + note.height + 12);
    expect(verticalLayoutViolations(deep)).toEqual([]);
  });

  it('keeps provisional (unmeasured) lyrics vertically safe on the same frames', () => {
    const document = punctaDocument([2, -6, 2, 2]);
    const provisional = layoutChant(document);
    const measured = layoutChant(document, measure);
    expect(provisional.systems[0].lyrics).toHaveLength(4);
    expect(provisional.systems[0].lyricBaselineY).toBe(
      measured.systems[0].lyricBaselineY,
    );
    expect(provisional.systems[0].lyricBaselineY).toBeGreaterThan(180);
    expect(verticalLayoutViolations(provisional)).toEqual([]);
  });

  it('keeps hit mapping, slots and graphical placement on a later system after an expanded one', () => {
    const positions = Array.from({ length: 40 }, () => 2);
    const plain = layoutChant(punctaDocument(positions), measure);
    const document = punctaDocument(
      positions.map((p, i) => (i === 2 ? -9 : p)),
    );
    const layout = layoutChant(document, measure);
    expect(layout.systems[0].height).toBeGreaterThan(220);
    const later = layout.systems[1];
    const shift = later.y - plain.systems[1].y;
    expect(shift).toBeGreaterThan(0);
    const target = later.neumes[3];
    const point = {
      x: target.bounds.x + target.bounds.width + 1,
      y: later.bottomStaffY - 5 * 12,
    };
    const placed = resolveGraphicalNeumePlacement(layout, 'punctum', point);
    expect(placed?.staffPositions).toEqual([5]);
    expect(placed?.insertionIndex).toBe(later.startNeumeIndex + 4);
    expect(placed?.preview.ink[0].bounds.y).toBeCloseTo(
      later.bottomStaffY - 5 * 12 - 6,
      0,
    );
    const slot = resolveScoreSlot(layout, point);
    expect(slot?.systemIndex).toBe(1);
    // The same pitch point using the ordinary (unshifted) frame now falls in
    // the earlier, expanded system or nowhere, not in system 1.
    expect(
      resolveScoreSlot(layout, { x: point.x, y: point.y - shift })?.systemIndex,
    ).not.toBe(1);
    // Inter-system gap and lyric room keep their existing ownership.
    const gapY = later.y - systemGap / 2;
    expect(resolveScoreSlot(layout, { x: point.x, y: gapY })).toBeNull();
    // Committing a transposition that expands system 1 moves later systems.
    const id = document.neumes[later.startNeumeIndex + 1].notes[0].id;
    let moved = document;
    for (let i = 0; i < 10; i++) moved = moveNoteVertically(moved, id, -1);
    const reflowed = layoutChant(moved, measure);
    expect(horizontal(reflowed).map((s) => s.start)).toEqual(
      horizontal(layout).map((s) => s.start),
    );
    expect(reflowed.systems[1].height).toBeGreaterThan(220);
    expect(reflowed.systems[2].y).toBeGreaterThan(layout.systems[2].y);
    expect(verticalLayoutViolations(reflowed)).toEqual([]);
  });

  it('bounds opposing extreme systems and keeps later notes usable', () => {
    const max = Number.MAX_SAFE_INTEGER;
    const document = punctaDocument(
      Array.from({ length: 40 }, (_, i) =>
        i === 3 ? max : i === 20 ? -max + 8 : 2,
      ),
    );
    const layout = layoutChant(document, measure);
    expect(layout.systems.length).toBeGreaterThan(2);
    for (const system of layout.systems) {
      expect(system.height).toBeLessThanOrEqual(2 * 1200 + 220 + 80);
      expect(system.musicBand.top).toBeGreaterThanOrEqual(system.y - 1200);
      expectConsistentOrigin(system, document);
    }
    // Opposing neighbours: one system's clipped (band-limited) low ink ends
    // before the next system's clipped high ink begins.
    const clipped = (s: ChantSystemLayout) =>
      s.neumes.map((n) => ({
        top: Math.max(s.musicBand.top, n.bounds.y),
        bottom: Math.min(s.musicBand.bottom, n.bounds.y + n.bounds.height),
      }));
    for (let i = 1; i < layout.systems.length; i++) {
      const a = clipped(layout.systems[i - 1]),
        b = clipped(layout.systems[i]);
      expect(Math.max(...a.map((r) => r.bottom))).toBeLessThan(
        Math.min(...b.map((r) => r.top)),
      );
    }
    expect(
      layout.systems.filter((s) => s.height > 1200).length,
    ).toBeGreaterThanOrEqual(2);
    expect(layout.height).toBeLessThan(layout.systems.length * 2800);
    expect(verticalLayoutViolations(layout)).toEqual([]);
    const later = layout.systems.at(-1);
    if (!later) throw Error('Expected systems');
    const target = later.neumes[0];
    expect(
      resolveScoreSlot(layout, {
        x: target.bounds.x - 2,
        y: later.bottomStaffY - 24,
      })?.systemIndex,
    ).toBe(later.index);
    // Actual note targeting: every later note's centre reaches exactly that
    // note, and no clipped extreme note on another system intercepts it.
    for (const system of layout.systems)
      for (const neume of system.neumes)
        for (const note of neume.notes) {
          if (!bandContains(system, note.anchorY)) continue;
          expect(notesAt(layout, { x: note.anchorX, y: note.anchorY })).toEqual(
            [note.noteId],
          );
        }
    // The extreme notes' clipped regions stay inside their own systems.
    for (const system of layout.systems)
      for (const neume of system.neumes)
        for (const note of neume.notes) {
          const region = clampToBand(note.hitBounds, system.musicBand);
          if (region.height === 0) continue;
          expect(region.y).toBeGreaterThanOrEqual(system.y);
          expect(region.y + region.height).toBeLessThanOrEqual(
            system.y + system.height,
          );
        }
  });
});

describe('translation of composed systems (Stage 11B)', () => {
  it.each(Object.entries(bundledSources))(
    'keeps every group of %s at its canonical-frame x geometry',
    (_path, source) => {
      const document = decodeDocument(source);
      const specs = new Map<string, AccidentalSpec[]>();
      for (const sign of writtenAccidentals(document) ?? []) {
        const id = sign.location.neume.id;
        specs.set(id, [
          ...(specs.get(id) ?? []),
          {
            kind: sign.entity.kind,
            staffPosition: sign.owner.degree - sign.location.offset,
            noteIndex: sign.entity.placement ? sign.location.noteIndex : null,
          },
        ]);
      }
      for (const metrics of [measure, undefined]) {
        const layout = layoutChant(document, metrics);
        for (const system of layout.systems)
          for (const neume of system.neumes) {
            const semantic = document.neumes.find(
              (n) => n.id === neume.neumeId,
            );
            if (!semantic) throw Error('Missing neume');
            // The same group composed in the canonical frame (origin 124).
            const canonical = buildNeumeGeometry(
              geometryKindFor(semantic),
              semantic.notes.map((n) => n.staffPosition),
              neume.bounds.x,
              firstSystemBottomStaffY,
              semantic.notes,
              specs.get(semantic.id) ?? [],
            );
            expect(xProjection(neume)).toEqual(xProjection(canonical));
            expect(neume.bounds.y - canonical.bounds.y).toBe(
              system.bottomStaffY - firstSystemBottomStaffY,
            );
          }
        expect(verticalLayoutViolations(layout)).toEqual([]);
      }
    },
  );
});

describe('bundled Dominican Salve Regina (Stage 11B acceptance)', () => {
  const document = decodeDocument(salveRegina);
  const je = '925dd4f8-95c3-4fb2-85d6-b09838c2b6ad';

  it.each([
    ['measured', measure],
    ['provisional', undefined],
  ] as const)(
    'clears the low A on Je of Et Jesum below a shared baseline (%s)',
    (_name, metrics) => {
      const layout = layoutChant(document, metrics);
      const index = systemOf(layout, je);
      const system = layout.systems[index];
      const neume = system.neumes.find((n) => n.neumeId === je);
      if (!neume) throw Error('Missing Je');
      expect(neume.notes[0].anchorY).toBe(system.bottomStaffY + 36);
      expect(neume.ledgers).toEqual([
        expect.objectContaining({ topY: system.bottomStaffY + 24, count: 1 }),
      ]);
      expect(neume.bounds.y + neume.bounds.height).toBeLessThanOrEqual(
        lyricRowTop(system.lyricBaselineY),
      );
      // Local measurements recorded in the verification record.
      expect(neume.bounds.y + neume.bounds.height - system.y).toBe(166);
      expect(system.lyricBaselineY - system.y).toBe(189);
      expect(system.height).toBe(229);
      expect(system.bottomStaffY - system.y).toBe(124);
      expect(new Set(system.lyrics.map((l) => l.y))).toEqual(
        new Set([system.lyricBaselineY]),
      );
      // Every other system keeps the ordinary frame, so later systems move
      // by exactly Je's expansion.
      const grow = system.height - 220;
      layout.systems.forEach((s, i) => {
        if (i !== index) expect(s.height).toBe(220);
        expect(s.y).toBe(i * 244 + (i > index ? grow : 0));
      });
      expect(verticalLayoutViolations(layout)).toEqual([]);
    },
  );

  it('keeps the anchored Nobis flat, concluding melismas and every lyric', () => {
    const layout = layoutChant(document, measure);
    const signs = layout.systems.flatMap((s) =>
      s.neumes.flatMap((n) => n.accidentals ?? []),
    );
    expect(signs.map((s) => s.accidentalId)).toEqual(
      document.accidentals.map((a) => a.id),
    );
    const anchored = signs.find((s) => s.placement !== null);
    expect(anchored?.placement?.noteId).toBe(
      'c9515841-a00c-464d-9b56-f45c1a191cb4',
    );
    expect(layout.systems.flatMap((s) => s.lyrics)).toHaveLength(
      document.syllables.length,
    );
    expect(
      layout.systems.flatMap((s) => s.neumes.map((n) => n.neumeId)),
    ).toEqual(document.neumes.map((n: Neume) => n.id));
    const last = layout.systems.at(-1);
    expect(last?.lyrics.at(-1)?.text).toBe('ia.');
    for (const system of layout.systems)
      for (const neume of system.neumes)
        expect(neume.bounds.x + neume.bounds.width).toBeLessThanOrEqual(
          staffEndX,
        );
  });
});

/** Whether a y lies in the system's resolved (clipped) musical band. */
const bandContains = (system: ChantSystemLayout, y: number) =>
  y >= system.musicBand.top && y <= system.musicBand.bottom;

const contains = (b: LayoutBounds, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/**
 * Pure model of note pointer targeting as rendered: each note's hit region is
 * limited by its neume's ownership clip (x, and y within 20 units of ink) and
 * by its system's resolved band clip.
 */
function notesAt(layout: ChantLayout, point: { x: number; y: number }) {
  return layout.systems.flatMap((system) =>
    bandContains(system, point.y)
      ? system.neumes.flatMap((neume) =>
          neume.notes
            .filter(
              (note) =>
                contains(note.hitBounds, point) &&
                (!neume.hitClip ||
                  (point.x >= neume.hitClip.left &&
                    point.x <= neume.hitClip.right &&
                    point.y >= neume.bounds.y - 20 &&
                    point.y <= neume.bounds.y + neume.bounds.height + 20)),
            )
            .map((note) => note.noteId),
        )
      : [],
  );
}

const within = (inner: LayoutBounds, outer: LayoutBounds, label: string) => {
  const epsilon = 1e-9;
  expect(inner.x, label).toBeGreaterThanOrEqual(outer.x - epsilon);
  expect(inner.y, label).toBeGreaterThanOrEqual(outer.y - epsilon);
  expect(inner.x + inner.width, label).toBeLessThanOrEqual(
    outer.x + outer.width + epsilon,
  );
  expect(inner.y + inner.height, label).toBeLessThanOrEqual(
    outer.y + outer.height + epsilon,
  );
};

const verticallyWithin = (
  top: number,
  bottom: number,
  band: { top: number; bottom: number },
  label: string,
) => {
  expect(top, label).toBeGreaterThanOrEqual(band.top);
  expect(bottom, label).toBeLessThanOrEqual(band.bottom);
};

describe('musical containment (Stage 11B)', () => {
  const max = Number.MAX_SAFE_INTEGER;
  const extreme = punctaDocument(
    Array.from({ length: 40 }, (_, i) =>
      i === 3 ? max : i === 20 ? -max + 8 : i === 30 ? 16 : i === 31 ? -9 : 2,
    ),
  );
  const fixtures: [string, ChantDocument][] = [
    ...Object.entries(bundledSources).map(
      ([path, source]): [string, ChantDocument] => [
        path,
        decodeDocument(source),
      ],
    ),
    ['opposing extremes', extreme],
  ];

  it.each(fixtures)(
    'keeps body, accidental and ledger ink inside authoritative bounds (%s)',
    (_name, document) => {
      for (const system of layoutChant(document, measure).systems)
        for (const neume of system.neumes) {
          const label = `${neume.neumeId}`;
          for (const shape of neume.bodyInk ?? neume.ink)
            within(shape.bounds, neume.bounds, `${label} body`);
          for (const shape of neume.ink)
            within(shape.bounds, neume.bounds, `${label} ink`);
          for (const accidental of neume.accidentals ?? [])
            within(accidental.ink.bounds, neume.bounds, `${label} accidental`);
          for (const run of neume.ledgers ?? [])
            within(
              {
                x: run.x1,
                y: run.topY - ledgerThickness / 2,
                width: run.x2 - run.x1,
                height: run.bottomY - run.topY + ledgerThickness,
              },
              neume.bounds,
              `${label} ledger`,
            );
        }
    },
  );

  it.each(fixtures)(
    'keeps pointer regions and overlays of unclipped music inside the resolved band (%s)',
    (_name, document) => {
      const layout = layoutChant(document, measure);
      for (const system of layout.systems) {
        const band = system.musicBand;
        verticallyWithin(
          band.top,
          band.bottom,
          { top: system.y, bottom: system.y + system.height },
          `system ${system.index} band`,
        );
        // A range of unclipped neumes fits unclamped; one with clipped
        // members is clamped to the band where it is drawn.
        const range = rangeSelectionBounds(
          system,
          new Set(
            system.neumes
              .filter(
                (n) =>
                  n.bounds.y >= band.top &&
                  n.bounds.y + n.bounds.height <= band.bottom,
              )
              .map((n) => n.neumeId),
          ),
        );
        if (range)
          verticallyWithin(range.y, range.y + range.height, band, 'range');
        for (const neume of system.neumes) {
          const { y, height } = neume.bounds;
          // Clipped extreme ink is covered by the clip itself.
          if (y < band.top || y + height > band.bottom) continue;
          const label = `${system.index}/${neume.neumeId}`;
          const outline = neumeSelectionBounds(neume);
          verticallyWithin(
            outline.y - outline.strokeWidth / 2,
            outline.y + outline.height + outline.strokeWidth / 2,
            band,
            `${label} outline`,
          );
          // Lyric-move and placement-context rectangles (7 units, 3 stroke).
          verticallyWithin(y - 7 - 1.5, y + height + 7 + 1.5, band, label);
          const caption = moveCaptionBaseline(neume.bounds, band);
          verticallyWithin(
            caption - moveCaptionFontSize,
            caption + moveCaptionFontSize * 0.3,
            band,
            `${label} caption`,
          );
          expect(caption).toBeLessThanOrEqual(y);
          for (const note of neume.notes) {
            verticallyWithin(
              note.hitBounds.y,
              note.hitBounds.y + note.hitBounds.height,
              band,
              `${label} note hit`,
            );
            if (note.modifierBounds)
              verticallyWithin(
                note.modifierBounds.y,
                note.modifierBounds.y + note.modifierBounds.height,
                band,
                `${label} modifier`,
              );
          }
          for (const accidental of neume.accidentals ?? [])
            verticallyWithin(
              accidental.hitBounds.y,
              accidental.hitBounds.y + accidental.hitBounds.height,
              band,
              `${label} accidental hit`,
            );
        }
        for (const target of [
          ...system.divisions,
          ...system.clefChanges,
          system.clef,
        ])
          verticallyWithin(
            target.hitBounds.y,
            target.hitBounds.y + target.hitBounds.height,
            band,
            `system ${system.index} control`,
          );
      }
      // Adjacent systems: resolved bands are disjoint, so no clipped region
      // of one system can intercept a pointer on another.
      for (let i = 1; i < layout.systems.length; i++)
        expect(
          layout.systems[i].musicBand.top -
            layout.systems[i - 1].musicBand.bottom,
        ).toBeGreaterThanOrEqual(systemGap);
    },
  );
});
