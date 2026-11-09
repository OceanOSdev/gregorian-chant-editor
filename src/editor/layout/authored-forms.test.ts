import { describe, expect, it } from 'vitest';
import { staffPosition, type NoteAppearance } from '../domain/chant-document';
import { buildNeumeGeometry } from './neume-geometry';
import { buildClimacus } from './neumes/climacus';
import { layoutChant } from './layout-chant';
import { blankDocument } from '../persistence/native-document';

const positions = (values: number[]) => values.map(staffPosition);
const overlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;
describe('shared authored engraving', () => {
  it('preserves the approved Climacus virga exactly and measures its standalone shaft', () => {
    for (const pitch of [-1, 0, 1, 2, 6, 7]) {
      const virga = buildNeumeGeometry(
        'punctum',
        positions([pitch]),
        100,
        124,
        [{ form: 'virga' }],
      );
      const climacus = buildClimacus(
        positions([pitch, pitch - 1, pitch - 2]),
        100,
        124,
      );
      expect(virga.ink[0]).toEqual(climacus.ink[0]);
      expect(virga.bounds.height).toBe(33);
      expect(
        virga.notes[0].hitBounds.y + virga.notes[0].hitBounds.height,
      ).toBeGreaterThan(virga.bounds.y + virga.bounds.height);
      expect(virga.lyricAnchorX).toBe(106);
    }
  });
  for (const a of [1, 2, 3, 5, 12])
    for (const b of [1, 2, 3, 5, 12])
      for (const pitch of [0, 1, 6]) {
        it(`connected quilisma (${a},${b}) at ${pitch}: measured ink, targets and signs`, () => {
          const pitches = positions([pitch, pitch + a, pitch + a + b]);
          const appearance: NoteAppearance[] = [{}, { form: 'quilisma' }, {}];
          const base = buildNeumeGeometry(
            'scandicus',
            pitches,
            100,
            124,
            appearance,
          );
          expect(base.ink).toHaveLength(1);
          expect(base.notes).toHaveLength(3);
          expect(base.lyricAnchorX).toBe(106);
          expect(base.advanceX).toBe(base.bounds.width + 33);
          for (const [i, n] of base.notes.entries()) {
            expect(n.anchorY).toBe(124 - pitches[i] * 12);
            expect(n.hitBounds.width).toBeGreaterThan(0);
            expect(n.hitBounds.height).toBeGreaterThan(0);
            for (const other of base.notes.slice(i + 1))
              if (!n.hitShape && !other.hitShape)
                expect(overlap(n.hitBounds, other.hitBounds)).toBe(false);
          }
          const marked = buildNeumeGeometry('scandicus', pitches, 100, 124, [
            { episema: true },
            { form: 'quilisma', mora: 1, episema: true },
            { mora: 1, episema: true },
          ]);
          expect(marked.ink[0]).toBeDefined();
          expect(marked.ink.slice(1)).toHaveLength(5);
          expect(marked.notes.map((n) => n.head)).toEqual(
            base.notes.map((n) => n.head),
          );
          for (const sign of marked.ink.slice(1))
            expect(overlap(sign.bounds, base.bounds)).toBe(false);
          for (const n of marked.notes) expect(n.modifierBounds).toBeDefined();
        });
      }
  it.each([1, 2, 3, 5, 12])(
    'quilisma pes at interval %s retains separate pitch targets and both marks',
    (interval) => {
      const geometry = buildNeumeGeometry(
        'podatus',
        positions([0, interval]),
        100,
        124,
        [
          { form: 'quilisma', mora: 1, episema: true },
          { mora: 1, episema: true },
        ],
      );
      expect(geometry.ink).toHaveLength(5);
      expect(
        overlap(geometry.notes[0].hitBounds, geometry.notes[1].hitBounds),
      ).toBe(false);
    },
  );
  it('uses form ink for whole-neume wrapping with lyrics, divisions, clefs and custodes', () => {
    const doc = blankDocument();
    doc.neumes = Array.from({ length: 40 }, (_, i) => ({
      id: 'n' + i,
      kind: 'scandicus',
      notes: [
        { id: `${i}a`, staffPosition: staffPosition(0) },
        { id: `${i}b`, staffPosition: staffPosition(2), form: 'quilisma' },
        { id: `${i}c`, staffPosition: staffPosition(5) },
      ],
    }));
    doc.divisions = [{ id: 'bar', kind: 'minor', beforeNeumeId: 'n8' }];
    doc.clefChanges = [
      {
        id: 'f',
        clef: { type: 'f', staffLine: 3 },
        beforeNeumeId: 'n15',
        beforeDivisionId: null,
      },
    ];
    doc.syllables = [
      {
        id: 'la',
        text: 'Alleluia',
        startsAtNeumeId: 'n0',
        boundaryBefore: 'word',
      },
    ];
    const layout = layoutChant(doc);
    expect(layout.systems.length).toBeGreaterThan(1);
    expect(
      layout.systems.flatMap((s) => s.neumes.map((n) => n.neumeId)),
    ).toEqual(doc.neumes.map((n) => n.id));
    expect(layout.systems.flatMap((s) => s.custodes).length).toBeGreaterThan(0);
    for (const system of layout.systems)
      for (const n of system.neumes) expect(n.notes[1].form).toBe('quilisma');
  });
  it('never falls back to square for unsupported runtime form input', () => {
    expect(() =>
      buildNeumeGeometry('punctum', positions([2]), 100, 124, [
        { form: 'quilisma' },
      ]),
    ).toThrow('Unsupported');
  });
});
