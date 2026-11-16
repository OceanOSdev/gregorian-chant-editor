import { describe, expect, it } from 'vitest';
import salveRegina from '../examples/Salve-Regina-Dominican.chant.json?raw';
import kyrieXi from '../examples/Kyrie-XI.chant.json?raw';
import {
  staffPosition,
  type ChantDocument,
  type Neume,
  type NoteAppearance,
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
import type { MeasureLyricText } from './lyric-text-metrics';
import { buildNeumeGeometry, geometryKindFor } from './neume-geometry';
import {
  canonicalLyricBaselineY,
  canonicalMusicBand,
  lyricAscent,
  lyricBottomPadding,
  lyricDescent,
  measureSystemVertical,
  musicToLyricClearance,
  offStaffCanvasMargin,
  stackSystems,
  systemGap,
  systemHeight,
  systemMusicPadding,
} from './system-vertical-layout';
import { verticalLayoutViolations } from './vertical-clearance.testing';
import { writtenAccidentals } from '../domain/accidentals';

const bundledSources = import.meta.glob<string>('../examples/*.chant.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * The x projection of a neume group, including its written signs: the
 * horizontal facts composition decided.
 */
const xProjection = (g: {
  bounds: { x: number; width: number };
  lyricAnchorX: number;
  advanceX: number;
  notes: readonly { anchorX: number }[];
  accidentals?: readonly { ink: { bounds: { x: number; width: number } } }[];
}) => [
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
      semantic.notes as readonly NoteAppearance[],
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
    expect(canonicalLyricBaselineY - lyricAscent - musicToLyricClearance).toBe(
      157,
    );
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
    for (const f of frames)
      expect(f.musicBand.bottom - f.musicBand.top).toBe(220 + 2400);
    expect(frames[1].musicBand.top).toBe(244 + 40 - offStaffCanvasMargin);
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

  it('never changes x geometry or membership when vertical expansion occurs', () => {
    // Opposing high and low ink across systems, with lyrics, hyphens,
    // divisions and clef changes. Moving the extreme notes further from the
    // staff (same ink widths, deeper baselines and higher staff origins)
    // must leave every x coordinate, slot and system membership unchanged.
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
  });
});

describe('translation of composed systems (Stage 11B)', () => {
  it.each(Object.entries(bundledSources))(
    'keeps every group of %s at its canonical-frame x geometry',
    (_path, source) => {
      const document = decodeDocument(source);
      const specs = new Map<
        string,
        {
          kind: 'flat' | 'natural';
          staffPosition: number;
          noteIndex: number | null;
        }[]
      >();
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
              semantic.notes as readonly NoteAppearance[],
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
        system.lyricBaselineY - lyricAscent - musicToLyricClearance,
      );
      expect(system.lyricBaselineY - system.y).toBeGreaterThan(180);
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
