import {
  getInkBounds,
  legacyCompactOffset,
  legacyNoteWidth,
  interNeumeInkGap,
} from './neume-geometry';
import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ClimacusNeume,
  type PorrectusNeume,
  type Neume,
  type StaffPosition,
} from '../domain/chant-document';
import { insertClimacus } from '../commands/insert-climacus';
import { insertPorrectus } from '../commands/insert-porrectus';
import { deleteNeume } from '../commands/delete-neume';
import { resolveGraphicalNeumePlacement } from '../interaction/resolve-graphical-neume-placement';
import { getScoreAccessibleDescription } from '../rendering/score-accessible-description';
import {
  layoutChant,
  layoutGraphicalPlacementPreview,
  getSystemNeumePlacement,
  measureNeumeWidth,
  wrapNeumes,
  firstNeumeCenterX,
  systemVerticalAdvance,
  staffEndX,
} from './layout-chant';

function documentWith(neumes: Neume[] = []): ChantDocument {
  return {
    title: 'Test',
    clef: { type: 'c', staffLine: 3 },
    syllables: [
      { id: 'first', text: 'Ky-' },
      { id: 'last', text: 'ri-' },
    ],
    neumes,
  };
}
function punctum(index: number, syllable = 'first'): Neume {
  return {
    id: `p-${index}`,
    kind: 'punctum',
    lyricSyllableId: syllable,
    notes: [{ id: `n-${index}`, staffPosition: staffPosition(3) }],
  };
}
for (const kind of ['climacus', 'porrectus'] as const) {
  function candidate(
    id: string = kind,
    syllable = 'first',
    first = 3,
  ): ClimacusNeume | PorrectusNeume {
    return {
      id,
      kind,
      lyricSyllableId: syllable,
      notes: [
        { id: `${id}-1`, staffPosition: staffPosition(first) },
        {
          id: `${id}-2`,
          staffPosition: staffPosition(first - (kind === 'climacus' ? 1 : 2)),
        },
        {
          id: `${id}-3`,
          staffPosition: staffPosition(first - (kind === 'climacus' ? 2 : 1)),
        },
      ],
    };
  }
  describe(`${kind} layout and placement`, () => {
    it('uses three compact rectangles, two adjacent connectors, complete bounds, and a first-note lyric anchor', () => {
      const document = documentWith([candidate(), punctum(1)]);
      const system = layoutChant(document).systems[0];
      const neume = system?.neumes[0];
      if (!system || !neume) throw new Error('Missing layout');
      expect(neume.notes.map((n) => n.x + n.width / 2)).toEqual([
        firstNeumeCenterX,
        firstNeumeCenterX + legacyCompactOffset,
        firstNeumeCenterX + 2 * legacyCompactOffset,
      ]);
      expect(neume.ink).toHaveLength(5);
      neume.ink.slice(0, 2).forEach((connector, i) => {
        const first = neume.notes[i];
        const second = neume.notes[i + 1];
        if (!first || !second) throw new Error('Missing notes');
        expect(connector.bounds).toEqual({
          x: second.x + 0.5,
          y: Math.min(first.anchorY, second.anchorY) - 1.5,
          width: 3,
          height: Math.abs(first.anchorY - second.anchorY) + 3,
        });
      });
      expect(neume.bounds).toEqual(getInkBounds(neume.ink));
      expect(measureNeumeWidth(document.neumes[0] ?? candidate())).toBe(
        legacyNoteWidth + 2 * legacyCompactOffset,
      );
      expect(system.neumes[1]?.notes[0]?.x).toBe(
        firstNeumeCenterX +
          2 * legacyCompactOffset +
          legacyNoteWidth / 2 +
          interNeumeInkGap,
      );
      expect(system.lyrics).toHaveLength(1);
      expect(system.lyrics[0]?.x).toBe(firstNeumeCenterX);
    });
    it('keeps exact fits and wraps indivisibly on overflow, including oversized progress', () => {
      const first = candidate();
      const second = candidate('second');
      const right =
        firstNeumeCenterX + 2 * legacyCompactOffset + legacyNoteWidth / 2;
      expect(wrapNeumes([first], right)).toEqual([
        { startNeumeIndex: 0, neumes: [first] },
      ]);
      expect(wrapNeumes([first, second], right)).toEqual([
        { startNeumeIndex: 0, neumes: [first] },
        { startNeumeIndex: 1, neumes: [second] },
      ]);
      expect(wrapNeumes([first, second], right - 1)).toHaveLength(2);
    });
    it.each([0, 1, 2])(
      'uses complete-neume midpoint boundaries and local pitch on system %s',
      (systemIndex) => {
        const document = documentWith(
          Array.from({ length: 24 }, (_, i) => candidate(`neume-${i}`)),
        );
        const system = layoutChant(document).systems[systemIndex];
        const neume = system?.neumes[0];
        if (!system || !neume) throw new Error('Missing system');
        const bottom = Math.max(...system.staffLines.map((line) => line.y));
        const x = neume.bounds.x + neume.bounds.width / 2;
        expect(
          getSystemNeumePlacement({ x, y: bottom - 6 }, kind, system),
        ).toMatchObject({
          firstStaffPosition: 1,
          preferredNeumeInsertionIndex: system.startNeumeIndex,
        });
        expect(
          getSystemNeumePlacement({ x: x + 0.01, y: bottom - 36 }, kind, system)
            ?.preferredNeumeInsertionIndex,
        ).toBe(system.startNeumeIndex + 1);
        for (const p of [-1, 7])
          expect(
            getSystemNeumePlacement({ x, y: bottom - p * 12 }, kind, system)
              ?.firstStaffPosition,
          ).toBe(p);
        expect(
          getSystemNeumePlacement(
            { x: staffEndX + 1, y: bottom },
            kind,
            system,
          ),
        ).toBeNull();
      },
    );
    it.each([0, 3, 6, 7, 18, 24])(
      'matches ID-free previews to committed geometry at boundary %s after reflow',
      (insertionIndex) => {
        const neumes = Array.from({ length: 24 }, (_, i) => punctum(i));
        const neume = candidate();
        const positions: [StaffPosition, StaffPosition, StaffPosition] = [
          neume.notes[0].staffPosition,
          neume.notes[1].staffPosition,
          neume.notes[2].staffPosition,
        ];
        const preview = layoutGraphicalPlacementPreview(neumes, {
          kind,
          staffPositions: positions,
          insertionIndex,
        });
        const document = documentWith(neumes);
        const committed =
          neume.kind === 'climacus'
            ? insertClimacus(document, neume, insertionIndex)
            : insertPorrectus(document, neume, insertionIndex);
        const layout = layoutChant(committed).systems.flatMap(
          (system) => system.neumes,
        )[insertionIndex];
        expect(preview?.notes).toEqual(
          layout?.notes.map(({ noteId: _id, ...geometry }) => geometry),
        );
        expect(preview?.ink).toEqual(layout?.ink);
        expect(preview?.notes.every((note) => !('noteId' in note))).toBe(true);
      },
    );
    it('previews placement in an empty document without allocating semantic IDs', () => {
      const document = documentWith();
      const layout = layoutChant(document);
      const resolved = resolveGraphicalNeumePlacement(
        document,
        layout,
        'first',
        kind,
        { x: 250, y: 88 },
      );
      expect(resolved?.insertionIndex).toBe(0);
      expect(resolved?.preview.notes).toHaveLength(3);
      expect(resolved?.preview.ink).toHaveLength(5);
      expect(document.neumes).toEqual([]);
    });
    it('clamps to the active syllable across systems and previews the final destination', () => {
      const document = documentWith([
        ...Array.from({ length: 24 }, (_, i) => punctum(i)),
        punctum(24, 'last'),
      ]);
      const layout = layoutChant(document);
      const resolved = resolveGraphicalNeumePlacement(
        document,
        layout,
        'last',
        kind,
        { x: 250, y: 88 },
      );
      if (!resolved) throw new Error('Missing placement');
      expect(resolved.insertionIndex).toBe(24);
      expect(resolved.preview.notes[0].y).toBeGreaterThan(
        systemVerticalAdvance,
      );
      expect(resolved.staffPositions).toEqual(
        kind === 'climacus' ? [3, 2, 1] : [3, 1, 2],
      );
      const neume = candidate(kind, 'last');
      const committed =
        neume.kind === 'climacus'
          ? insertClimacus(document, neume, 24)
          : insertPorrectus(document, neume, 24);
      const result = layoutChant(committed)
        .systems.flatMap((system) => system.neumes)
        .find((n) => n.neumeId === kind);
      expect(resolved.preview.notes).toEqual(
        result?.notes.map(({ noteId: _id, ...geometry }) => geometry),
      );
      expect(
        resolveGraphicalNeumePlacement(document, layout, 'last', kind, {
          x: 250,
          y: 230,
        }),
      ).toBeNull();
      expect(
        resolveGraphicalNeumePlacement(document, layout, null, kind, {
          x: 250,
          y: 88,
        }),
      ).toBeNull();
      expect(
        resolveGraphicalNeumePlacement(document, layout, 'last', kind, {
          x: NaN,
          y: 88,
        }),
      ).toBeNull();
    });
    it('keeps one lyric per melisma and stable identities when deletion reflows later systems', () => {
      const neumes = Array.from({ length: 20 }, (_, i) =>
        candidate(`neume-${i}`, i < 12 ? 'first' : 'last'),
      );
      const document = documentWith(neumes);
      const before = layoutChant(document);
      expect(
        before.systems.flatMap((s) => s.lyrics).map((l) => l.syllableId),
      ).toEqual(['first', 'last']);
      expect(before.systems[0]?.lyrics.map((l) => l.syllableId)).toEqual([
        'first',
      ]);
      const deleted = deleteNeume(document, 'neume-0');
      const after = layoutChant(deleted);
      expect(
        after.systems.flatMap((s) => s.neumes).map((n) => n.neumeId),
      ).toEqual(neumes.slice(1).map((n) => n.id));
      expect(
        after.systems
          .flatMap((s) => s.neumes)
          .flatMap((n) => n.notes)
          .map((n) => n.noteId),
      ).toEqual(
        neumes
          .slice(1)
          .flatMap((n) => n.notes)
          .map((n) => n.id),
      );
      expect(getScoreAccessibleDescription(before)).toBe(
        'A Gregorian chant score with 4 four-line systems, 20 neumes, 60 notes, and 2 rendered lyric syllables.',
      );
    });
  });
}
